import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExam } from '../../contexts/ExamContext';
import { getIncompleteSessions } from '../../services/examEngine';
import LoadingAnimation from '../Common/LoadingAnimation';
import { format } from 'date-fns';

const ResumeExam = () => {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { resumeExam } = useExam();
  const navigate = useNavigate();

  useEffect(() => {
    loadIncompleteSessions();
  }, []);

  const loadIncompleteSessions = async () => {
    try {
      setIsLoading(true);
      const incompleteSessions = await getIncompleteSessions();
      setSessions(incompleteSessions);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResume = async (sessionId) => {
    try {
      await resumeExam(sessionId);
      navigate('/exam');
    } catch (err) {
      setError(err.message);
    }
  };

  const getModeLabel = (mode) => {
    const labels = {
      'random': 'Random Mode',
      'topic-focused': 'Topic-Focused Mode',
      'weak-area': 'Weak-Area Mode'
    };
    return labels[mode] || mode;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return format(date, 'MMM dd, yyyy HH:mm');
    } catch {
      return 'Unknown';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <LoadingAnimation message="Finding your sessions" size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="card text-red-500">{error}</div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="min-h-screen bg-bg text-text px-4 py-6 pb-24 md:pb-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-text mb-4">No Paused Exams</h2>
          <div className="card text-center py-12">
            <p className="text-text-secondary">You don't have any paused exams. Start a new exam to begin practicing.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text px-4 py-6 pb-24 md:pb-6">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-text mb-2">Resume Exam</h2>
        <p className="text-text-secondary mb-6 text-sm">
          You have {sessions.length} paused exam{sessions.length !== 1 ? 's' : ''}. 
          Click resume to continue from where you left off.
        </p>

        <div className="space-y-4">
          {sessions.map((session) => {
            const answeredCount = Object.keys(session.answers || {}).length;
            const totalQuestions = session.questionIds?.length || 0;
            const progress = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

            return (
              <div key={session.sessionId} className="card">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-text">{getModeLabel(session.mode)}</h3>
                  {session.examId && (
                    <span className="text-xs text-text-secondary">Exam ID: {session.examId}</span>
                  )}
                </div>

                <div className="space-y-2 mb-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-text-secondary">Progress</span>
                      <span className="text-text">{answeredCount} / {totalQuestions} questions</span>
                    </div>
                    <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary-500 transition-all duration-300 rounded-full"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="text-xs text-text-secondary space-y-1">
                    <div>Started: {formatDate(session.startedAt)}</div>
                    <div>Last updated: {formatDate(session.lastUpdated)}</div>
                  </div>

                  {session.config && (
                    <div className="text-xs text-text-secondary space-y-1">
                      {session.config.subject && (
                        <div>Subject: {session.config.subject}</div>
                      )}
                      {session.config.topics && session.config.topics.length > 0 && (
                        <div>Topics: {session.config.topics.join(', ')}</div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  className="btn-primary w-full"
                  onClick={() => handleResume(session.sessionId)}
                >
                  Resume Exam
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ResumeExam;
