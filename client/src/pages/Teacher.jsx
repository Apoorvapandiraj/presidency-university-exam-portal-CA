import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../Logo.jsx';
import { api, fmtTime } from '../api.js';

export default function Teacher() {
  const nav = useNavigate();
  const token = sessionStorage.getItem('tcToken');
  const [rows, setRows] = useState([]);
  const [detail, setDetail] = useState(null);

  const load = useCallback(() => {
    api('/teacher/attempts', { token })
      .then((d) => { setRows(d.attempts); })
      .catch(() => { sessionStorage.removeItem('tcToken'); nav('/teacher/login'); });
  }, [token]);

  useEffect(() => {
    if (!token) return nav('/teacher/login');
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  const open = (id) => api(`/teacher/attempts/${id}`, { token }).then(setDetail);

  async function grade(qid, marks) {
    await api(`/teacher/attempts/${detail.attempt.id}/grade`, { method: 'POST', token, body: { questionId: qid, marks } });
    open(detail.attempt.id); load();
  }

  async function exportCsv() {
    const res = await fetch('/api/teacher/export', { headers: { Authorization: `Bearer ${token}` } });
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a'); a.href = url; a.download = 'exam-results.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const submitted = rows.filter((r) => r.submittedAt).length;
  const flagged = rows.filter((r) => r.warnings > 0).length;

  return (
    <div className="exam">
      <header className="nav">
        <Logo size={36} />
        <div className="nav-mid">Teacher Dashboard</div>
        <div className="nav-right">
          <button className="btn ghost small" onClick={exportCsv}>Export CSV</button>
          <button className="btn ghost small" onClick={() => { sessionStorage.removeItem('tcToken'); nav('/'); }}>Logout</button>
        </div>
      </header>
      <main className="dash">
        <div className="stats">
          <div className="stat"><b>{rows.length}</b>Attended</div>
          <div className="stat"><b>{submitted}</b>Submitted</div>
          <div className="stat"><b>{rows.length - submitted}</b>In progress</div>
          <div className="stat warn"><b>{flagged}</b>With warnings</div>
        </div>

        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Roll No</th><th>Outlook ID</th><th>Started</th><th>Submitted</th><th>Warnings</th><th>Score</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} onClick={() => open(r.id)}>
                  <td>{r.name}</td><td>{r.rollNo}</td><td>{r.email}</td>
                  <td>{fmtTime(r.startedAt)}</td>
                  <td>{r.submittedAt ? fmtTime(r.submittedAt) : <span className="tag">In progress</span>}</td>
                  <td>{r.warnings > 0 ? <span className="tag tag-warn">{r.warnings}</span> : 0}</td>
                  <td>{r.submittedAt ? `${r.score} / ${r.total}` : '—'}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan="7" className="muted center">No student has attended yet</td></tr>}
            </tbody>
          </table>
        </div>
      </main>

      {detail && (
        <div className="modal" onClick={() => setDetail(null)}>
          <div className="card wide" onClick={(e) => e.stopPropagation()}>
            <div className="q-head">
              <h3>{detail.student.name} · {detail.student.roll_no}</h3>
              <button className="btn ghost small" onClick={() => setDetail(null)}>Close</button>
            </div>
            <p className="muted">{detail.student.email}<br />
              Started: {fmtTime(detail.attempt.started_at)} · Submitted: {fmtTime(detail.attempt.submitted_at)}<br />
              Score: {detail.attempt.score} / {detail.total} · Warnings: {detail.attempt.warnings}</p>

            {detail.warnings.length > 0 && (
              <>
                <h4>Warning log</h4>
                <ul>{detail.warnings.map((w, i) => <li key={i}>{fmtTime(w.at)} — {w.reason}</li>)}</ul>
              </>
            )}

            <h4>Coding answers</h4>
            {detail.questions.filter((q) => q.type === 'coding').map((q) => (
              <div key={q.id} className="code-review">
                <b>{q.text}</b>
                <pre>{q.answer || '(no answer)'}</pre>
                <GradeBox q={q} onSave={(m) => grade(q.id, m)} />
              </div>
            ))}

            <h4>MCQ result</h4>
            <p className="muted">
              {detail.questions.filter((q) => q.type === 'mcq' && q.awarded > 0).length} correct of{' '}
              {detail.questions.filter((q) => q.type === 'mcq').length}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function GradeBox({ q, onSave }) {
  const [m, setM] = useState(q.awarded ?? 0);
  return (
    <div className="grade">
      Marks: <input type="number" min="0" max={q.marks} step="0.5" value={m} onChange={(e) => setM(e.target.value)} /> / {q.marks}
      <button className="btn small" onClick={() => onSave(m)}>Save</button>
    </div>
  );
}
