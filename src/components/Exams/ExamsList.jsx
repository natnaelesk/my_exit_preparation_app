import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllExams } from '../../services/examService';
import { resumeExamSession } from '../../services/examEngine';
import { useExam } from '../../contexts/ExamContext';
import ExamConfig from './ExamConfig';
import ExamCard from './ExamCard';
import { BookOpenIcon } from '@heroicons/react/24/outline';

const ExamsList = () => {
  const [exams, setExams] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [configExamId, setConfigExamId] = useState(null);
  const { resumeExam } = useExam();
  const navigate = useNavigate();

  useEffect(() => {
    loadExams();
  }, []);

  const loadExams = async () => {
    try {
      setIsLoading(true);
      const allExams = await getAllExams();
      setExams(allExams);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartExam = (examId) => {
    // Show configuration modal
    setConfigExamId(examId);
  };

  const handleResumeExam = async (sessionId) => {
    try {
      await resumeExam(sessionId);
      navigate('/exam');
    } catch (err) {
      alert('Error resuming exam: ' + err.message);
    }
  };

  const handleRestartExam = (examId) => {
    if (window.confirm('Are you sure you want to restart this exam? This will start a new attempt. Your previous attempts and analysis data will be preserved.')) {
      // Show configuration modal for restart
      setConfigExamId(examId);
    }
  };


  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-muted">Loading exams...</div>
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

  return (
    <div className="min-h-screen bg-bg text-text px-4 py-6 pb-24 md:pb-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-text">All Exams</h2>
          <button 
            className="btn-primary text-sm"
            onClick={() => navigate('/exams/create')}
          >
            + Create
          </button>
        </div>

        {exams.length === 0 ? (
          <div className="card text-center py-12">
            <BookOpenIcon className="w-16 h-16 mx-auto mb-4 text-muted" />
            <p className="text-muted mb-4 text-lg">No exams available yet</p>
            <p className="text-muted mb-6 text-sm">Create your first exam to get started practicing!</p>
            <button 
              className="btn-primary"
              onClick={() => navigate('/exams/create')}
            >
              + Create Your First Exam
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {exams.map((exam) => (
              <ExamCard
                key={exam.examId}
                exam={exam}
                onStart={handleStartExam}
                onResume={handleResumeExam}
                onRestart={handleRestartExam}
              />
            ))}
          </div>
        )}
      </div>

      {/* Exam Configuration Modal */}
      {configExamId && (
        <ExamConfig
          examId={configExamId}
          onClose={() => setConfigExamId(null)}
        />
      )}
    </div>
  );
};

export default ExamsList;
