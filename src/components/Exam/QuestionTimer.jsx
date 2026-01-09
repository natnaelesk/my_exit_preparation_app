import { useEffect, useState } from 'react';

const QuestionTimer = ({ timePerQuestion, onTimeUp, isActive }) => {
  const [timeLeft, setTimeLeft] = useState(timePerQuestion || 60);

  useEffect(() => {
    if (!isActive || !timePerQuestion) {
      return;
    }

    setTimeLeft(timePerQuestion);

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (onTimeUp) {
            onTimeUp();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timePerQuestion, isActive, onTimeUp]);

  useEffect(() => {
    if (isActive && timePerQuestion) {
      setTimeLeft(timePerQuestion);
    }
  }, [isActive, timePerQuestion]);

  if (!timePerQuestion) {
    return null;
  }

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const percentage = timePerQuestion > 0 ? (timeLeft / timePerQuestion) * 100 : 0;
  const isWarning = timeLeft <= 10;
  const isCritical = timeLeft <= 5;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-medium ${isCritical ? 'text-red-500' : isWarning ? 'text-yellow-500' : 'text-text-secondary'}`}>
          Time Remaining
        </span>
        <span className={`text-sm font-bold ${isCritical ? 'text-red-500' : isWarning ? 'text-yellow-500' : 'text-primary-500'}`}>
          {minutes}:{seconds.toString().padStart(2, '0')}
        </span>
      </div>
      <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-1000 rounded-full ${
            isCritical 
              ? 'bg-red-500' 
              : isWarning 
                ? 'bg-yellow-500' 
                : 'bg-primary-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default QuestionTimer;

