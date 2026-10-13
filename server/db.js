const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dir = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(dir, { recursive: true });
const db = new Database(path.join(dir, 'exam.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('mcq','coding')),
  difficulty TEXT,
  text TEXT NOT NULL,
  options TEXT,
  correct INTEGER,
  marks REAL NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  roll_no TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL UNIQUE REFERENCES students(id),
  layout TEXT NOT NULL,
  started_at TEXT,
  submitted_at TEXT,
  score REAL NOT NULL DEFAULT 0,
  warnings INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS answers (
  attempt_id INTEGER NOT NULL REFERENCES attempts(id),
  question_id INTEGER NOT NULL REFERENCES questions(id),
  answer TEXT,
  marks REAL,
  PRIMARY KEY (attempt_id, question_id)
);
CREATE TABLE IF NOT EXISTS warnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id INTEGER NOT NULL REFERENCES attempts(id),
  at TEXT NOT NULL,
  reason TEXT
);
`);

// Seed questions from seed/questions.json when the table is empty
if (db.prepare('SELECT COUNT(*) c FROM questions').get().c === 0) {
  const list = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed', 'questions.json'), 'utf8'));
  const ins = db.prepare('INSERT INTO questions(type,difficulty,text,options,correct,marks) VALUES(?,?,?,?,?,?)');
  db.transaction(() => {
    for (const q of list) {
      ins.run(q.type, q.difficulty || null, q.text, q.options ? JSON.stringify(q.options) : null,
        q.type === 'mcq' ? q.correct : null, q.marks);
    }
  })();
  console.log(`Seeded ${list.length} questions`);
}

module.exports = db;
