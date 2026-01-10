import { Link, useLocation } from 'react-router-dom';
import ThemeToggle from '../Theme/ThemeToggle';
import { 
  HomeIcon, 
  BookOpenIcon, 
  ChartBarIcon, 
  CalendarDaysIcon,
  RectangleStackIcon
} from '@heroicons/react/24/outline';

const Sidebar = () => {
  const location = useLocation();

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const navItems = [
    { path: '/', icon: HomeIcon, label: 'Dashboard' },
    { path: '/exams', icon: BookOpenIcon, label: 'Exams' },
    { path: '/bank', icon: RectangleStackIcon, label: 'Question Bank' },
    { path: '/plan', icon: CalendarDaysIcon, label: 'Plan' },
    { path: '/analytics', icon: ChartBarIcon, label: 'Analytics' },
  ];

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-card border-r border-border z-50 flex flex-col">
      {/* Logo/Brand */}
      <div className="h-16 flex items-center justify-start px-6 border-b border-border">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">E</span>
          </div>
          <span className="text-lg font-bold text-primary-500">Exit Exam Prep</span>
        </Link>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 py-4 px-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group ${
                active
                  ? 'bg-primary-500/10 text-primary-500 border-l-2 border-primary-500'
                  : 'text-muted hover:text-text hover:bg-surface'
              }`}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-primary-500' : ''}`} />
              <span className={`font-medium text-sm ${active ? 'text-primary-500' : ''}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Theme Toggle */}
      <div className="border-t border-border p-4">
        <div className="flex items-center justify-start gap-3 px-3 py-2 rounded-lg hover:bg-surface transition-colors">
          <ThemeToggle />
          <span className="text-sm text-muted">Theme</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;

