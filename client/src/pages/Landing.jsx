import { useNavigate } from 'react-router-dom';
import Logo from '../Logo.jsx';

export default function Landing() {
  const nav = useNavigate();
  return (
    <div className="center-page">
      <Logo size={90} />
      <h1 className="hero">Welcome to the Online Exam</h1>
      <p className="muted">Please choose how you want to continue</p>
      <div className="role-grid">
        <button className="role-card" onClick={() => nav('/student')}>
          <span className="emoji">🎓</span>
          <b>I am a Student</b>
          <small>Take the exam</small>
        </button>
        <button className="role-card" onClick={() => nav('/teacher/login')}>
          <span className="emoji">👩‍🏫</span>
          <b>I am a Teacher</b>
          <small>View student activity</small>
        </button>
      </div>
    </div>
  );
}
