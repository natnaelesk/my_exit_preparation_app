import { Link, useLocation } from 'react-router-dom';
import ThemeToggle from '../Theme/ThemeToggle';
import { HomeIcon, BookOpenIcon, ChartBarIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';

const BottomNav = () => {
  const location = useLocation();

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const navItems = [
    { path: '/', icon: HomeIcon, label: 'Home', exact: true },
    { path: '/exams', icon: BookOpenIcon, label: 'Exams' },
    { path: '/plan', icon: CalendarDaysIcon, label: 'Plan' },
    { path: '/analytics', icon: ChartBarIcon, label: 'Analysis' },
  ];

  return (
    <nav className="bg-card border-t border-border shadow-2xl safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors duration-200 relative ${
                active
                  ? 'text-primary-500'
                  : 'text-muted'
              }`}
            >
              <item.icon className="w-6 h-6 mb-0.5" />
              <span className={`text-[10px] font-medium ${active ? 'text-primary-500' : ''}`}>
                {item.label}
              </span>
              {active && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-10 h-0.5 bg-primary-500 rounded-b-full" />
              )}
            </Link>
          );
        })}
        <div className="flex flex-col items-center justify-center flex-1 h-full">
          <ThemeToggle />
          <span className="text-[10px] font-medium text-muted mt-0.5">Theme</span>
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
