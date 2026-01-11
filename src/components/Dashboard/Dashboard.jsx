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
import { format, addDays, subDays } from 'date-fns';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
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

  // Prepare 7-day trend data starting from first usage date with dynamic projection
  const prepareTrendData = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = addDays(today, 1);
    
    if (overallTrend.length === 0) {
      return { chartData: [], tomorrowIndex: -1 };
    }
    
    // Get actual data from overallTrend and find first usage date
    const actualTrend = overallTrend.map(item => ({
      date: item.date,
      dateDisplay: item.dateDisplay || format(new Date(item.date), 'MMM dd'),
      accuracy: isNaN(item.accuracy) || !isFinite(item.accuracy) ? 0 : Math.max(0, Math.min(100, item.accuracy))
    }));
    
    // Find first usage date (start date)
    const firstDateStr = actualTrend[0]?.date;
    if (!firstDateStr) {
      return { chartData: [], tomorrowIndex: -1 };
    }
    
    const startDate = new Date(firstDateStr);
    startDate.setHours(0, 0, 0, 0);
    
    // Calculate 7-day range (start date to start date + 6 days = 7 days total)
    const endDate = addDays(startDate, 6);
    
    // Calculate growth rate from recent actual data
    // Use last 2 data points to calculate daily growth rate
    let dailyGrowthRate = 0;
    if (actualTrend.length >= 2) {
      const lastPoint = actualTrend[actualTrend.length - 1];
      const secondLastPoint = actualTrend[actualTrend.length - 2];
      const accuracyDiff = lastPoint.accuracy - secondLastPoint.accuracy;
      const dateDiff = Math.max(1, (new Date(lastPoint.date).getTime() - new Date(secondLastPoint.date).getTime()) / (1000 * 60 * 60 * 24));
      dailyGrowthRate = accuracyDiff / dateDiff; // Average daily growth
    } else if (actualTrend.length === 1) {
      // Only one data point - use a conservative growth rate (1% per day)
      dailyGrowthRate = 1;
    }
    
    // Get last actual accuracy
    const lastActualPoint = actualTrend[actualTrend.length - 1];
    const lastActualAccuracy = lastActualPoint?.accuracy || overallAccuracy;
    
    const chartData = [];
    let tomorrowIndex = -1;
    let todayIndex = -1;
    let lastActualIndex = -1;
    
    // Fill in 7 days of data starting from first usage date
    for (let i = 0; i < 7; i++) {
      const chartDate = addDays(startDate, i);
      const dateKey = format(chartDate, 'yyyy-MM-dd');
      const dateDisplay = format(chartDate, 'MMM dd');
      const isToday = format(chartDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
      const isTomorrow = format(chartDate, 'yyyy-MM-dd') === format(tomorrow, 'yyyy-MM-dd');
      const isFuture = chartDate > today;
      
      // Find matching actual data
      const actualPoint = actualTrend.find(item => {
        try {
          const itemDate = new Date(item.date);
          itemDate.setHours(0, 0, 0, 0);
          return format(itemDate, 'yyyy-MM-dd') === dateKey;
        } catch {
          return false;
        }
      });
      
      if (actualPoint) {
        // Has actual data
        chartData.push({
          date: dateDisplay,
          dateKey,
          actual: actualPoint.accuracy,
          projected: isToday ? actualPoint.accuracy : null, // Include today's value in projected for smooth connection
          isActual: true,
          isToday,
          isProjected: false
        });
        lastActualIndex = chartData.length - 1;
        if (isToday) {
          todayIndex = chartData.length - 1;
        }
      } else if (!isFuture) {
        // Past date with no data (before user started or gap)
        chartData.push({
          date: dateDisplay,
          dateKey,
          actual: null,
          projected: null,
          isActual: false,
          isToday,
          isProjected: false
        });
        if (isToday) {
          todayIndex = chartData.length - 1;
        }
      } else {
        // Future date - add projected data
        if (isTomorrow) {
          tomorrowIndex = chartData.length;
        }
        
        // Calculate projected accuracy based on growth rate
        // Days from today (1 = tomorrow, 2 = day after, etc.)
        const daysFromToday = i - (todayIndex >= 0 ? todayIndex : lastActualIndex);
        
        // Project accuracy using curved growth (smooth upward curve that accelerates at the end)
        const progress = daysFromToday / 6; // Normalize to 0-1 over 7 days
        
        // Calculate target accuracy - always optimistic/high expectations
        // Use the growth rate but scale it up for motivation (1.5x to 2x)
        const optimisticGrowthRate = Math.max(dailyGrowthRate * 1.5, 2.5); // At least 2.5% per day for motivation
        const linearGrowth = optimisticGrowthRate * daysFromToday;
        const targetAccuracy = Math.min(100, lastActualAccuracy + Math.min(linearGrowth, 40)); // Cap at 40% growth (high expectations)
        
        // Scale down by half (reduce size so it doesn't look straight)
        const baseProjection = lastActualAccuracy + (targetAccuracy - lastActualAccuracy) * 0.5;
        
        // Add curved upward acceleration at the end (cubic curve - x^3)
        const curveFactor = progress * progress * progress; // Cubic curve for strong upward curve at end
        const endBoost = (targetAccuracy - lastActualAccuracy) * curveFactor * 0.4; // Extra height at the end
        const finalProjection = baseProjection + endBoost;
        
        chartData.push({
          date: dateDisplay,
          dateKey,
          actual: isToday ? lastActualAccuracy : null, // Include today's value to connect
          projected: Math.max(lastActualAccuracy, Math.min(100, finalProjection)),
          isActual: isToday,
          isToday: false,
          isProjected: true
        });
      }
    }
    
    // Set tomorrow index if not found yet
    if (tomorrowIndex < 0) {
      tomorrowIndex = chartData.findIndex(item => {
        const itemDate = new Date(item.dateKey + 'T00:00:00');
        return format(itemDate, 'yyyy-MM-dd') === format(tomorrow, 'yyyy-MM-dd');
      });
    }
    
    return {
      chartData,
      tomorrowIndex: tomorrowIndex >= 0 ? tomorrowIndex : (todayIndex >= 0 ? todayIndex + 1 : chartData.length),
      lastActualAccuracy
    };
  };
  
  const { chartData, tomorrowIndex } = prepareTrendData();

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

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Enhanced Quick Stats */}
            <QuickStats subjectStats={subjectStats} />

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

          {/* Right Column - Performance Trend Widget */}
          {chartData.length > 0 && (
            <div className="lg:col-span-1">
              <div className="bg-gradient-to-br from-card to-surface rounded-xl p-4 border border-border sticky top-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ArrowTrendingUpIcon className="w-4 h-4 text-primary-500" />
                    <div>
                      <h3 className="text-sm font-bold text-text">Performance Trend</h3>
                      <p className="text-xs text-muted">1-week projection</p>
                    </div>
                  </div>
                  <button
                    className="text-xs text-primary-500 hover:text-primary-400 flex items-center gap-1"
                    onClick={() => navigate('/analytics')}
                  >
                    Full <ArrowRightIcon className="w-3 h-3" />
                  </button>
                </div>
                <div className="w-full" style={{ height: '200px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart 
                      data={chartData}
                      margin={{ top: 10, right: 10, left: -10, bottom: 30 }}
                    >
                      <defs>
                        <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0.05}/>
                        </linearGradient>
                        <linearGradient id="colorProjected" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#fbbf24" stopOpacity={0.02}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#a3a3a3"
                        style={{ fontSize: '11px' }}
                        angle={-45}
                        textAnchor="end"
                        height={70}
                        interval="preserveStartEnd"
                      />
                      <YAxis 
                        domain={[0, 100]}
                        stroke="#a3a3a3"
                        style={{ fontSize: '11px' }}
                        tickFormatter={(value) => `${value}%`}
                        width={40}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1a1a1a', 
                          border: '1px solid #333', 
                          borderRadius: '8px',
                          color: '#f5f5f5',
                          fontSize: '12px'
                        }}
                        formatter={(value, name, props) => {
                          if (props.payload.isProjected) {
                            return [`${Math.round(value)}% (Projected)`, 'Potential Accuracy'];
                          }
                          return [`${Math.round(value)}%`, 'Accuracy'];
                        }}
                        labelFormatter={(label) => `Date: ${label}`}
                      />
                      {/* Reference line at tomorrow */}
                      <ReferenceLine 
                        x={chartData[tomorrowIndex]?.date} 
                        stroke="#a3a3a3" 
                        strokeDasharray="5 5" 
                        strokeWidth={2}
                        label={{ value: "Tomorrow", position: "top", style: { fill: '#a3a3a3', fontSize: '11px' } }}
                      />
                      {/* Actual data area */}
                      <Area 
                        type="monotone" 
                        dataKey="actual" 
                        stroke="#f97316" 
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorActual)"
                        dot={{ r: 4, fill: '#f97316', strokeWidth: 1, stroke: '#fff' }}
                        activeDot={{ r: 6, fill: '#ea580c', strokeWidth: 2, stroke: '#fff' }}
                        connectNulls={false}
                      />
                      {/* Projected data area (smooth curve with dashed line) */}
                      <Area 
                        type="basis" 
                        dataKey="projected" 
                        stroke="#fbbf24" 
                        strokeWidth={2}
                        strokeDasharray="8 4"
                        fillOpacity={1}
                        fill="url(#colorProjected)"
                        dot={{ r: 3, fill: '#fbbf24', strokeWidth: 1, stroke: '#fff', strokeDasharray: '0' }}
                        activeDot={{ r: 5, fill: '#f59e0b', strokeWidth: 2, stroke: '#fff' }}
                        connectNulls={true}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex flex-col gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-primary-500"></div>
                    <span className="text-muted">Actual</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-yellow-500" style={{ borderTop: '2px dashed #fbbf24' }}></div>
                    <span className="text-muted">Projected</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
