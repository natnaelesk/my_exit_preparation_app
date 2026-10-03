import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const AuthPage = ({ mode }) => {
  const isSignup = mode === 'signup';
  const { user, login, signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from?.pathname || '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    if (isSignup && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSignup) {
        await signup({ username: username.trim(), password });
      } else {
        await login({ username: username.trim(), password });
      }
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold">E</span>
          </div>
          <span className="text-xl font-bold text-primary-500">Exit Exam Prep</span>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <h1 className="text-lg font-bold text-text">
              {isSignup ? 'Create your account' : 'Welcome back'}
            </h1>
            <p className="text-sm text-muted mt-1">
              {isSignup
                ? 'Your exams, questions and plans stay private to you.'
                : 'Log in to continue your exit exam practice.'}
            </p>
          </div>

          <div>
            <label htmlFor="auth-username" className="block text-sm font-medium text-text mb-1">Username</label>
            <input
              id="auth-username"
              className="input"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="block text-sm font-medium text-text mb-1">Password</label>
            <input
              id="auth-password"
              type="password"
              className="input"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {isSignup && (
              <p className="text-xs text-muted mt-1">At least 8 characters, not too common or all numbers.</p>
            )}
          </div>

          {isSignup && (
            <div>
              <label htmlFor="auth-confirm-password" className="block text-sm font-medium text-text mb-1">Confirm password</label>
              <input
                id="auth-confirm-password"
                type="password"
                className="input"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500 rounded-lg p-3 text-sm text-red-400" role="alert">
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
            {isSubmitting
              ? (isSignup ? 'Creating account...' : 'Logging in...')
              : (isSignup ? 'Sign up' : 'Log in')}
          </button>

          <p className="text-sm text-muted text-center">
            {isSignup ? 'Already have an account? ' : 'New here? '}
            <Link
              to={isSignup ? '/login' : '/signup'}
              state={location.state}
              className="text-primary-500 font-medium hover:underline"
            >
              {isSignup ? 'Log in' : 'Create an account'}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default AuthPage;
