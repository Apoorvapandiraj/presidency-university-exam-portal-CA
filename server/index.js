require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const db = require('./db');

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const TEACHER_USER = process.env.TEACHER_USER || 'Apoorva';
const TEACHER_PASS = process.env.TEACHER_PASS || 'PpuExam@2026!';
const MCQ_COUNT = parseInt(process.env.EXAM_MCQ_COUNT) || 20; // random MCQs drawn from the pool per student
const DURATION = (parseInt(process.env.EXAM_DURATION_MIN) || 60) * 60; // seconds

const now = () => new Date().toISOString();
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const getAttempt = (id) => db.prepare('SELECT * FROM attempts WHERE id=?').get(id);
const layoutIds = (a) => JSON.parse(a.layout).map((l) => l.id);
const totalFor = (a) => {
  const ids = layoutIds(a);
  return db.prepare(`SELECT COALESCE(SUM(marks),0) t FROM questions WHERE id IN (${ids.map(() => '?').join(',')})`).get(...ids).t;
};
const safeEq = (a, b) => {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false });
const teacherLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts, try again later' } });

const auth = (role) => (req, res, next) => {
  try {
    const p = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET);
    if (p.role !== role) throw new Error('role');
    req.user = p;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

function saveAnswer(attemptId, qid, ans) {
  db.prepare(`INSERT INTO answers(attempt_id,question_id,answer) VALUES(?,?,?)
    ON CONFLICT(attempt_id,question_id) DO UPDATE SET answer=excluded.answer`)
    .run(attemptId, qid, String(ans ?? '').slice(0, 20000));
}

function recompute(attemptId) {
  db.prepare(`UPDATE attempts SET score=(SELECT COALESCE(SUM(marks),0) FROM answers WHERE attempt_id=?) WHERE id=?`)
    .run(attemptId, attemptId);
}

function finalize(attemptId, answers) {
  const a = getAttempt(attemptId);
  if (a.submitted_at) return a;
  db.transaction(() => {
    const allowed = new Set(layoutIds(a));
    if (answers) for (const [qid, ans] of Object.entries(answers)) if (allowed.has(+qid)) saveAnswer(attemptId, +qid, ans);
    const get = db.prepare('SELECT answer FROM answers WHERE attempt_id=? AND question_id=?');
    const setM = db.prepare('UPDATE answers SET marks=? WHERE attempt_id=? AND question_id=?');
    for (const q of db.prepare("SELECT id,correct,marks FROM questions WHERE type='mcq'").all()) {
      const r = get.get(attemptId, q.id);
      if (r) setM.run(String(q.correct) === String(r.answer) ? q.marks : 0, attemptId, q.id);
    }
    recompute(attemptId);
    db.prepare('UPDATE attempts SET submitted_at=? WHERE id=?').run(now(), attemptId);
  })();
  return getAttempt(attemptId);
}

const elapsed = (a) => (Date.now() - Date.parse(a.started_at)) / 1000;

/* ---------------- Student ---------------- */
app.post('/api/student/login', loginLimiter, (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const rollNo = String(req.body.rollNo || '').trim().toUpperCase();
  if (!name || !rollNo || !/^\S+@\S+\.\S+$/.test(email))
    return res.status(400).json({ error: 'Enter a valid name, Outlook ID and roll number' });

  let s = db.prepare('SELECT * FROM students WHERE roll_no=?').get(rollNo);
  if (!s) {
    const r = db.prepare('INSERT INTO students(name,email,roll_no) VALUES(?,?,?)').run(name, email, rollNo);
    s = { id: r.lastInsertRowid };
  } else if (s.email !== email) {
    return res.status(401).json({ error: 'This roll number is registered with a different Outlook ID' });
  }

  let a = db.prepare('SELECT * FROM attempts WHERE student_id=?').get(s.id);
  if (!a) {
    // Same question pattern for everyone, but each student gets a new shuffled order.
    const mcq = db.prepare("SELECT id FROM questions WHERE type='mcq'").all().map((q) => q.id);
    const coding = db.prepare("SELECT id FROM questions WHERE type='coding' ORDER BY id").all().map((q) => q.id);
    const layout = [...shuffle(mcq).slice(0, MCQ_COUNT), ...coding].map((id) => {
      const q = db.prepare('SELECT type, options FROM questions WHERE id=?').get(id);
      const n = q.type === 'mcq' ? JSON.parse(q.options).length : 0;
      return { id, order: shuffle([...Array(n).keys()]) };
    });
    const r = db.prepare('INSERT INTO attempts(student_id,layout) VALUES(?,?)').run(s.id, JSON.stringify(layout));
    a = getAttempt(r.lastInsertRowid);
  }
  const token = jwt.sign({ role: 'student', attemptId: a.id }, SECRET, { expiresIn: '6h' });
  res.json({ token, name, submitted: !!a.submitted_at });
});

app.get('/api/exam', auth('student'), (req, res) => {
  let a = getAttempt(req.user.attemptId);
  const student = db.prepare('SELECT * FROM students WHERE id=?').get(a.student_id);
  if (!a.started_at) {
    const t = now();
    db.prepare('UPDATE attempts SET started_at=? WHERE id=?').run(t, a.id);
    a.started_at = t;
  }
  if (!a.submitted_at && elapsed(a) >= DURATION) a = finalize(a.id);
  if (a.submitted_at)
    return res.json({ submitted: true, score: a.score, total: totalFor(a), name: student.name });

  const byId = Object.fromEntries(db.prepare('SELECT * FROM questions').all().map((q) => [q.id, q]));
  const questions = JSON.parse(a.layout).map((l) => {
    const q = byId[l.id];
    const opts = q.type === 'mcq' ? JSON.parse(q.options) : null;
    return {
      id: q.id, type: q.type, text: q.text, marks: q.marks,
      options: opts ? l.order.map((i) => ({ key: i, text: opts[i] })) : undefined,
    };
  });
  const answers = {};
  db.prepare('SELECT question_id, answer FROM answers WHERE attempt_id=?').all(a.id)
    .forEach((r) => (answers[r.question_id] = r.answer));
  res.json({
    name: student.name, rollNo: student.roll_no, questions, answers,
    warnings: a.warnings, remaining: Math.floor(DURATION - elapsed(a)),
  });
});

app.put('/api/exam/answer', auth('student'), (req, res) => {
  const a = getAttempt(req.user.attemptId);
  if (a.submitted_at) return res.status(403).json({ error: 'Already submitted' });
  if (elapsed(a) > DURATION + 15) { finalize(a.id); return res.status(403).json({ error: 'Time is over' }); }
  if (!layoutIds(a).includes(+req.body.questionId)) return res.status(400).json({ error: 'Invalid question' });
  saveAnswer(a.id, +req.body.questionId, req.body.answer);
  res.json({ ok: true });
});

app.post('/api/exam/warning', auth('student'), (req, res) => {
  const a = getAttempt(req.user.attemptId);
  if (a.submitted_at) return res.json({ warnings: a.warnings });
  db.prepare('INSERT INTO warnings(attempt_id,at,reason) VALUES(?,?,?)')
    .run(a.id, now(), String(req.body.reason || 'Left exam tab').slice(0, 100));
  db.prepare('UPDATE attempts SET warnings=warnings+1 WHERE id=?').run(a.id);
  res.json({ warnings: getAttempt(a.id).warnings });
});

app.post('/api/exam/submit', auth('student'), (req, res) => {
  const a = getAttempt(req.user.attemptId);
  const done = a.submitted_at ? a : finalize(a.id, req.body.answers);
  res.json({ score: done.score, total: totalFor(done) });
});

/* ---------------- Teacher ---------------- */
app.post('/api/teacher/login', teacherLimiter, (req, res) => {
  const { username, password } = req.body || {};
  if (!safeEq(username, TEACHER_USER) || !safeEq(password, TEACHER_PASS))
    return res.status(401).json({ error: 'Invalid username or password' });
  res.json({ token: jwt.sign({ role: 'teacher' }, SECRET, { expiresIn: '12h' }), name: TEACHER_USER });
});

const attemptRows = () => db.prepare(`
  SELECT a.id, s.name, s.email, s.roll_no AS rollNo, a.started_at AS startedAt,
         a.submitted_at AS submittedAt, a.score, a.warnings, a.layout
  FROM attempts a JOIN students s ON s.id=a.student_id
  ORDER BY COALESCE(a.started_at,'') DESC`).all()
  .map(({ layout, ...r }) => ({ ...r, total: totalFor({ layout }) }));

app.get('/api/teacher/attempts', auth('teacher'), (req, res) => {
  res.json({ attempts: attemptRows(), durationMin: DURATION / 60 });
});

app.get('/api/teacher/attempts/:id', auth('teacher'), (req, res) => {
  const a = getAttempt(+req.params.id);
  if (!a) return res.status(404).json({ error: 'Not found' });
  const student = db.prepare('SELECT * FROM students WHERE id=?').get(a.student_id);
  const ans = Object.fromEntries(db.prepare('SELECT * FROM answers WHERE attempt_id=?').all(a.id).map((r) => [r.question_id, r]));
  const ids = new Set(layoutIds(a));
  const questions = db.prepare('SELECT * FROM questions ORDER BY id').all().filter((q) => ids.has(q.id)).map((q) => ({
    id: q.id, type: q.type, text: q.text, marks: q.marks,
    options: q.options ? JSON.parse(q.options) : undefined, correct: q.correct,
    answer: ans[q.id]?.answer ?? null, awarded: ans[q.id]?.marks ?? null,
  }));
  const warnings = db.prepare('SELECT at, reason FROM warnings WHERE attempt_id=? ORDER BY id').all(a.id);
  res.json({ attempt: { ...a, layout: undefined }, student, questions, warnings, total: totalFor(a) });
});

app.post('/api/teacher/attempts/:id/grade', auth('teacher'), (req, res) => {
  const id = +req.params.id;
  const att = getAttempt(id);
  if (!att) return res.status(404).json({ error: 'Not found' });
  const q = db.prepare("SELECT * FROM questions WHERE id=? AND type='coding'").get(+req.body.questionId);
  if (!q) return res.status(400).json({ error: 'Not a coding question' });
  const m = Math.max(0, Math.min(q.marks, Number(req.body.marks) || 0));
  db.prepare(`INSERT INTO answers(attempt_id,question_id,answer,marks) VALUES(?,?,'',?)
    ON CONFLICT(attempt_id,question_id) DO UPDATE SET marks=excluded.marks`).run(id, q.id, m);
  recompute(id);
  res.json({ score: getAttempt(id).score });
});

app.get('/api/teacher/export', auth('teacher'), (req, res) => {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['Name', 'Roll No', 'Outlook ID', 'Started', 'Submitted', 'Warnings', 'Score', 'Total'].join(',')];
  attemptRows().forEach((r) =>
    lines.push([r.name, r.rollNo, r.email, r.startedAt, r.submittedAt, r.warnings, r.score, r.total].map(esc).join(',')));
  res.type('text/csv').send(lines.join('\n'));
});

/* ---------------- Serve React build ---------------- */
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Exam portal running on http://localhost:${PORT}`));
