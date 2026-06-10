import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { useUserStore } from './stores/user';
import { initSocket, disconnectSocket } from './socket';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ProjectList from './pages/ProjectList';
import ProjectDetail from './pages/ProjectDetail';
import PositionMarket from './pages/PositionMarket';
import PositionDetail from './pages/PositionDetail';
import CandidateList from './pages/CandidateList';
import CandidateDetail from './pages/CandidateDetail';
import AIAssistant from './pages/AIAssistant';
import Settings from './pages/Settings';
import Profile from './pages/Profile';

const MessageBoard = lazy(() => import('./pages/MessageBoard'));

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useUserStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const loadUser = useUserStore((s) => s.loadUser);
  const user = useUserStore((s) => s.user);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user?.id) {
      initSocket();
    }

    return () => {
      disconnectSocket();
    };
  }, [user?.id]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <MainLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="projects" element={<ProjectList />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="market" element={<PositionMarket />} />
        <Route path="positions/:id" element={<PositionDetail />} />
        <Route path="candidates" element={<CandidateList />} />
        <Route path="candidates/:id" element={<CandidateDetail />} />
        <Route path="ai" element={<AIAssistant />} />
        <Route path="message-board" element={<Suspense fallback={<div>加载中...</div>}><MessageBoard /></Suspense>} />
        <Route path="settings" element={<Settings />} />
        <Route path="profile" element={<Profile />} />
      </Route>
    </Routes>
  );
}