import { useNavigate } from 'react-router-dom';
import Logo from '../Logo.jsx';

export default function Result() {
  const nav = useNavigate();
  const r = JSON.parse(sessionStorage.getItem('result') || 'null');
  if (!r) { nav('/'); return null; }
  return (
    <div className="center-page">
      <Logo />
      <div className="card result">
        <h2>Exam submitted ✔</h2>
        {r.name && <p className="muted">{r.name}</p>}
        <div className="score">{r.score} <span>/ {r.total}</span></div>
        <p className="muted">Your responses have been saved. Coding answers are reviewed by your teacher, so your final score may change.</p>
        <button className="btn" onClick={() => { sessionStorage.clear(); nav('/'); }}>Done</button>
      </div>
    </div>
  );
}
