import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import StudentLogin from './pages/StudentLogin.jsx';
import Exam from './pages/Exam.jsx';
import Result from './pages/Result.jsx';
import TeacherLogin from './pages/TeacherLogin.jsx';
import Teacher from './pages/Teacher.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/student" element={<StudentLogin />} />
      <Route path="/exam" element={<Exam />} />
      <Route path="/result" element={<Result />} />
      <Route path="/teacher/login" element={<TeacherLogin />} />
      <Route path="/teacher" element={<Teacher />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
