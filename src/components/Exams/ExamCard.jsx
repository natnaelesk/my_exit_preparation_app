import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getQuestionsByIds } from '../../services/questionService';
import { getExamSessions } from '../../services/examEngine';
import { format } from 'date-fns';
import { BookOpenIcon, PlayIcon, ArrowPathIcon, ChevronRightIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

const ExamCard = ({ exam, onStart, onResume, onRestart }) => {
  const navigate = useNavigate();
  const [subjectBreakdown, setSubjectBreakdown] = useState({});
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    loadExamDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam.examId]);

  const loadExamDetails = async () => {
    try {
      // Load progress
      const sessions = await getExamSessions(exam.examId);
      let currentProgress = null;
      
      if (sessions.length > 0) {
        const latestSession = sessions[0];
        const answeredCount = Object.keys(latestSession.answers || {}).length;
        const totalQuestions = latestSession.questionIds?.length || 0;
        const progressPercent = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

        currentProgress = {
          sessionId: latestSession.sessionId,
          answeredCount,
          totalQuestions,
          progressPercent: Math.round(progressPercent),
          isComplete: latestSession.isComplete || false,
          hasProgress: answeredCount > 0,
          lastAttempt: latestSession.lastUpdated
        };
        
        setProgress(currentProgress);
      }

      // Load subject breakdown
      if (exam.questionIds && exam.questionIds.length > 0) {
        setIsLoadingStats(true);
        const questions = await getQuestionsByIds(exam.questionIds);
        const subjects = {};
        questions.forEach(q => {
          if (!subjects[q.subject]) {
            subjects[q.subject] = 0;
          }
          subjects[q.subject]++;
        });
        setSubjectBreakdown(subjects);
      }
    } catch (error) {
      console.error('Error loading exam details:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return format(date, 'MMM dd, yyyy');
    } catch {
      return 'Unknown';
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return format(date, 'MMM dd, HH:mm');
    } catch {
      return '';
    }
  };

  const totalQuestions = exam.questionIds?.length || 0;
  const subjectCount = Object.keys(subjectBreakdown).length;
  const hasProgress = progress && progress.hasProgress;
  const isComplete = progress && progress.isComplete;

  const handleCardClick = (e) => {
    // Don't navigate if clicking on action buttons
    if (e.target.closest('button')) {
      return;
    }
    navigate(`/exams/${exam.examId}`);
  };

  return (
    <div 
      className="card transition-all duration-300 hover:shadow-xl hover:scale-[1.02] hover:border-primary-500/50 cursor-pointer"
      onClick={handleCardClick}
    >
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg md:text-xl font-bold text-text flex-1 mr-2 leading-tight">
            {exam.title}
          </h3>
          {exam.createdAt && (
            <span className="text-xs text-muted whitespace-nowrap bg-surface px-2 py-1 rounded-lg">
              {formatDate(exam.createdAt)}
            </span>
          )}
        </div>
        
        {/* Quick Stats Row */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <BookOpenIcon className="w-5 h-5 text-muted" />
            <span className="text-muted">Questions:</span>
            <span className="font-bold text-text">{totalQuestions}</span>
          </div>
          {subjectCount > 0 && (
            <div className="flex items-center gap-1.5">
              <BookOpenIcon className="w-5 h-5 text-muted" />
              <span className="text-muted">Subjects:</span>
              <span className="font-bold text-text">{subjectCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress Section */}
      {hasProgress && (
        <div className="mb-4 p-3 bg-surface rounded-lg border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted uppercase tracking-wide">
              Your Progress
            </span>
            <span className={`text-sm font-bold ${isComplete ? 'text-green-500' : 'text-primary-500'}`}>
              {progress.progressPercent}%
            </span>
          </div>
          <div className="w-full h-2.5 bg-bg rounded-full overflow-hidden mb-2">
            <div 
              className={`h-full transition-all duration-500 rounded-full ${
                isComplete ? 'bg-green-500' : 'bg-primary-500'
              }`}
              style={{ width: `${progress.progressPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted">
            <span>
              {progress.answeredCount} of {progress.totalQuestions} answered
            </span>
            {progress.lastAttempt && (
              <span className="text-xs">
                Last: {formatTime(progress.lastAttempt)}
              </span>
            )}
          </div>
          {isComplete && (
            <div className="mt-2 pt-2 border-t border-border">
              <span className="text-xs font-semibold text-green-500 flex items-center gap-1"><CheckCircleIcon className="w-3 h-3" /> Exam Completed</span>
            </div>
          )}
        </div>
      )}

      {/* Subject Breakdown Preview */}
      {subjectCount > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(subjectBreakdown).slice(0, 3).map(([subject, count]) => (
              <div key={subject} className="text-xs bg-surface px-2 py-1 rounded border border-border">
                <span className="text-muted">{subject.split(' ')[0]}:</span>
                <span className="font-semibold text-text ml-1">{count}</span>
              </div>
            ))}
            {subjectCount > 3 && (
              <div className="text-xs text-primary-500 font-medium">
                +{subjectCount - 3} more
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-3 border-t border-border" onClick={(e) => e.stopPropagation()}>
        {/* Main Action Button */}
        {hasProgress && !isComplete ? (
          <button
            className="btn-primary flex-1 font-semibold flex items-center justify-center gap-2"
            onClick={(e) => {
              e.stopPropagation();
              onResume(progress.sessionId);
            }}
          >
            <PlayIcon className="w-4 h-4" />
            Resume
          </button>
        ) : (
          <button
            className="btn-primary flex-1 font-semibold flex items-center justify-center gap-2"
            onClick={(e) => {
              e.stopPropagation();
              onStart(exam.examId);
            }}
          >
            <PlayIcon className="w-4 h-4" />
            {isComplete ? 'Restart' : 'Start'}
          </button>
        )}

        {/* Secondary Action (Restart if completed) */}
        {isComplete && (
          <button
            className="btn-secondary px-4"
            onClick={(e) => {
              e.stopPropagation();
              onRestart(exam.examId);
            }}
            title="Start a new attempt"
          >
            <ArrowPathIcon className="w-5 h-5" />
          </button>
        )}

        {/* View Details Button */}
        <button
          className="btn-secondary px-3"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/exams/${exam.examId}`);
          }}
          title="View details"
        >
          <ChevronRightIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default ExamCard;

