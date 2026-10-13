import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../Logo.jsx';
import { api } from '../api.js';

const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function Exam() {
  const nav = useNavigate();
  const token = sessionStorage.getItem('stToken');
  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [idx, setIdx] = useState(0);
  const [warnings, setWarnings] = useState(0);
  const [banner, setBanner] = useState('');
  const [toast, setToast] = useState('');
  const [left, setLeft] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const answersRef = useRef({});
  const lastWarn = useRef(0);
  const done = useRef(false);
  const timers = useRef({});

  useEffect(() => { answersRef.current = answers; }, [answers]);

  // Load exam
  useEffect(() => {
    if (!token) return nav('/student');
    api('/exam', { token })
      .then((d) => {
        if (d.submitted) { sessionStorage.setItem('result', JSON.stringify(d)); return nav('/result'); }
        setData(d); setAnswers(d.answers); setWarnings(d.warnings); setLeft(d.remaining);
      })
      .catch(() => nav('/student'));
  }, []);

  const submit = useCallback(async () => {
    if (done.current) return;
    done.current = true;
    try {
      const r = await api('/exam/submit', { method: 'POST', token, body: { answers: answersRef.current } });
      sessionStorage.setItem('result', JSON.stringify({ ...r, name: data?.name }));
      nav('/result');
    } catch { done.current = false; alert('Could not submit. Check your connection and try again.'); }
  }, [token, data]);

  // Countdown
  useEffect(() => {
    if (!data) return;
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [data]);
  useEffect(() => { if (data && left <= 0) submit(); }, [left, data, submit]);

  // Tab-switch detection -> warning on top nav + saved for teacher
  useEffect(() => {
    if (!data) return;
    const warn = (reason) => {
      if (done.current || Date.now() - lastWarn.current < 2000) return;
      lastWarn.current = Date.now();
      api('/exam/warning', { method: 'POST', token, body: { reason } })
        .then((r) => { setWarnings(r.warnings); setBanner(`Warning ${r.warnings}: You left the exam tab. This has been reported to your teacher.`); })
        .catch(() => {});
      setTimeout(() => setBanner(''), 8000);
    };
    const onVis = () => document.hidden && warn('Switched tab / minimised window');
    const onBlur = () => warn('Exam window lost focus');
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('blur', onBlur); };
  }, [data, token]);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2000); };
  const block = (e) => { e.preventDefault(); flash('Copy, cut and paste are disabled during the exam'); };
  const onKey = (e) => {
    if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x'].includes(e.key.toLowerCase())) block(e);
  };

  function setAnswer(q, value) {
    setAnswers((a) => ({ ...a, [q.id]: value }));
    clearTimeout(timers.current[q.id]);
    timers.current[q.id] = setTimeout(
      () => api('/exam/answer', { method: 'PUT', token, body: { questionId: q.id, answer: value } }).catch(() => {}),
      q.type === 'mcq' ? 0 : 700
    );
  }

  function codeKey(e, q) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.target, s = el.selectionStart;
      const v = el.value.slice(0, s) + '  ' + el.value.slice(el.selectionEnd);
      setAnswer(q, v);
      requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 2; });
    }
  }

  if (!data) return <div className="center-page">Loading exam…</div>;
  const q = data.questions[idx];
  const answered = data.questions.filter((x) => (answers[x.id] ?? '') !== '').length;

  return (
    <div className="exam" onCopy={block} onCut={block} onPaste={block} onContextMenu={block}
      onDragStart={block} onDrop={block} onKeyDown={onKey}>
      <header className="nav">
        <Logo size={36} />
        <div className="nav-mid">{data.name} · {data.rollNo}</div>
        <div className="nav-right">
          <span className={`pill ${warnings ? 'pill-warn' : ''}`}>⚠ Warnings: {warnings}</span>
          <span className={`pill ${left < 300 ? 'pill-warn' : ''}`}>⏱ {mmss(Math.max(left, 0))}</span>
        </div>
      </header>
      {banner && <div className="banner">⚠ {banner}</div>}
      {toast && <div className="toast">{toast}</div>}

      <main className="exam-body">
        <div className="q-head">
          <span>Question {idx + 1} of {data.questions.length}</span>
          <span className="muted">{q.type === 'mcq' ? 'MCQ' : 'Coding'} · {q.marks} mark{q.marks > 1 ? 's' : ''}</span>
        </div>
        <div className="q-text noselect">{q.text}</div>

        {q.type === 'mcq' ? (
          <div className="options">
            {q.options.map((o) => (
              <label key={o.key} className={`option noselect ${String(answers[q.id]) === String(o.key) ? 'selected' : ''}`}>
                <input type="radio" name={`q${q.id}`} checked={String(answers[q.id]) === String(o.key)}
                  onChange={() => setAnswer(q, String(o.key))} />
                {o.text}
              </label>
            ))}
          </div>
        ) : (
          <textarea className="code" spellCheck={false} placeholder="/* Write your C program here */"
            value={answers[q.id] || ''} onChange={(e) => setAnswer(q, e.target.value)}
            onKeyDown={(e) => codeKey(e, q)} />
        )}

        <div className="palette">
          {data.questions.map((x, i) => (
            <button key={x.id} onClick={() => setIdx(i)}
              className={`dot ${i === idx ? 'cur' : ''} ${(answers[x.id] ?? '') !== '' ? 'ans' : ''}`}>{i + 1}</button>
          ))}
        </div>

        <div className="actions">
          <button className="btn ghost" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>← Previous</button>
          {idx < data.questions.length - 1
            ? <button className="btn" onClick={() => setIdx(idx + 1)}>Next →</button>
            : <button className="btn success" onClick={() => setConfirm(true)}>Submit Exam</button>}
        </div>
      </main>

      {confirm && (
        <div className="modal">
          <div className="card">
            <h3>Submit exam?</h3>
            <p className="muted">You answered {answered} of {data.questions.length} questions. You cannot change answers after submitting.</p>
            <div className="actions">
              <button className="btn ghost" onClick={() => setConfirm(false)}>Go back</button>
              <button className="btn success" onClick={submit}>Yes, submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
