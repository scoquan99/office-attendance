import { Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Sidebar from './components/Sidebar.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import AttendancePage from './pages/AttendancePage.jsx';
import EmployeesPage from './pages/EmployeesPage.jsx';
import DepartmentsPage from './pages/DepartmentsPage.jsx';

function AppShell() {
  const { employee, ready } = useAuth();

  if (!ready) return null;

  if (!employee) {
    return (
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <div className="layout">
      <Sidebar />
      <main className="main">
        <Routes>
          <Route path="/" element={<AttendancePage />} />
          <Route path="/departments" element={<DepartmentsPage />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="*" element={<AttendancePage />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
