import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import LoadingAnimation from '../Common/LoadingAnimation';
import QuestionReview from './QuestionReview';
import ExamAnalytics from './ExamAnalytics';
import { formatDuration } from '../../utils/analyticsHelpers';
import { calculateExamSubjectStats } from '../../services/analyticsService';

const ExamResults = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [results, setResults] = useState(null);
  const [wrongQuestions, setWrongQuestions] = useState([]);
  const [correctQuestions, setCorrectQuestions] = useState([]);
  const [examSubjectStats, setExamSubjectStats] = useState({});
  const [activeTab, setActiveTab] = useState('wrong'); // 'wrong', 'correct', 'analytics'
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Try to get exam data from location state first, then sessionStorage
    let examData = location.state?.examData;
    
    if (!examData) {
      const stored = sessionStorage.getItem('examResults');
      if (stored) {
        try {
          examData = JSON.parse(stored);
          console.log('Loaded exam data from sessionStorage:', examData);
        } catch (err) {
          console.error('Error parsing exam data from sessionStorage:', err);
        }
      }
    }
    
    if (!examData || !examData.questions || examData.questions.length === 0) {
      console.error('No exam data found, redirecting to dashboard');
      navigate('/', { replace: true });
      return;
    }

    console.log('Loading results with examData:', examData);
    loadResults(examData);
    // Clear sessionStorage after loading (but keep it in case of errors)
    setTimeout(() => {
      sessionStorage.removeItem('examResults');
    }, 1000);
  }, [location, navigate]);

  const loadResults = async (examData) => {
    try {
      setIsLoading(true);
      const { questions, answers, timeSpent, examId } = examData;

      let correctCount = 0;
      let wrongCount = 0;
      const wrongQuestionIds = [];
      const correctQuestionIds = [];

      questions.forEach((question) => {
        const selectedAnswer = answers[question.questionId];
        if (selectedAnswer) {
          if (selectedAnswer === question.correctAnswer) {
            correctCount++;
            correctQuestionIds.push(question.questionId);
          } else {
            wrongCount++;
            wrongQuestionIds.push(question.questionId);
          }
        }
      });

      const totalQuestions = questions.length;
      const score = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
      const totalTime = Object.values(timeSpent || {}).reduce((sum, time) => sum + time, 0);

      const wrongQuestionsData = questions.filter(q => 
        wrongQuestionIds.includes(q.questionId)
      ).map(q => ({
        ...q,
        selectedAnswer: answers[q.questionId],
        timeSpent: timeSpent[q.questionId] || 0,
        isCorrect: false
      }));

      const correctQuestionsData = questions.filter(q => 
        correctQuestionIds.includes(q.questionId)
      ).map(q => ({
        ...q,
        selectedAnswer: answers[q.questionId],
        timeSpent: timeSpent[q.questionId] || 0,
        isCorrect: true
      }));

      setResults({
        totalQuestions,
        correctCount,
        wrongCount,
        score: Math.round(score * 100) / 100,
        totalTime,
        examId
      });

      setWrongQuestions(wrongQuestionsData);
      setCorrectQuestions(correctQuestionsData);

      // Load exam-specific analytics if examId is available
      if (examId) {
        try {
          const stats = await calculateExamSubjectStats(examId);
          setExamSubjectStats(stats);
        } catch (error) {
          console.error('Error loading exam analytics:', error);
        }
      }
    } catch (error) {
      console.error('Error loading results:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <LoadingAnimation message="Loading results" size="large" />
      </div>
    );
  }

  if (!results) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="card text-red-500">No results available</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text px-4 py-6 pb-24 md:pb-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-text">Exam Results</h2>
          <button className="btn-secondary" onClick={() => navigate('/')}>
            Back to Dashboard
          </button>
        </div>

        {/* Score Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="card text-center">
            <div className="text-xs text-text-secondary mb-1 uppercase">Total</div>
            <div className="text-2xl font-bold text-text">{results.totalQuestions}</div>
          </div>
          <div className="card text-center border-green-500/50">
            <div className="text-xs text-text-secondary mb-1 uppercase">Correct</div>
            <div className="text-2xl font-bold text-green-500">{results.correctCount}</div>
          </div>
          <div className="card text-center border-red-500/50">
            <div className="text-xs text-text-secondary mb-1 uppercase">Wrong</div>
            <div className="text-2xl font-bold text-red-500">{results.wrongCount}</div>
          </div>
          <div className="card text-center border-primary-500/50">
            <div className="text-xs text-text-secondary mb-1 uppercase">Score</div>
            <div className="text-2xl font-bold text-primary-500">{results.score}%</div>
          </div>
          <div className="card text-center">
            <div className="text-xs text-text-secondary mb-1 uppercase">Time</div>
            <div className="text-2xl font-bold text-text">{formatDuration(results.totalTime)}</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          <button
            className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
              activeTab === 'wrong'
                ? 'bg-red-500 text-white'
                : 'bg-card text-text-secondary hover:text-text'
            } ${wrongQuestions.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => setActiveTab('wrong')}
            disabled={wrongQuestions.length === 0}
          >
            Wrong Answers ({wrongQuestions.length})
          </button>
          <button
            className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
              activeTab === 'correct'
                ? 'bg-green-500 text-white'
                : 'bg-card text-text-secondary hover:text-text'
            } ${correctQuestions.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => setActiveTab('correct')}
            disabled={correctQuestions.length === 0}
          >
            Correct Answers ({correctQuestions.length})
          </button>
          <button
            className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
              activeTab === 'analytics'
                ? 'bg-primary-500 text-white'
                : 'bg-card text-text-secondary hover:text-text'
            }`}
            onClick={() => setActiveTab('analytics')}
          >
            Exam Analysis
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'wrong' && (
          <QuestionReview 
            questions={wrongQuestions} 
            title="Wrong Answers Review"
            type="wrong"
          />
        )}

        {activeTab === 'correct' && (
          <QuestionReview 
            questions={correctQuestions} 
            title="Correct Answers Review"
            type="correct"
          />
        )}

        {activeTab === 'analytics' && (
          <ExamAnalytics 
            subjectStats={examSubjectStats}
            totalQuestions={results.totalQuestions}
            correctCount={results.correctCount}
            wrongCount={results.wrongCount}
            score={results.score}
          />
        )}
      </div>
    </div>
  );
};

export default ExamResults;

