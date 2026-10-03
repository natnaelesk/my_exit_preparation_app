import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingAnimation from '../Common/LoadingAnimation';

const RequireAuth = ({ children }) => {
  const { user, status, sessionError, retrySession, discardSession } = useAuth();
  const location = useLocation();

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <LoadingAnimation message="Signing you in" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-bg text-text flex items-center justify-center p-4">
        <div className="card max-w-sm w-full space-y-4 text-center">
          <h1 className="text-lg font-bold">Can't reach the server</h1>
          <p className="text-sm text-muted">
            {sessionError?.message || 'The server did not respond. Please try again.'}
          </p>
          <div className="flex gap-3">
            <button className="btn-primary flex-1" onClick={retrySession}>Retry</button>
            <button className="btn-secondary flex-1" onClick={discardSession}>Log in again</button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
};

export default RequireAuth;
