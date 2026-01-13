import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExam } from '../../contexts/ExamContext';
import { calculateSubjectStats, calculateTopicStats } from '../../services/analyticsService';
import { getQuestionsBySubject } from '../../services/questionService';
import { 
  getOrCreateDailyPlan, 
  getDailyPlan, 
  listRecentDailyPlans, 
  recomputeDailyPlanStats,
  filterQuestionsByType
} from '../../services/dailyPlanService';
import { getOrGenerateBonusChallenge } from '../../services/bonusChallengeService';
import { EXAM_MODES, OFFICIAL_SUBJECTS } from '../../utils/constants';
import LoadingAnimation from '../Common/LoadingAnimation';
import ButtonLoading from '../Common/ButtonLoading';
import { 
  CalendarDaysIcon, 
  AcademicCapIcon, 
  LightBulbIcon, 
  PlayIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  CheckCircleIcon,
  BookOpenIcon,
  XMarkIcon,
  ChartBarIcon,
  ClockIcon,
  FireIcon
} from '@heroicons/react/24/outline';
import { format, startOfWeek, addDays, isToday } from 'date-fns';
import { getEthiopianDateKey, isTodayEthiopian, hasDayEnded } from '../../utils/ethiopianTime';

const getDateKey = (date = new Date()) => {
  // Use Ethiopian timezone with 6 AM day boundary
  return getEthiopianDateKey(date);
};

const getWeekDates = () => {
  const today = new Date();
  // Get the last 7 days ending with today (today is always last)
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    dates.push(addDays(today, -i));
  }
  return dates;
};

