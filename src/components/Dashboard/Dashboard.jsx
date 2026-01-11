import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExam } from '../../contexts/ExamContext';
import { calculateSubjectStats, calculateOverallTrend } from '../../services/analyticsService';
import { getAllExams } from '../../services/examService';
import { getExamSessions } from '../../services/examEngine';
import SubjectCard from './SubjectCard';
import QuickStats from './QuickStats';
import LoadingAnimation from '../Common/LoadingAnimation';
import ButtonLoading from '../Common/ButtonLoading';
import { EXAM_MODES, OFFICIAL_SUBJECTS } from '../../utils/constants';
import { format } from 'date-fns';
import { 
  AcademicCapIcon, 
  ChartBarIcon, 
  FireIcon, 
  BoltIcon,
  BookOpenIcon,
  ArrowRightIcon,
  PlayIcon,
  ClockIcon,
  TrophyIcon,
  ArrowTrendingUpIcon,
  SparklesIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

const Dashboard = () => {
  const [subjectStats, setSubjectStats] = useState({});
  const [recentExams, setRecentExams] = useState([]);
  const [overallTrend, setOverallTrend] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [startingMode, setStartingMode] = useState(null);
  const { startExam } = useExam();
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      
      // Load stats and recent exams in parallel
      const [stats, exams, trend] = await Promise.all([
        calculateSubjectStats(),
        getAllExams(),
        calculateOverallTrend()
      ]);
      
      setSubjectStats(stats);
      setOverallTrend(trend);
      
      // Load progress for recent exams
      const examsWithProgress = await Promise.all(
        exams.slice(0, 3).map(async (exam) => {
          try {
            const sessions = await getExamSessions(exam.examId);
            if (sessions.length > 0) {
              const latestSession = sessions[0];
              const answeredCount = Object.keys(latestSession.answers || {}).length;
              const totalQuestions = latestSession.questionIds?.length || 0;
              const progressPercent = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;
              
              return {
                ...exam,
                progress: {
                  answeredCount,
                  totalQuestions,
                  progressPercent: Math.round(progressPercent),
                  isComplete: latestSession.isComplete || false,
                  lastActivity: latestSession.lastUpdated
                }
              };
            }
          } catch (err) {
            console.error(`Error loading progress for exam ${exam.examId}:`, err);
          }
          return { ...exam, progress: null };
        })
      );
      
      setRecentExams(examsWithProgress);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartExam = async (mode, config = {}) => {
    try {
      setIsStarting(true);
      setStartingMode(mode);
      await startExam(mode, config);
      navigate('/exam');
    } catch (error) {
      console.error('Error starting exam:', error);
      alert('Error starting exam: ' + error.message);
      setIsStarting(false);
      setStartingMode(null);
    }
  };

  const handleStartRandom = () => {
    handleStartExam(EXAM_MODES.RANDOM);
  };

  const handleStartWeakArea = () => {
    handleStartExam(EXAM_MODES.WEAK_AREA);
  };

  // Calculate overall stats
  const overallStats = Object.values(subjectStats).reduce((acc, stat) => {
    if (stat && stat.totalAttempted > 0) {
      acc.totalAttempted += stat.totalAttempted || 0;
      acc.totalCorrect += stat.correctCount || 0;
      acc.totalWrong += stat.wrongCount || 0;
    }
    return acc;
  }, { totalAttempted: 0, totalCorrect: 0, totalWrong: 0 });

  const overallAccuracy = overallStats.totalAttempted > 0 
    ? Math.round((overallStats.totalCorrect / overallStats.totalAttempted) * 100)
    : 0;

  const subjectsWithData = Object.values(subjectStats).filter(s => s && s.totalAttempted > 0);
  const strongCount = subjectsWithData.filter(s => s.status === 'STRONG').length;
  const weakCount = subjectsWithData.filter(s => s.status === 'WEAK').length;

  // Get recent trend data for mini graph
  const recentTrendData = overallTrend.slice(-7).map(item => ({
    ...item,
    accuracy: isNaN(item.accuracy) || !isFinite(item.accuracy) ? 0 : Math.max(0, Math.min(100, item.accuracy))
  }));

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return format(date, 'MMM dd, yyyy');
    } catch {
      return 'Unknown';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center pb-24 md:pb-6">
        <LoadingAnimation message="Loading your dashboard" size="large" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text px-4 py-6 pb-24 md:pb-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Hero Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-text mb-2 bg-gradient-to-r from-primary-500 to-primary-600 bg-clip-text text-transparent">
                Exit Exam Preparation
              </h1>
              <p className="text-muted text-sm md:text-base">
                Master the Ethiopian Computer Science BSc Exit Exam with intelligent practice
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="btn-secondary flex items-center gap-2"
                onClick={() => navigate('/exams/create')}
              >
                <BookOpenIcon className="w-4 h-4" />
                Create Exam
              </button>
              <button
                className="btn-secondary flex items-center gap-2"
                onClick={() => navigate('/analytics')}
              >
                <ChartBarIcon className="w-4 h-4" />
                Analytics
              </button>
            </div>
          </div>
        </div>

        {/* Enhanced Quick Stats */}
        <QuickStats subjectStats={subjectStats} />

        {/* Performance Trend Card */}
        {recentTrendData.length > 0 && (
          <div className="bg-gradient-to-br from-card to-surface rounded-xl p-6 border border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ArrowTrendingUpIcon className="w-5 h-5 text-primary-500" />
                <h3 className="text-lg font-bold text-text">Performance Trend</h3>
              </div>
              <button
                className="text-sm text-primary-500 hover:text-primary-400 flex items-center gap-1"
                onClick={() => navigate('/analytics')}
              >
                View Full <ArrowRightIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-2 h-24">
              {recentTrendData.map((item, index) => {
                const height = Math.max(10, (item.accuracy / 100) * 100);
                return (
                  <div key={index} className="flex flex-col items-center justify-end gap-1">
                    <div
                      className="w-full rounded-t transition-all duration-300 bg-gradient-to-t from-primary-500 to-primary-400 hover:from-primary-400 hover:to-primary-300"
                      style={{ height: `${height}%` }}
                      title={`${item.dateDisplay}: ${Math.round(item.accuracy)}%`}
                    />
                    <span className="text-xs text-muted">{item.dateDisplay}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Exam Modes - Enhanced */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl md:text-2xl font-bold text-text flex items-center gap-2">
              <BoltIcon className="w-6 h-6 text-primary-500" />
              Start Practice Exam
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Random Mode */}
            <div className="card hover:border-primary-500/50 transition-all duration-200 group">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-primary-500/10 rounded-lg">
                  <PlayIcon className="w-5 h-5 text-primary-500" />
                </div>
                <h3 className="text-lg font-semibold text-text">Random Mode</h3>
              </div>
              <p className="text-muted text-sm mb-4">
                Practice with randomly selected questions from all subjects
              </p>
              <button 
                className="btn-primary w-full flex items-center justify-center gap-2 group-hover:scale-105 transition-transform"
                onClick={handleStartRandom}
                disabled={isStarting}
              >
                {isStarting && startingMode === EXAM_MODES.RANDOM ? (
                  <ButtonLoading text="Starting..." />
                ) : (
                  <>
                    <PlayIcon className="w-4 h-4" />
                    Start Random Exam
                  </>
                )}
              </button>
            </div>

            {/* Weak-Area Mode - Featured */}
            <div className="card border-2 border-primary-500 bg-gradient-to-br from-primary-500/10 via-card to-surface hover:border-primary-400 transition-all duration-200 group relative overflow-hidden">
              <div className="absolute top-2 right-2">
                <SparklesIcon className="w-5 h-5 text-primary-500" />
              </div>
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-primary-500/20 rounded-lg">
                  <FireIcon className="w-5 h-5 text-primary-500" />
                </div>
                <h3 className="text-lg font-semibold text-text">Weak-Area Mode</h3>
              </div>
              <p className="text-muted text-sm mb-4">
                Focus on your weak topics automatically identified from your performance
              </p>
              <button 
                className="btn-primary w-full flex items-center justify-center gap-2 group-hover:scale-105 transition-transform"
                onClick={handleStartWeakArea}
                disabled={isStarting}
              >
                {isStarting && startingMode === EXAM_MODES.WEAK_AREA ? (
                  <ButtonLoading text="Preparing..." />
                ) : (
                  <>
                    <FireIcon className="w-4 h-4" />
                    Start Weak-Area Exam
                  </>
                )}
              </button>
            </div>

            {/* Topic-Focused Mode */}
            <div className="card hover:border-primary-500/50 transition-all duration-200 group">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-primary-500/10 rounded-lg">
                  <AcademicCapIcon className="w-5 h-5 text-primary-500" />
                </div>
                <h3 className="text-lg font-semibold text-text">Topic-Focused</h3>
              </div>
              <p className="text-muted text-sm mb-4">
                Select a specific subject and topics to practice
              </p>
              <button 
                className="btn-primary w-full flex items-center justify-center gap-2 group-hover:scale-105 transition-transform"
                onClick={() => navigate('/topic-focused')}
                disabled={isStarting}
              >
                <AcademicCapIcon className="w-4 h-4" />
                Start Topic-Focused
              </button>
            </div>
          </div>
        </div>

        {/* Recent Exams Section - Enhanced */}
        {recentExams.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl md:text-2xl font-bold text-text flex items-center gap-2">
                <BookOpenIcon className="w-6 h-6 text-primary-500" />
                Recent Exams
              </h2>
              <button 
                className="text-primary-500 text-sm font-medium hover:text-primary-400 flex items-center gap-1"
                onClick={() => navigate('/exams')}
              >
                View All <ArrowRightIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recentExams.map((exam) => (
                <div
                  key={exam.examId}
                  onClick={() => navigate(`/exams/${exam.examId}`)}
                  className="card cursor-pointer hover:border-primary-500/50 transition-all duration-200 active:scale-95"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="text-base font-semibold text-text flex-1 line-clamp-2 mr-2">
                      {exam.title}
                    </h4>
                    <ArrowRightIcon className="w-5 h-5 text-muted flex-shrink-0" />
                  </div>
                  
                  <div className="flex items-center justify-between text-sm mb-3">
                    <span className="text-muted flex items-center gap-1">
                      <BookOpenIcon className="w-4 h-4" />
                      {exam.questionIds?.length || 0} Questions
                    </span>
                    {exam.createdAt && (
                      <span className="text-muted text-xs">
                        {formatDate(exam.createdAt)}
                      </span>
                    )}
                  </div>

                  {exam.progress && (
                    <div>
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="text-muted">Progress</span>
                        <span className={`font-semibold ${exam.progress.isComplete ? 'text-green-500' : 'text-primary-500'}`}>
                          {exam.progress.progressPercent}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-surface rounded-full overflow-hidden mb-2">
                        <div 
                          className={`h-full transition-all duration-300 rounded-full ${
                            exam.progress.isComplete ? 'bg-green-500' : 'bg-primary-500'
                          }`}
                          style={{ width: `${exam.progress.progressPercent}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted">
                        {exam.progress.answeredCount} of {exam.progress.totalQuestions} answered
                        {exam.progress.isComplete && (
                          <span className="ml-2 text-green-500 flex items-center gap-1"><CheckCircleIcon className="w-3 h-3" /> Complete</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Subjects Overview - Enhanced */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl md:text-2xl font-bold text-text flex items-center gap-2">
              <ChartBarIcon className="w-6 h-6 text-primary-500" />
              Subject Overview
            </h2>
            <button 
              className="text-primary-500 text-sm font-medium hover:text-primary-400 flex items-center gap-1"
              onClick={() => navigate('/analytics')}
            >
              View All <ArrowRightIcon className="w-4 h-4" />
            </button>
          </div>
          
          {isLoading ? (
            <div className="text-center py-8 text-muted">Loading subjects...</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {OFFICIAL_SUBJECTS.slice(0, 6).map((subject) => {
                const stats = subjectStats[subject] || {
                  subject,
                  totalAttempted: 0,
                  accuracy: 0,
                  status: 'N/A'
                };
                return (
                  <SubjectCard
                    key={subject}
                    stats={stats}
                    onClick={() => navigate('/analytics')}
                  />
                );
              })}
            </div>
          )}

          {/* Quick Insights */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-green-500/10 to-surface rounded-xl p-4 border border-green-500/30">
              <div className="flex items-center gap-2 mb-2">
                <TrophyIcon className="w-5 h-5 text-green-500" />
                <h4 className="text-sm font-semibold text-text">Strong Areas</h4>
              </div>
              <div className="text-2xl font-bold text-green-500">{strongCount}</div>
              <div className="text-xs text-muted mt-1">Subjects mastered</div>
            </div>

            <div className="bg-gradient-to-br from-red-500/10 to-card rounded-xl p-4 border border-red-500/30">
              <div className="flex items-center gap-2 mb-2">
                <FireIcon className="w-5 h-5 text-red-500" />
                <h4 className="text-sm font-semibold text-text">Need Improvement</h4>
              </div>
              <div className="text-2xl font-bold text-red-500">{weakCount}</div>
              <div className="text-xs text-muted mt-1">Focus areas</div>
            </div>

            <div className="bg-gradient-to-br from-primary-500/10 to-card rounded-xl p-4 border border-primary-500/30">
              <div className="flex items-center gap-2 mb-2">
                <ChartBarIcon className="w-5 h-5 text-primary-500" />
                <h4 className="text-sm font-semibold text-text">Overall Accuracy</h4>
              </div>
              <div className="text-2xl font-bold text-primary-500">{overallAccuracy}%</div>
              <div className="text-xs text-muted mt-1">
                {overallStats.totalAttempted} questions attempted
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
