import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Logo from '../Logo.jsx';
import { api } from '../api.js';

export default function StudentLogin() {
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', rollNo: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const d = await api('/student/login', { method: 'POST', body: f });
      sessionStorage.setItem('stToken', d.token);
      nav('/exam');
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }

  return (
    <div className="center-page">
      <Logo />
      <form className="card" onSubmit={submit}>
        <h2>Student Login</h2>
        <label>Full name<input required value={f.name} onChange={set('name')} placeholder="Your name" /></label>
        <label>Outlook ID<input required type="email" value={f.email} onChange={set('email')} placeholder="name@presidencyuniversity.in" /></label>
        <label>Roll number<input required value={f.rollNo} onChange={set('rollNo')} placeholder="e.g. PU2023001" /></label>
        {err && <div className="error">{err}</div>}
        <button className="btn" disabled={busy}>{busy ? 'Please wait…' : 'Start Exam'}</button>
        <Link to="/" className="link">← Back</Link>
      </form>
    </div>
  );
}
