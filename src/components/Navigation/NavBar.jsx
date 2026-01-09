import { Link, useLocation } from 'react-router-dom';
import ThemeToggle from '../Theme/ThemeToggle';

const NavBar = () => {
  const location = useLocation();

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <nav className="bg-card border-b border-border sticky top-0 z-40 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="text-xl font-bold text-primary-500">
            Exit Exam Prep
          </Link>

          <div className="hidden md:flex items-center space-x-6">
            <Link 
              to="/" 
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/') 
                  ? 'text-primary-500 bg-surface' 
                  : 'text-muted hover:text-text'
              }`}
            >
              Dashboard
            </Link>
            <Link 
              to="/exams" 
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/exams') 
                  ? 'text-primary-500 bg-surface' 
                  : 'text-muted hover:text-text'
              }`}
            >
              Exams
            </Link>
            <Link 
              to="/plan" 
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/plan') 
                  ? 'text-primary-500 bg-surface' 
                  : 'text-muted hover:text-text'
              }`}
            >
              Plan
            </Link>
            <Link 
              to="/analytics" 
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/analytics') 
                  ? 'text-primary-500 bg-surface' 
                  : 'text-muted hover:text-text'
              }`}
            >
              Analysis
            </Link>
          </div>

          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
