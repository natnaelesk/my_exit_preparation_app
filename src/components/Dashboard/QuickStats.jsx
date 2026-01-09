import { useMemo } from 'react';
import { TrophyIcon, CheckCircleIcon, XCircleIcon, AcademicCapIcon, ChartBarIcon } from '@heroicons/react/24/outline';

const QuickStats = ({ subjectStats }) => {
  const stats = useMemo(() => {
    const allStats = Object.values(subjectStats);
    const totalAttempted = allStats.reduce((sum, s) => sum + (s.totalAttempted || 0), 0);
    const totalCorrect = allStats.reduce((sum, s) => sum + (s.correctCount || 0), 0);
    const totalWrong = allStats.reduce((sum, s) => sum + (s.wrongCount || 0), 0);
    const overallAccuracy = totalAttempted > 0 
      ? Math.round((totalCorrect / totalAttempted) * 100 * 100) / 100 
      : 0;
    
    const strongCount = allStats.filter(s => s.status === 'STRONG').length;
    const mediumCount = allStats.filter(s => s.status === 'MEDIUM').length;
    const weakCount = allStats.filter(s => s.status === 'WEAK').length;

    return {
      totalAttempted,
      totalCorrect,
      totalWrong,
      overallAccuracy,
      strongCount,
      mediumCount,
      weakCount
    };
  }, [subjectStats]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      {/* Overall Accuracy - Featured */}
      <div className="card bg-gradient-to-br from-primary-500/20 to-primary-600/10 border-primary-500/30 text-center">
        <div className="flex items-center justify-center mb-2">
          <ChartBarIcon className="w-5 h-5 text-primary-500" />
        </div>
        <div className="text-xs text-muted mb-1 uppercase tracking-wide">Accuracy</div>
        <div className="text-2xl md:text-3xl font-bold text-primary-500">
          {stats.totalAttempted > 0 ? `${stats.overallAccuracy}%` : '0%'}
        </div>
        <div className="text-xs text-muted mt-1">
          {stats.totalAttempted} attempted
        </div>
      </div>

      {/* Questions Attempted */}
      <div className="card bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30 text-center">
        <div className="flex items-center justify-center mb-2">
          <AcademicCapIcon className="w-5 h-5 text-blue-500" />
        </div>
        <div className="text-xs text-muted mb-1 uppercase tracking-wide">Attempted</div>
        <div className="text-2xl md:text-3xl font-bold text-blue-500">{stats.totalAttempted}</div>
        <div className="text-xs text-muted mt-1">questions</div>
      </div>

      {/* Correct Answers */}
      <div className="card bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30 text-center">
        <div className="flex items-center justify-center mb-2">
          <CheckCircleIcon className="w-5 h-5 text-green-500" />
        </div>
        <div className="text-xs text-muted mb-1 uppercase tracking-wide">Correct</div>
        <div className="text-2xl md:text-3xl font-bold text-green-500">{stats.totalCorrect}</div>
        <div className="text-xs text-muted mt-1">
          {stats.totalAttempted > 0 ? Math.round((stats.totalCorrect / stats.totalAttempted) * 100) : 0}% rate
        </div>
      </div>

      {/* Strong Subjects */}
      <div className="card bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30 text-center">
        <div className="flex items-center justify-center mb-2">
          <TrophyIcon className="w-5 h-5 text-green-500" />
        </div>
        <div className="text-xs text-muted mb-1 uppercase tracking-wide">Strong</div>
        <div className="text-2xl md:text-3xl font-bold text-green-500">{stats.strongCount}</div>
        <div className="text-xs text-muted mt-1">subjects</div>
      </div>

      {/* Weak Subjects */}
      <div className="card bg-gradient-to-br from-red-500/20 to-red-600/10 border-red-500/30 text-center">
        <div className="flex items-center justify-center mb-2">
          <XCircleIcon className="w-5 h-5 text-red-500" />
        </div>
        <div className="text-xs text-muted mb-1 uppercase tracking-wide">Weak</div>
        <div className="text-2xl md:text-3xl font-bold text-red-500">{stats.weakCount}</div>
        <div className="text-xs text-muted mt-1">subjects</div>
      </div>
    </div>
  );
};

export default QuickStats;
