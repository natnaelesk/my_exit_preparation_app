const ExamProgress = ({ current, total, progress }) => {
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-text-secondary mb-1">
        <span>{current} / {total} questions</span>
        <span className="text-primary-500 font-semibold">{Math.round(progress)}%</span>
      </div>
      <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary-500 transition-all duration-300 rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export default ExamProgress;
