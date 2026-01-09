import { SparklesIcon } from '@heroicons/react/24/outline';

const ExamAnalytics = ({ subjectStats, totalQuestions, correctCount, wrongCount, score }) => {
  const subjects = Object.values(subjectStats);

  if (subjects.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-text-secondary">No subject-level data available for this exam.</p>
      </div>
    );
  }

  // Separate into strong, medium, and weak
  const strongSubjects = subjects.filter(s => s.status === 'STRONG');
  const mediumSubjects = subjects.filter(s => s.status === 'MEDIUM');
  const weakSubjects = subjects.filter(s => s.status === 'WEAK');

  const getStatusColor = (status) => {
    switch (status) {
      case 'STRONG':
        return 'text-green-500 bg-green-500/10 border-green-500/50';
      case 'MEDIUM':
        return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/50';
      case 'WEAK':
        return 'text-red-500 bg-red-500/10 border-red-500/50';
      default:
        return 'text-muted bg-surface border-border';
    }
  };

  return (
    <div>
      <h3 className="text-xl font-bold text-text mb-2">Exam-Specific Analysis</h3>
      <p className="text-text-secondary text-sm mb-6">
        Performance breakdown by subject for this specific exam only.
      </p>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card border-green-500/50">
          <div className="text-xs text-text-secondary mb-1 uppercase">Strong Subjects</div>
          <div className="text-2xl font-bold text-green-500">{strongSubjects.length}</div>
          <div className="text-xs text-text-secondary mt-1">Accuracy ≥ 80%</div>
        </div>
        <div className="card border-yellow-500/50">
          <div className="text-xs text-text-secondary mb-1 uppercase">Medium Subjects</div>
          <div className="text-2xl font-bold text-yellow-500">{mediumSubjects.length}</div>
          <div className="text-xs text-text-secondary mt-1">Accuracy 50-79%</div>
        </div>
        <div className="card border-red-500/50">
          <div className="text-xs text-text-secondary mb-1 uppercase">Weak Subjects</div>
          <div className="text-2xl font-bold text-red-500">{weakSubjects.length}</div>
          <div className="text-xs text-text-secondary mt-1">Accuracy &lt; 50%</div>
        </div>
      </div>

      {/* Subject Performance */}
      <div className="space-y-4">
        <div>
          <h4 className="text-lg font-semibold text-text mb-3">Weak Subjects (Need Improvement)</h4>
          {weakSubjects.length === 0 ? (
            <div className="card text-center py-4 text-text-secondary text-sm">
              No weak subjects! Great job!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {weakSubjects.map((stats) => (
                <div key={stats.subject} className={`card border-2 ${getStatusColor(stats.status)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-semibold text-text">{stats.subject}</h5>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(stats.status)}`}>
                      {stats.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-text-secondary">Accuracy</div>
                      <div className="font-bold text-text">{stats.accuracy}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-text-secondary">Correct</div>
                      <div className="font-bold text-green-500">{stats.correctCount}</div>
                    </div>
                    <div>
                      <div className="text-xs text-text-secondary">Wrong</div>
                      <div className="font-bold text-red-500">{stats.wrongCount}</div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-text-secondary">
                    Total: {stats.totalAttempted} questions
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h4 className="text-lg font-semibold text-text mb-3">Medium Subjects</h4>
          {mediumSubjects.length === 0 ? (
            <div className="card text-center py-4 text-text-secondary text-sm">
              No medium subjects in this exam.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {mediumSubjects.map((stats) => (
                <div key={stats.subject} className={`card border-2 ${getStatusColor(stats.status)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-semibold text-text">{stats.subject}</h5>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(stats.status)}`}>
                      {stats.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-text-secondary">Accuracy</div>
                      <div className="font-bold text-text">{stats.accuracy}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-text-secondary">Correct</div>
                      <div className="font-bold text-green-500">{stats.correctCount}</div>
                    </div>
                    <div>
                      <div className="text-xs text-text-secondary">Wrong</div>
                      <div className="font-bold text-red-500">{stats.wrongCount}</div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-text-secondary">
                    Total: {stats.totalAttempted} questions
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h4 className="text-lg font-semibold text-text mb-3">Strong Subjects (Well Done!)</h4>
          {strongSubjects.length === 0 ? (
            <div className="card text-center py-4 text-text-secondary text-sm">
              No strong subjects in this exam.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {strongSubjects.map((stats) => (
                <div key={stats.subject} className={`card border-2 ${getStatusColor(stats.status)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-semibold text-text">{stats.subject}</h5>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(stats.status)}`}>
                      {stats.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-text-secondary">Accuracy</div>
                      <div className="font-bold text-text">{stats.accuracy}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-text-secondary">Correct</div>
                      <div className="font-bold text-green-500">{stats.correctCount}</div>
                    </div>
                    <div>
                      <div className="text-xs text-text-secondary">Wrong</div>
                      <div className="font-bold text-red-500">{stats.wrongCount}</div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-text-secondary">
                    Total: {stats.totalAttempted} questions
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExamAnalytics;

