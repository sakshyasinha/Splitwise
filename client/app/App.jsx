import { Navigate, Route, Routes } from 'react-router-dom';
import Dashboard from '../components/dashboard/DashboardPage.jsx';
import AuthPage from '../components/dashboard/AuthPage.jsx';
import Toast from '../components/ui/Toast.jsx';
import useAuth from '../hooks/useAuth.js';

function ProtectedRoute({ children }) {
  const { token } = useAuth();
  if (!token) {
    return <Navigate to="/auth" replace />;
  }
  return children;
}

export default function App() {
  return (
    <>
      <Toast />
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}