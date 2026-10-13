import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Logo from '../Logo.jsx';
import { api } from '../api.js';

export default function TeacherLogin() {
  const nav = useNavigate();
  const [f, setF] = useState({ username: '', password: '' });
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setErr('');
    try {
      const d = await api('/teacher/login', { method: 'POST', body: f });
      sessionStorage.setItem('tcToken', d.token);
      nav('/teacher');
    } catch (x) { setErr(x.message); }
  }

  return (
    <div className="center-page">
      <Logo />
      <form className="card" onSubmit={submit}>
        <h2>Teacher Login</h2>
        <label>Name / Username<input required value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></label>
        <label>Password<input required type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
        {err && <div className="error">{err}</div>}
        <button className="btn">Login</button>
        <Link to="/" className="link">← Back</Link>
      </form>
    </div>
  );
}
