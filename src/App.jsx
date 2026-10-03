import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { ExamProvider } from './contexts/ExamContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthPage from './components/Auth/AuthPage';
import RequireAuth from './components/Auth/RequireAuth';
import ServerStatusBanner from './components/Common/ServerStatusBanner';
import Sidebar from './components/Navigation/Sidebar';
import BottomNav from './components/Navigation/BottomNav';
import Dashboard from './components/Dashboard/Dashboard';
import ExamInterface from './components/Exam/ExamInterface';
import ExamResults from './components/Results/ExamResults';
import AnalyticsDashboard from './components/Analytics/AnalyticsDashboard';
import TopicFocusedMode from './components/Exam/TopicFocusedMode';
import ExamsList from './components/Exams/ExamsList';
import CreateExam from './components/Exams/CreateExam';
import ExamDetail from './components/Exams/ExamDetail';
import PlanPage from './components/Plan/PlanPage';
import ChecklistPage from './components/Plan/ChecklistPage';
import ResetData from './components/Admin/ResetData';
import QuestionBank from './components/Bank/QuestionBank';
import StudyPage from './components/Study/StudyPage';
import StudySessionPage from './components/Study/StudySessionPage';

function AppContent() {
  const location = useLocation();
  const showBottomNav = !['/exam', '/results'].includes(location.pathname) && !location.pathname.startsWith('/exams/');
  const showSidebar = !['/exam', '/results'].includes(location.pathname);

  return (
    <div className="min-h-screen bg-bg text-text flex">
      {/* Vertical Sidebar - Desktop only */}
      {showSidebar && (
        <div className="hidden md:block">
          <Sidebar />
        </div>
      )}
      
      {/* Main Content */}
      <main className={`flex-1 ${showSidebar ? 'md:ml-64' : ''} ${location.pathname === '/analytics' ? '' : 'pb-20 md:pb-0'}`}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/exam" element={<ExamInterface />} />
          <Route path="/results" element={<ExamResults />} />
          <Route path="/analytics" element={<AnalyticsDashboard />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/plan-manager" element={<ChecklistPage />} />
          <Route path="/study" element={<StudyPage />} />
          <Route path="/study/sessions/:sessionId" element={<StudySessionPage />} />
          <Route path="/bank" element={<QuestionBank />} />
          <Route path="/admin/reset" element={<ResetData />} />
                  <Route path="/topic-focused" element={<TopicFocusedMode />} />
                  <Route path="/exams" element={<ExamsList />} />
                  <Route path="/exams/create" element={<CreateExam />} />
                  <Route path="/exams/:examId" element={<ExamDetail />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Bottom Navigation - Mobile only */}
      {showBottomNav && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
          <BottomNav />
        </div>
      )}
    </div>
  );
}

function AuthenticatedApp() {
  const { user } = useAuth();

  // Keyed by user so in-memory exam state never carries over between accounts.
  return (
    <ExamProvider key={user.id}>
      <AppContent />
    </ExamProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Router
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true
          }}
        >
          <ServerStatusBanner />
          <Routes>
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/signup" element={<AuthPage mode="signup" />} />
            <Route
              path="/*"
              element={
                <RequireAuth>
                  <AuthenticatedApp />
                </RequireAuth>
              }
            />
          </Routes>
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
