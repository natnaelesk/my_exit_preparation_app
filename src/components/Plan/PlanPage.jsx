import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExam } from '../../contexts/ExamContext';
import { calculateSubjectStats, calculateTopicStats } from '../../services/analyticsService';
import { getQuestionsBySubject } from '../../services/questionService';
import { getDailyPlanMotivation } from '../../services/grokService';
import { 
  getOrCreateDailyPlan, 
  getDailyPlan, 
  listRecentDailyPlans, 
  recomputeDailyPlanStats 
} from '../../services/dailyPlanService';
import { EXAM_MODES, OFFICIAL_SUBJECTS } from '../../utils/constants';
import { 
  CalendarDaysIcon, 
  AcademicCapIcon, 
  LightBulbIcon, 
  PlayIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { format, startOfWeek, addDays, isToday } from 'date-fns';

const PLAN_MOTIVATION_KEY_PREFIX = 'dailyPlanMotivation_v1_';

const getDateKey = (date = new Date()) => {
  try {
    return date.toISOString().slice(0, 10); // YYYY-MM-DD
  } catch {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  }
};

const getWeekDates = () => {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
  const dates = [];
  for (let i = 0; i < 7; i++) {
    dates.push(addDays(weekStart, i));
  }
  return dates;
};

const PlanPage = () => {
  const navigate = useNavigate();
  const { startExam } = useExam();
  const grokApiKey = import.meta.env.VITE_GROK_API_KEY;
  
  const [subjectStats, setSubjectStats] = useState({});
  const [currentDailyPlan, setCurrentDailyPlan] = useState(null);
  const [recentPlans, setRecentPlans] = useState([]);
  const [selectedDateKey, setSelectedDateKey] = useState(getDateKey());
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState('');

  const [aiMotivation, setAiMotivation] = useState('');
  const [isMotivationLoading, setIsMotivationLoading] = useState(false);
  const [motivationError, setMotivationError] = useState('');

  const todayKey = getDateKey();
  const weekDates = useMemo(() => getWeekDates(), []);

  useEffect(() => {
    loadPlanData();
  }, []);

  useEffect(() => {
    if (selectedDateKey) {
      loadDailyPlan(selectedDateKey);
    }
  }, [selectedDateKey]);

  const loadPlanData = async () => {
    try {
      setIsLoading(true);
      setError('');

      // Load subject stats to determine focus subject
      const stats = await calculateSubjectStats();
      setSubjectStats(stats);

      // Determine focus subject (weakest)
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

      // Load or create today's daily plan
      const todayPlan = await getOrCreateDailyPlan(todayKey, focusSubject);
      setCurrentDailyPlan(todayPlan);
      setSelectedDateKey(todayKey);

      // Load recent plans for calendar
      const recent = await listRecentDailyPlans(7);
      setRecentPlans(recent);

      // Recompute stats for today's plan
      await recomputeDailyPlanStats(todayKey);
      const updatedPlan = await getDailyPlan(todayKey);
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
        // Recompute stats
        await recomputeDailyPlanStats(dateKey);
        const updated = await getDailyPlan(dateKey);
        setCurrentDailyPlan(updated || plan);
      } else if (dateKey === todayKey) {
        // If today's plan doesn't exist, create it
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
    if (!currentDailyPlan || !currentDailyPlan.questionIds || currentDailyPlan.questionIds.length === 0) {
      alert('No questions available for today\'s plan');
      return;
    }

    try {
      setIsStarting(true);
      const config = {
        questionCount: currentDailyPlan.questionIds.length,
        planDateKey: currentDailyPlan.dateKey,
        planQuestionIds: currentDailyPlan.questionIds, // Use plan's questionIds directly
        allowReattempts: true
      };

      await startExam(EXAM_MODES.WEAK_AREA, config);
      navigate('/exam');
    } catch (error) {
      console.error('Error starting practice:', error);
      alert('Error starting practice: ' + error.message);
      setIsStarting(false);
    }
  };

  const getPlanForDate = (dateKey) => {
    return recentPlans.find(p => p.dateKey === dateKey) || null;
  };

  const focusSubject = currentDailyPlan?.focusSubject || null;
  const subjectStat = focusSubject ? subjectStats[focusSubject] : null;

  useEffect(() => {
    const loadMotivation = async () => {
      if (!todayKey || !focusSubject || !currentDailyPlan) return;

      const storageKey = `${PLAN_MOTIVATION_KEY_PREFIX}${todayKey}`;
      try {
        const cached = localStorage.getItem(storageKey);
        if (cached) {
          setAiMotivation(cached);
          setMotivationError('');
          return;
        }
      } catch {
        // ignore
      }

      if (!grokApiKey) {
        setAiMotivation('');
        setMotivationError('Add VITE_GROK_API_KEY in your .env to enable the daily AI motivation message.');
        return;
      }

      try {
        setIsMotivationLoading(true);
        setMotivationError('');
        const msg = await getDailyPlanMotivation(
          {
            dateKey: todayKey,
            focusSubject,
            subjectAccuracy: subjectStat?.accuracy || 0,
            plannedQuestions: currentDailyPlan.questionIds?.length || 0
          },
          grokApiKey
        );
        setAiMotivation(msg);
        try {
          localStorage.setItem(storageKey, msg);
        } catch {
          // ignore
        }
      } catch (err) {
        setAiMotivation('');
        setMotivationError(err?.message || 'Failed to load daily motivation.');
      } finally {
        setIsMotivationLoading(false);
      }
    };

    loadMotivation();
  }, [todayKey, focusSubject, currentDailyPlan, subjectStat?.accuracy, grokApiKey]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <div className="text-muted">Loading your study plan...</div>
        </div>
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
  const isPastDay = selectedDateKey < todayKey;

  return (
    <div className="min-h-screen bg-bg text-text px-4 py-6 pb-24 md:pb-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <CalendarDaysIcon className="w-8 h-8 text-primary-500" />
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-bold text-text">Daily Study Plan</h1>
              <p className="text-muted text-sm mt-1">
                {isViewingToday ? 'Today\'s plan' : `Viewing plan for ${selectedDateKey}`}
              </p>
            </div>
          </div>
        </div>

        {/* Weekly Calendar Strip */}
        <div className="card">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-text mb-3">This Week</h2>
            <div className="grid grid-cols-7 gap-2">
              {weekDates.map((date, idx) => {
                const dateKey = getDateKey(date);
                const plan = getPlanForDate(dateKey);
                const isSelected = selectedDateKey === dateKey;
                const isTodayDate = isToday(date);
                const dayName = format(date, 'EEE').slice(0, 1); // M, T, W, etc.
                const dayNum = format(date, 'd');

                return (
                  <button
                    key={dateKey}
                    onClick={() => setSelectedDateKey(dateKey)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'border-border bg-surface hover:border-primary-500/50'
                    } ${isTodayDate ? 'ring-2 ring-primary-500/30' : ''}`}
                  >
                    <div className="text-xs text-muted mb-1">{dayName}</div>
                    <div className={`text-lg font-bold ${isTodayDate ? 'text-primary-500' : 'text-text'}`}>
                      {dayNum}
                    </div>
                    {plan && (
                      <div className="mt-2 flex items-center justify-center">
                        {plan.isComplete ? (
                          <CheckCircleIcon className="w-4 h-4 text-green-500" />
                        ) : plan.answeredCount > 0 ? (
                          <div className="w-2 h-2 rounded-full bg-yellow-500" />
                        ) : null}
                      </div>
                    )}
                    {plan && (
                      <div className="text-xs text-muted mt-1">
                        {plan.answeredCount}/{plan.questionIds?.length || 0}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Daily Stats Card */}
        {viewingPlan && (
          <div className="card bg-gradient-to-br from-primary-500/10 to-surface border-primary-500/30">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h2 className="text-xl font-bold text-text mb-2 flex items-center gap-2">
                  <SparklesIcon className="w-5 h-5 text-primary-500" />
                  {isViewingToday ? 'Today\'s Plan' : `Plan for ${selectedDateKey}`}
                </h2>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-muted">Subject:</span>
                    <span className="ml-2 font-semibold text-text">{viewingPlan.focusSubject || 'Loading...'}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-surface rounded-lg p-3 border border-border">
                      <div className="text-xs text-muted">Planned</div>
                      <div className="text-xl font-bold text-text mt-1">
                        {viewingPlan.questionIds?.length || 0} / {viewingPlan.maxPlannedQuestions || 35}
                      </div>
                      <div className="text-xs text-muted mt-1">
                        {viewingPlan.totalAvailableInSubject || 0} available in bank
                      </div>
                    </div>
                    <div className="bg-surface rounded-lg p-3 border border-border">
                      <div className="text-xs text-muted">Answered</div>
                      <div className="text-xl font-bold text-text mt-1">{viewingPlan.answeredCount || 0}</div>
                      <div className="text-xs text-muted mt-1">
                        {viewingPlan.questionIds?.length - (viewingPlan.answeredCount || 0)} remaining
                      </div>
                    </div>
                    <div className="bg-surface rounded-lg p-3 border border-border">
                      <div className="text-xs text-muted">Accuracy</div>
                      <div className="text-xl font-bold text-primary-500 mt-1">
                        {Math.round(viewingPlan.accuracy || 0)}%
                      </div>
                      <div className="text-xs text-muted mt-1">
                        {viewingPlan.correctCount || 0} correct • {viewingPlan.wrongCount || 0} wrong
                      </div>
                    </div>
                    <div className="bg-surface rounded-lg p-3 border border-border">
                      <div className="text-xs text-muted">Status</div>
                      <div className="mt-1 flex items-center gap-1">
                        {viewingPlan.isComplete ? (
                          <>
                            <CheckCircleIcon className="w-5 h-5 text-green-500" />
                            <span className="text-sm font-semibold text-green-500">Complete</span>
                          </>
                        ) : (
                          <>
                            <div className="w-2 h-2 rounded-full bg-yellow-500" />
                            <span className="text-sm font-semibold text-yellow-500">In Progress</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Daily AI Motivation */}
        {isViewingToday && (
          <div className="card">
            <div className="flex items-start gap-3">
              <SparklesIcon className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-text mb-1">AI Coach</div>
                {isMotivationLoading ? (
                  <div className="text-sm text-muted">Generating today's motivation...</div>
                ) : aiMotivation ? (
                  <div className="text-sm text-text leading-relaxed">{aiMotivation}</div>
                ) : (
                  <div className="text-sm text-muted">
                    {motivationError || 'Stay consistent today — one focused session is enough to move your score.'}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Subject Stats */}
        {subjectStat && (
          <div className="card">
            <h2 className="text-lg font-bold text-text mb-4">Subject Performance</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-surface rounded-lg p-3 border border-border">
                <div className="text-xs text-muted">Overall Accuracy</div>
                <div className="text-xl font-bold text-text mt-1">{Math.round(subjectStat.accuracy || 0)}%</div>
              </div>
              <div className="bg-surface rounded-lg p-3 border border-border">
                <div className="text-xs text-muted">Total Attempts</div>
                <div className="text-xl font-bold text-text mt-1">{subjectStat.totalAttempted || 0}</div>
              </div>
              <div className="bg-surface rounded-lg p-3 border border-border">
                <div className="text-xs text-muted">Correct</div>
                <div className="text-xl font-bold text-green-500 mt-1">{subjectStat.correctCount || 0}</div>
              </div>
              <div className="bg-surface rounded-lg p-3 border border-border">
                <div className="text-xs text-muted">Wrong</div>
                <div className="text-xl font-bold text-red-500 mt-1">{subjectStat.wrongCount || 0}</div>
              </div>
            </div>
          </div>
        )}

        {/* Start/Continue Button */}
        {isViewingToday && viewingPlan && !viewingPlan.isComplete && (
          <button
            className="btn-primary w-full py-4 text-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            onClick={handleStartPractice}
            disabled={isStarting || !viewingPlan.questionIds || viewingPlan.questionIds.length === 0}
          >
            {isStarting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Starting Practice...</span>
              </>
            ) : viewingPlan.answeredCount > 0 ? (
              <>
                <PlayIcon className="w-5 h-5" />
                <span>Continue Today's Practice ({viewingPlan.answeredCount}/{viewingPlan.questionIds.length} answered)</span>
              </>
            ) : (
              <>
                <PlayIcon className="w-5 h-5" />
                <span>Start Today's Practice ({viewingPlan.questionIds.length} questions)</span>
              </>
            )}
          </button>
        )}

        {/* Past Day View (Read-only) */}
        {isPastDay && viewingPlan && (
          <div className="card bg-surface/50">
            <div className="flex items-center gap-2 mb-4">
              <ExclamationTriangleIcon className="w-5 h-5 text-muted" />
              <p className="text-sm text-muted">
                This is a past day. You can view stats but cannot continue practicing.
              </p>
            </div>
          </div>
        )}

        {/* Info Banner */}
        {isViewingToday && viewingPlan && viewingPlan.answeredCount === 0 && (
          <div className="card bg-primary-500/10 border-primary-500/30">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-text">
                <p className="font-semibold mb-1">Ready to start?</p>
                <p className="text-muted">
                  Today's plan includes {viewingPlan.questionIds?.length || 0} questions from {viewingPlan.focusSubject}. 
                  Complete them to mark today as done and improve your accuracy!
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanPage;
