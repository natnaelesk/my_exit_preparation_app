import { BookOpenIcon } from '@heroicons/react/24/outline';

const SubjectCard = ({ stats, onClick }) => {
  const { subject, accuracy, totalAttempted, status } = stats;

  const getStatusColor = (status) => {
    switch (status) {
      case 'STRONG':
        return { 
          text: 'text-green-500', 
          bg: 'bg-green-500/10', 
          border: 'border-green-500/30',
          progress: 'bg-green-500'
        };
      case 'MEDIUM':
        return { 
          text: 'text-yellow-500', 
          bg: 'bg-yellow-500/10', 
          border: 'border-yellow-500/30',
          progress: 'bg-yellow-500'
        };
      case 'WEAK':
        return { 
          text: 'text-red-500', 
          bg: 'bg-red-500/10', 
          border: 'border-red-500/30',
          progress: 'bg-red-500'
        };
      default:
        return { 
          text: 'text-muted', 
          bg: 'bg-surface', 
          border: 'border-border',
          progress: 'bg-muted'
        };
    }
  };

  const colors = getStatusColor(status);
  const accuracyValue = totalAttempted > 0 ? (accuracy || 0) : 0;
  const progressWidth = Math.max(0, Math.min(100, accuracyValue));

  return (
    <div 
      onClick={onClick}
      className={`card cursor-pointer hover:border-primary-500/50 transition-all duration-200 active:scale-95 border ${colors.border}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-text line-clamp-2 mb-1 leading-tight">
            {subject}
          </h4>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ml-2 ${colors.text} ${colors.bg}`}>
          {status}
        </span>
      </div>

      {totalAttempted > 0 ? (
        <>
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted">Accuracy</span>
              <span className={`text-lg font-bold ${colors.text}`}>
                {Math.round(accuracyValue)}%
              </span>
            </div>
            <div className="w-full h-2 bg-bg rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${colors.progress}`}
                style={{ width: `${progressWidth}%` }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted flex items-center gap-1">
              <BookOpenIcon className="w-3 h-3" />
              {totalAttempted} attempts
            </span>
          </div>
        </>
      ) : (
        <div className="text-xs text-muted py-2 text-center">
          Not attempted yet
        </div>
      )}
    </div>
  );
};

export default SubjectCard;