const PlanPage = () => {
  const navigate = useNavigate();
  const { startExam } = useExam();
  
  const [subjectStats, setSubjectStats] = useState({});
  const [currentDailyPlan, setCurrentDailyPlan] = useState(null);
  const [recentPlans, setRecentPlans] = useState([]);
  const [selectedDateKey, setSelectedDateKey] = useState(getDateKey());
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState('');
  const [allTopics, setAllTopics] = useState([]);
  const [topicStats, setTopicStats] = useState({});
  const [showMotivation, setShowMotivation] = useState(true);
  const [activeTab, setActiveTab] = useState('today'); // 'today' | 'bonus'
  const [bonusChallenge, setBonusChallenge] = useState(null);
  const [questionFilter, setQuestionFilter] = useState('all'); // 'all' | 'answered' | 'never-seen'
  const [dayHasEnded, setDayHasEnded] = useState(false);
  const [moreMoreClicked, setMoreMoreClicked] = useState(false);

  const todayKeyRef = useRef(getDateKey());
  const calendarScrollRef = useRef(null);
  const todayKey = getDateKey();
  const weekDates = useMemo(() => getWeekDates(), [todayKey]); // Recompute when today changes

  useEffect(() => {
    loadPlanData();
    todayKeyRef.current = getDateKey();
    
    // Check for new day every minute
    const interval = setInterval(() => {
      const newTodayKey = getDateKey();
      if (newTodayKey !== todayKeyRef.current) {
        // New day - reload everything
        todayKeyRef.current = newTodayKey;
        loadPlanData();
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedDateKey) {
      loadDailyPlan(selectedDateKey);
      // Refresh recent plans to ensure we have latest data
      listRecentDailyPlans(14).then(plans => {
        setRecentPlans(plans);
      }).catch(err => {
        console.error('Error refreshing recent plans:', err);
      });
    }
  }, [selectedDateKey]);

  // Auto-scroll calendar to bottom (today) when it loads or updates
  useEffect(() => {
    if (!isLoading && weekDates.length > 0) {
      const scrollToBottom = () => {
        if (calendarScrollRef.current) {
          const element = calendarScrollRef.current;
          // Force scroll all the way to the bottom
          element.scrollTop = element.scrollHeight;
        }
      };

      // Multiple attempts to ensure it scrolls (DOM might not be ready immediately)
      requestAnimationFrame(() => {
        scrollToBottom();
        setTimeout(scrollToBottom, 50);
        setTimeout(scrollToBottom, 200);
        setTimeout(scrollToBottom, 500);
        setTimeout(scrollToBottom, 1000);
      });
    }
  }, [weekDates, recentPlans, isLoading]);

  useEffect(() => {
    if (currentDailyPlan?.focusSubject) {
      loadTopicsAndStats();
    }
  }, [currentDailyPlan?.focusSubject]);

  // Check if day has ended (for hiding bonus button)
  useEffect(() => {
    const checkDayEnded = () => {
      setDayHasEnded(hasDayEnded());
    };
    checkDayEnded();
    const interval = setInterval(checkDayEnded, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  // Load bonus challenge when switching to bonus tab
  useEffect(() => {
    if (activeTab === 'bonus' && !bonusChallenge) {
      loadBonusChallenge();
    }
  }, [activeTab]);

  const loadBonusChallenge = async () => {
    try {
      const challenge = await getOrGenerateBonusChallenge();
      setBonusChallenge(challenge);
    } catch (error) {
      console.error('Error loading bonus challenge:', error);
      setError('Failed to load bonus challenge');
    }
  };

  const loadTopicsAndStats = async () => {
    if (!currentDailyPlan?.focusSubject) return;
    try {
      const questions = await getQuestionsBySubject(currentDailyPlan.focusSubject);
      const topicsSet = new Set();
      questions.forEach(q => {
        if (q.topic) topicsSet.add(q.topic);
      });
      const topicsList = Array.from(topicsSet).sort();
      setAllTopics(topicsList);

      const stats = await calculateTopicStats(currentDailyPlan.focusSubject);
      setTopicStats(stats);
    } catch (err) {
      console.error('Error loading topics:', err);
    }
  };

  const loadPlanData = async () => {
    try {
      setIsLoading(true);
      setError('');

      const stats = await calculateSubjectStats();
      setSubjectStats(stats);

      const subjectsWithData = Object.values(stats).filter(s => s && s.totalAttempted > 0);
      let focusSubject = OFFICIAL_SUBJECTS[0];
      if (subjectsWithData.length > 0) {
        const weaknessScores = subjectsWithData.map(stat => ({
          subject: stat.subject,
          weaknessScore: (100 - (stat.accuracy || 0)) * Math.log1p(stat.totalAttempted),
        }));
        weaknessScores.sort((a, b) => b.weaknessScore - a.weaknessScore);
        focusSubject = weaknessScores[0].subject;
      }

      const currentTodayKey = getDateKey();
      const todayPlan = await getOrCreateDailyPlan(currentTodayKey, focusSubject);
      setCurrentDailyPlan(todayPlan);
      setSelectedDateKey(currentTodayKey);

      // Load plans for the last 7 days (including today)
      const recent = await listRecentDailyPlans(14); // Get more to ensure we have all 7 days
      setRecentPlans(recent);

      await recomputeDailyPlanStats(currentTodayKey);
      const updatedPlan = await getDailyPlan(currentTodayKey);
      if (updatedPlan) {
        setCurrentDailyPlan(updatedPlan);
      }
    } catch (err) {
      console.error('Error loading plan data:', err);
      setError(err.message || 'Failed to load plan data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadDailyPlan = async (dateKey) => {
    try {
      const plan = await getDailyPlan(dateKey);
      if (plan) {
        await recomputeDailyPlanStats(dateKey);
        const updated = await getDailyPlan(dateKey);
        setCurrentDailyPlan(updated || plan);
      } else if (dateKey === todayKey) {
        const stats = await calculateSubjectStats();
        const subjectsWithData = Object.values(stats).filter(s => s && s.totalAttempted > 0);
        let focusSubject = OFFICIAL_SUBJECTS[0];
        if (subjectsWithData.length > 0) {
          const weaknessScores = subjectsWithData.map(stat => ({
            subject: stat.subject,
            weaknessScore: (100 - (stat.accuracy || 0)) * Math.log1p(stat.totalAttempted),
          }));
          weaknessScores.sort((a, b) => b.weaknessScore - a.weaknessScore);
          focusSubject = weaknessScores[0].subject;
        }
        const newPlan = await getOrCreateDailyPlan(dateKey, focusSubject);
        setCurrentDailyPlan(newPlan);
      } else {
        setCurrentDailyPlan(null);
      }
    } catch (err) {
      console.error('Error loading daily plan:', err);
    }
  };

  const handleStartPractice = async () => {
    const plan = activeTab === 'bonus' ? bonusChallenge : currentDailyPlan;
    
    if (!plan || !plan.questionIds || plan.questionIds.length === 0) {
      alert(`No questions available for ${activeTab === 'bonus' ? 'bonus challenge' : 'today\'s plan'}`);
      return;
    }

    try {
      setIsStarting(true);
      
      // Filter questions based on selected filter
      let filteredQuestionIds = plan.questionIds;
      if (questionFilter !== 'all') {
        filteredQuestionIds = await filterQuestionsByType(plan.questionIds, questionFilter);
        
        if (filteredQuestionIds.length === 0) {
          alert(`No ${questionFilter === 'answered' ? 'answered' : 'unanswered'} questions available. Please select a different filter.`);
          setIsStarting(false);
          return;
        }
      }

      const config = {
        questionCount: filteredQuestionIds.length,
        planDateKey: activeTab === 'bonus' ? null : currentDailyPlan?.dateKey,
        planQuestionIds: filteredQuestionIds,
        allowReattempts: questionFilter !== 'never-seen'
      };

      await startExam(EXAM_MODES.WEAK_AREA, config);
      navigate('/exam');
    } catch (error) {
      console.error('Error starting practice:', error);
      alert('Error starting practice: ' + error.message);
      setIsStarting(false);
    }
  };

  const handleMoreMoreClick = async () => {
    try {
      setMoreMoreClicked(true);
      await loadBonusChallenge();
      setActiveTab('bonus');
    } catch (error) {
      console.error('Error loading bonus challenge:', error);
      alert('Failed to load bonus challenge: ' + error.message);
      setMoreMoreClicked(false); // Reset on error
    }
  };

  const getPlanForDate = (dateKey) => {
    // Match by exact dateKey
    const plan = recentPlans.find(p => p.dateKey === dateKey);
    return plan || null;
  };

  const focusSubject = currentDailyPlan?.focusSubject || null;
  const subjectStat = focusSubject ? subjectStats[focusSubject] : null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <LoadingAnimation message="Preparing your study plan" size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="card text-red-500 max-w-md">{error}</div>
      </div>
    );
  }

  const isViewingToday = selectedDateKey === todayKey;
  const viewingPlan = isViewingToday ? currentDailyPlan : getPlanForDate(selectedDateKey);
  
  // Get the motivational quote from the viewing plan (today or selected date)
  // Also check currentDailyPlan if viewingPlan doesn't have it
  // For bonus tab, use bonus challenge quote
  const motivationalQuote = activeTab === 'bonus' 
    ? (bonusChallenge?.motivationalQuote || null)
    : (viewingPlan?.motivationalQuote || currentDailyPlan?.motivationalQuote || null);
  const isPastDay = selectedDateKey < todayKey;
  const progressPercentage = viewingPlan && viewingPlan.questionIds?.length > 0
    ? Math.min(100, Math.round((viewingPlan.answeredCount || 0) / viewingPlan.questionIds.length * 100))
    : 0;
  
  // Show More More button only when: progress 100%, viewing today, day hasn't ended, on today tab, and not clicked yet
  const showMoreMoreButton = isViewingToday && 
                             progressPercentage === 100 && 
                             !dayHasEnded && 
                             activeTab === 'today' &&
                             !moreMoreClicked;
  
  // Show bonus tab only if More More button has been clicked
  const showBonusTab = moreMoreClicked;

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-primary-500/10 via-primary-500/5 to-transparent border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-text mb-2">Study Plan</h1>
              <p className="text-muted">
                {isViewingToday ? 'Your personalized plan for today' : `Viewing plan for ${selectedDateKey}`}
              </p>
            </div>
            {viewingPlan && (
              <div className="hidden md:flex items-center gap-6">
                <div className="text-right">
                  <div className="text-2xl font-bold text-text">{progressPercentage}%</div>
                  <div className="text-xs text-muted">Complete</div>
                </div>
                <div className="w-16 h-16 relative">
                  <svg className="w-16 h-16 transform -rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                      className="text-surface"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 28}`}
                      strokeDashoffset={`${2 * Math.PI * 28 * (1 - progressPercentage / 100)}`}
                      className="text-primary-500 transition-all duration-500"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <CheckCircleIcon className={`w-6 h-6 ${viewingPlan.isComplete ? 'text-green-500' : 'text-primary-500'}`} />
                  </div>
                </div>
                {/* More More Button - Next to completion indicator */}
                {showMoreMoreButton && (
                  <button
                    onClick={handleMoreMoreClick}
                    className="relative group px-4 py-2 rounded-lg font-semibold text-sm uppercase tracking-wide text-white bg-gradient-to-r from-orange-500 via-red-500 to-yellow-500 shadow-lg transform transition-all duration-300 hover:scale-105 animate-pulse"
                    style={{
                      animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                      boxShadow: '0 0 15px rgba(255, 69, 0, 0.5), 0 0 30px rgba(255, 0, 0, 0.3)'
                    }}
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      <FireIcon className="w-4 h-4 animate-bounce" />
                      Bonus Challenge
                      <FireIcon className="w-4 h-4 animate-bounce" style={{ animationDelay: '0.1s' }} />
                    </span>
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-orange-500 via-red-500 to-yellow-500 opacity-75 blur-md group-hover:opacity-100 transition-opacity"></div>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32 md:pb-8">
        {/* Tab Navigation - Only show if bonus tab is available */}
        {isViewingToday && showBonusTab && (
          <div className="mb-6 flex items-center gap-4">
            <button
              onClick={() => setActiveTab('today')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                activeTab === 'today'
                  ? 'bg-primary-500 text-white shadow-lg'
                  : 'bg-surface text-muted hover:bg-surface/80'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setActiveTab('bonus')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                activeTab === 'bonus'
                  ? 'bg-gradient-to-r from-orange-500 via-red-500 to-yellow-500 text-white shadow-lg'
                  : 'bg-surface text-muted hover:bg-surface/80'
              }`}
            >
              Bonus Challenge
            </button>
          </div>
        )}


        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Daily Motivation Quote - Attractive Card - Only show for Today tab */}
            {activeTab === 'today' && motivationalQuote && (
              <div className="relative overflow-hidden bg-gradient-to-br from-primary-500/20 via-primary-500/10 to-yellow-500/10 border-2 border-primary-500/30 rounded-2xl p-6 shadow-lg">
                {/* Decorative background elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full -mr-16 -mt-16"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-yellow-500/5 rounded-full -ml-12 -mb-12"></div>
                
                <div className="relative flex items-start gap-4">
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-yellow-500 flex items-center justify-center shadow-md">
                      <SparklesIcon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  
                  {/* Quote Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-primary-500 uppercase tracking-wider">
                        {isViewingToday ? '✨ Daily Inspiration' : '✨ Motivation'}
                      </span>
                      {isViewingToday && (
                        <button
                          onClick={() => setShowMotivation(false)}
                          className="ml-auto text-muted hover:text-text transition-colors p-1 hover:bg-white/10 rounded"
                          aria-label="Dismiss"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <blockquote className="text-base md:text-lg font-medium text-text leading-relaxed italic">
                      "{motivationalQuote}"
                    </blockquote>
                  </div>
                </div>
              </div>
            )}

            {/* Question Filter Toggle - Only show for today */}
            {isViewingToday && activeTab === 'today' && viewingPlan && (
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text">Question Filter:</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setQuestionFilter('all')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        questionFilter === 'all'
                          ? 'bg-primary-500 text-white'
                          : 'bg-surface text-muted hover:bg-surface/80'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setQuestionFilter('answered')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        questionFilter === 'answered'
                          ? 'bg-primary-500 text-white'
                          : 'bg-surface text-muted hover:bg-surface/80'
                      }`}
                    >
                      Answered
                    </button>
                    <button
                      onClick={() => setQuestionFilter('never-seen')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        questionFilter === 'never-seen'
                          ? 'bg-primary-500 text-white'
                          : 'bg-surface text-muted hover:bg-surface/80'
                      }`}
                    >
                      Never Seen
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Today's Plan Card */}
            {activeTab === 'today' && viewingPlan && (
              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-text mb-1">
                      {isViewingToday ? 'Today\'s Focus' : `Plan for ${selectedDateKey}`}
                    </h2>
                    <p className="text-muted text-sm">{viewingPlan.focusSubject}</p>
                  </div>
                  {viewingPlan.isComplete && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 rounded-full">
                      <CheckCircleIcon className="w-5 h-5 text-green-500" />
                      <span className="text-sm font-semibold text-green-500">Complete</span>
                    </div>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="mb-6">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted">Progress</span>
                    <span className="font-semibold text-text">
                      {viewingPlan.answeredCount || 0} / {viewingPlan.questionIds?.length || 0}
                    </span>
                  </div>
                  <div className="w-full h-3 bg-surface rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-500 rounded-full"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-surface/50 rounded-xl p-4">
                    <div className="text-xs font-medium text-muted uppercase tracking-wide mb-1">Planned</div>
                    <div className="text-2xl font-bold text-text">
                      {viewingPlan.questionIds?.length || 0}
                    </div>
                    <div className="text-xs text-muted mt-1">questions</div>
                  </div>
                  <div className="bg-surface/50 rounded-xl p-4">
                    <div className="text-xs font-medium text-muted uppercase tracking-wide mb-1">Answered</div>
                    <div className="text-2xl font-bold text-text">{viewingPlan.answeredCount || 0}</div>
                    <div className="text-xs text-muted mt-1">
                      {Math.max(0, (viewingPlan.questionIds?.length || 0) - (viewingPlan.answeredCount || 0))} left
                    </div>
                  </div>
                  <div className="bg-surface/50 rounded-xl p-4">
                    <div className="text-xs font-medium text-muted uppercase tracking-wide mb-1">Accuracy</div>
                    <div className="text-2xl font-bold text-primary-500">
                      {Math.round(viewingPlan.accuracy || 0)}%
                    </div>
                    <div className="text-xs text-muted mt-1">
                      {viewingPlan.correctCount || 0} correct
                    </div>
                  </div>
                  <div className="bg-surface/50 rounded-xl p-4">
                    <div className="text-xs font-medium text-muted uppercase tracking-wide mb-1">Bank</div>
                    <div className="text-2xl font-bold text-text">
                      {viewingPlan.totalAvailableInSubject || 0}
                    </div>
                    <div className="text-xs text-muted mt-1">available</div>
                  </div>
                </div>
              </div>
            )}

            {/* Bonus Challenge Tab Content */}
            {activeTab === 'bonus' && (
              <>
                {/* Bonus Motivation Quote - Energetic */}
                {bonusChallenge?.motivationalQuote && (
                  <div className="relative overflow-hidden bg-gradient-to-br from-orange-500/20 via-red-500/10 to-yellow-500/10 border-2 border-orange-500/30 rounded-2xl p-6 shadow-lg">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full -mr-16 -mt-16"></div>
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-yellow-500/5 rounded-full -ml-12 -mb-12"></div>
                    
                    <div className="relative flex items-start gap-4">
                      <div className="flex-shrink-0 mt-1">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center shadow-md">
                          <FireIcon className="w-6 h-6 text-white" />
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-bold text-orange-500 uppercase tracking-wider">
                            🔥 BONUS CHALLENGE MOTIVATION
                          </span>
                        </div>
                        <blockquote className="text-base md:text-lg font-medium text-text leading-relaxed italic">
                          "{bonusChallenge.motivationalQuote}"
                        </blockquote>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bonus Challenge Card */}
                {bonusChallenge && (
                  <div className="bg-card border-2 border-orange-500/30 rounded-2xl p-6 shadow-lg">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-2xl font-bold text-text mb-1 flex items-center gap-2">
                          <FireIcon className="w-6 h-6 text-orange-500" />
                          Bonus Challenge
                        </h2>
                        <p className="text-muted text-sm">{bonusChallenge.subject}</p>
                      </div>
                      <div className="px-4 py-2 bg-gradient-to-r from-orange-500/20 to-yellow-500/20 rounded-full">
                        <span className="text-sm font-semibold text-orange-500">BONUS</span>
                      </div>
                    </div>

                    {/* Question Filter Toggle for Bonus */}
                    <div className="mb-6 bg-surface/50 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-text">Question Filter:</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setQuestionFilter('all')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                              questionFilter === 'all'
                                ? 'bg-orange-500 text-white'
                                : 'bg-surface text-muted hover:bg-surface/80'
                            }`}
                          >
                            All
                          </button>
                          <button
                            onClick={() => setQuestionFilter('answered')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                              questionFilter === 'answered'
                                ? 'bg-orange-500 text-white'
                                : 'bg-surface text-muted hover:bg-surface/80'
                            }`}
                          >
                            Answered
                          </button>
                          <button
                            onClick={() => setQuestionFilter('never-seen')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                              questionFilter === 'never-seen'
                                ? 'bg-orange-500 text-white'
                                : 'bg-surface text-muted hover:bg-surface/80'
                            }`}
                          >
                            Never Seen
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Bonus Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                      <div className="bg-surface/50 rounded-xl p-4">
                        <div className="text-xs font-medium text-muted uppercase tracking-wide mb-1">Questions</div>
                        <div className="text-2xl font-bold text-text">
                          {bonusChallenge.questionIds?.length || 0}
                        </div>
                        <div className="text-xs text-muted mt-1">max {bonusChallenge.maxQuestions || 20}</div>
                      </div>
                      <div className="bg-surface/50 rounded-xl p-4">
                        <div className="text-xs font-medium text-muted uppercase tracking-wide mb-1">Subject</div>
                        <div className="text-lg font-bold text-orange-500 truncate">
                          {bonusChallenge.subject}
                        </div>
                        <div className="text-xs text-muted mt-1">Strong area</div>
                      </div>
                      <div className="bg-surface/50 rounded-xl p-4">
                        <div className="text-xs font-medium text-muted uppercase tracking-wide mb-1">Type</div>
                        <div className="text-lg font-bold text-text">
                          Bonus
                        </div>
                        <div className="text-xs text-muted mt-1">Keep sharp!</div>
                      </div>
                    </div>

                    {/* Start Bonus Practice Button */}
                    <button
                      className="w-full py-4 px-6 text-base font-semibold flex items-center justify-center gap-3 disabled:opacity-50 bg-gradient-to-r from-orange-500 via-red-500 to-yellow-500 hover:from-orange-600 hover:via-red-600 hover:to-yellow-600 text-white rounded-xl shadow-lg shadow-orange-500/30 hover:shadow-xl transition-all duration-200 disabled:cursor-not-allowed"
                      onClick={handleStartPractice}
                      disabled={isStarting || !bonusChallenge.questionIds || bonusChallenge.questionIds.length === 0}
                    >
                      {isStarting ? (
                        <ButtonLoading text="Starting..." />
                      ) : (
                        <>
                          <FireIcon className="w-5 h-5" />
                          <span>Start Bonus Challenge</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {!bonusChallenge && (
                  <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                    <div className="text-center py-8">
                      <LoadingAnimation message="Loading bonus challenge..." size="medium" />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Topics Section */}
            {activeTab === 'today' && focusSubject && allTopics.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <BookOpenIcon className="w-6 h-6 text-primary-500" />
                    <h2 className="text-xl font-bold text-text">Topics</h2>
                  </div>
                  <span className="text-sm text-muted bg-surface px-3 py-1 rounded-full">
                    {allTopics.length} total
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {allTopics.map((topic) => {
                    const topicStat = topicStats[topic];
                    const accuracy = topicStat?.accuracy || 0;
                    const attempts = topicStat?.totalAttempted || 0;
                    const getStatusColor = () => {
                      if (attempts === 0) return 'border-border bg-surface';
                      if (accuracy >= 80) return 'border-green-500/30 bg-green-500/5';
                      if (accuracy >= 60) return 'border-yellow-500/30 bg-yellow-500/5';
                      return 'border-red-500/30 bg-red-500/5';
                    };

                    return (
                      <div
                        key={topic}
                        className={`p-4 rounded-xl border transition-all hover:shadow-md ${getStatusColor()}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="font-semibold text-sm text-text line-clamp-2 flex-1 pr-2">
                            {topic}
                          </div>
                          {attempts > 0 && (
                            <div className="text-right flex-shrink-0">
                              <div className={`text-lg font-bold ${
                                accuracy >= 80 ? 'text-green-500' :
                                accuracy >= 60 ? 'text-yellow-500' : 'text-red-500'
                              }`}>
                                {Math.round(accuracy)}%
                              </div>
                              <div className="text-xs text-muted">{attempts} attempts</div>
                            </div>
                          )}
                        </div>
                        {attempts === 0 && (
                          <div className="text-xs text-muted">Not attempted yet</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Calendar */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-text mb-4 flex items-center gap-2">
                <CalendarDaysIcon className="w-5 h-5 text-primary-500" />
                Recent Days
              </h2>
              <div 
                ref={calendarScrollRef}
                className="space-y-2 max-h-[500px] overflow-y-auto scrollbar-hide"
              >
                {weekDates.map((date, index) => {
                  const dateKey = getDateKey(date);
                  // Get plan by exact dateKey match
                  const plan = recentPlans.find(p => p.dateKey === dateKey) || null;
                  const isSelected = selectedDateKey === dateKey;
                  const isTodayDate = isTodayEthiopian(date);
                  const dayName = format(date, 'EEE');
                  const dayNum = format(date, 'd');
                  const isPast = dateKey < todayKey;
                  const isLastItem = index === weekDates.length - 1;

                  return (
                    <button
                      key={dateKey}
                      ref={isLastItem ? (el) => {
                        // Scroll last item (today) into view when it renders
                        if (el && calendarScrollRef.current && !isLoading) {
                          requestAnimationFrame(() => {
                            setTimeout(() => {
                              el?.scrollIntoView({ behavior: 'auto', block: 'end' });
                              // Also ensure parent scrolls to bottom
                              if (calendarScrollRef.current) {
                                calendarScrollRef.current.scrollTop = calendarScrollRef.current.scrollHeight;
                              }
                            }, 100);
                          });
                        }
                      } : null}
                      onClick={() => setSelectedDateKey(dateKey)}
                      className={`w-full p-3 rounded-xl border-2 transition-all text-left ${
                        isSelected
                          ? 'border-primary-500 bg-primary-500/10 shadow-md'
                          : 'border-border bg-surface hover:border-primary-500/50 hover:bg-primary-500/5'
                      } ${isPast ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${
                            isTodayDate ? 'bg-primary-500 text-white' : 'bg-surface text-text'
                          }`}>
                            {dayNum}
                          </div>
                          <div>
                            <div className="font-semibold text-text">{dayName}</div>
                            {plan && (
                              <div className="text-xs text-muted">
                                {plan.answeredCount || 0}/{plan.questionIds?.length || 0} questions
                              </div>
                            )}
                          </div>
                        </div>
                        {plan && (
                          <div className="flex items-center gap-2">
                            {plan.isComplete ? (
                              <CheckCircleIcon className="w-5 h-5 text-green-500" />
                            ) : (plan.answeredCount || 0) > 0 ? (
                              <div className="w-2 h-2 rounded-full bg-yellow-500" />
                            ) : null}
                            {plan.accuracy > 0 && (
                              <span className="text-xs font-semibold text-primary-500">
                                {Math.round(plan.accuracy)}%
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subject Performance */}
            {subjectStat && (
              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                <h2 className="text-lg font-bold text-text mb-4 flex items-center gap-2">
                  <ChartBarIcon className="w-5 h-5 text-primary-500" />
                  Performance
                </h2>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted">Overall Accuracy</span>
                      <span className="text-lg font-bold text-text">{Math.round(subjectStat.accuracy || 0)}%</span>
                    </div>
                    <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full"
                        style={{ width: `${Math.min(100, subjectStat.accuracy || 0)}%` }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                    <div>
                      <div className="text-xs text-muted mb-1">Attempts</div>
                      <div className="text-xl font-bold text-text">{subjectStat.totalAttempted || 0}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted mb-1">Correct</div>
                      <div className="text-xl font-bold text-green-500">{subjectStat.correctCount || 0}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Start Button - Only show for Today tab */}
            {isViewingToday && activeTab === 'today' && viewingPlan && !viewingPlan.isComplete && (
              <button
                className="w-full py-4 px-6 text-base font-semibold flex items-center justify-center gap-3 disabled:opacity-50 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-xl shadow-lg shadow-primary-500/30 hover:shadow-xl transition-all duration-200 disabled:cursor-not-allowed"
                onClick={handleStartPractice}
                disabled={isStarting || !viewingPlan.questionIds || viewingPlan.questionIds.length === 0}
              >
                {isStarting ? (
                  <ButtonLoading text="Starting..." />
                ) : viewingPlan.answeredCount > 0 ? (
                  <>
                    <PlayIcon className="w-5 h-5" />
                    <span>Continue Practice</span>
                  </>
                ) : (
                  <>
                    <PlayIcon className="w-5 h-5" />
                    <span>Start Practice</span>
                  </>
                )}
              </button>
            )}

            {/* Past Day Notice */}
            {isPastDay && viewingPlan && (
              <div className="bg-surface/50 border border-border rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <ExclamationTriangleIcon className="w-5 h-5 text-muted flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted">
                    View-only mode. Past plans cannot be continued.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanPage;
