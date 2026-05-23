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
          element={<Navigate to="/dashboard" replace />}
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard view="dashboard" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/groups"
          element={
            <ProtectedRoute>
              <Dashboard view="groups" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/activity"
          element={
            <ProtectedRoute>
              <Dashboard view="activity" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <Dashboard view="analytics" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Dashboard view="profile" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Dashboard view="settings" />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}
