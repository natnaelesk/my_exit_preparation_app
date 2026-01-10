import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExam } from '../../contexts/ExamContext';
import { calculateSubjectStats, calculateTopicStats } from '../../services/analyticsService';
import { getQuestionsBySubject } from '../../services/questionService';
import { getAnsweredQuestionIds } from '../../services/attemptService';
import { getDailyPlanMotivation } from '../../services/grokService';
import { EXAM_MODES, OFFICIAL_SUBJECTS } from '../../utils/constants';
import { 
  CalendarDaysIcon, 
  AcademicCapIcon, 
  LightBulbIcon, 
  PlayIcon,
  ExclamationTriangleIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

const PLAN_STORAGE_KEY = 'dailyPlan_v1';
const PLAN_MOTIVATION_KEY_PREFIX = 'dailyPlanMotivation_v1_';

const getDateKey = () => {
  try {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  } catch {
    return `${new Date().getFullYear()}-${new Date().getMonth() + 1}-${new Date().getDate()}`;
  }
};

const readSavedPlan = () => {
  try {
    const raw = localStorage.getItem(PLAN_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const writeSavedPlan = (plan) => {
  try {
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan));
  } catch {
    // ignore
  }
};

const PlanPage = () => {
  const navigate = useNavigate();
  const { startExam } = useExam();
  const grokApiKey = import.meta.env.VITE_GROK_API_KEY;
  
  const [subjectStats, setSubjectStats] = useState({});
  const [focusSubject, setFocusSubject] = useState(null);
  const [focusTopic, setFocusTopic] = useState(null);
  const [topicStats, setTopicStats] = useState({});
  const [questionPoolSize, setQuestionPoolSize] = useState(0);
  const [poolAnsweredCount, setPoolAnsweredCount] = useState(0);
  const [topicBankCounts, setTopicBankCounts] = useState({});
  const [topicAnsweredCounts, setTopicAnsweredCounts] = useState({});
  const [subjectQuestions, setSubjectQuestions] = useState([]);
  const [planDateKey, setPlanDateKey] = useState(getDateKey());
  const [answeredIdSet, setAnsweredIdSet] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);

  const [aiMotivation, setAiMotivation] = useState('');
  const [isMotivationLoading, setIsMotivationLoading] = useState(false);
  const [motivationError, setMotivationError] = useState('');
  
  // Configuration
  const [questionCount, setQuestionCount] = useState(20);
  const [selectedMode, setSelectedMode] = useState('targeted'); // 'targeted' or 'subject-only'

  useEffect(() => {
    loadPlanData();
  }, []);

  useEffect(() => {
    if (focusSubject) {
      loadTopicStatsAndPoolSize();
    }
  }, [focusSubject, selectedMode, focusTopic, answeredIdSet]);

  useEffect(() => {
    // Persist today's plan. Focus stays the same during the day; settings are saved too.
    if (!planDateKey || !focusSubject) return;
    writeSavedPlan({
      dateKey: planDateKey,
      focusSubject,
      focusTopic,
      selectedMode,
      questionCount
    });
  }, [planDateKey, focusSubject, focusTopic, selectedMode, questionCount]);

  const loadPlanData = async () => {
    try {
      setIsLoading(true);
      const todayKey = getDateKey();
      setPlanDateKey(todayKey);

      // Load answered IDs once (used to show bank progress and to explain why pool can be small)
      const answeredIds = await getAnsweredQuestionIds().catch(() => []);
      setAnsweredIdSet(new Set(answeredIds));

      const stats = await calculateSubjectStats();
      setSubjectStats(stats);
      
      // If we already have today's saved plan, stick to it.
      const saved = readSavedPlan();
      if (saved && saved.dateKey === todayKey && saved.focusSubject) {
        setFocusSubject(saved.focusSubject);
        setFocusTopic(saved.focusTopic || null);
        setSelectedMode(saved.selectedMode || 'targeted');
        setQuestionCount(saved.questionCount || 20);
        return;
      }

      // Otherwise generate a new plan for today.
      const subjectsWithData = Object.values(stats).filter(s => s && s.totalAttempted > 0);
      if (subjectsWithData.length === 0) {
        // No data yet - default to first subject
        setFocusSubject(OFFICIAL_SUBJECTS[0]);
        setFocusTopic(null);
        setSelectedMode('targeted');
        setQuestionCount(20);
        return;
      }

      // Weakness score: (100 - accuracy) * log1p(totalAttempted)
      const weaknessScores = subjectsWithData.map(stat => ({
        subject: stat.subject,
        weaknessScore: (100 - (stat.accuracy || 0)) * Math.log1p(stat.totalAttempted),
      }));
      weaknessScores.sort((a, b) => b.weaknessScore - a.weaknessScore);
      setFocusSubject(weaknessScores[0].subject);
    } catch (error) {
      console.error('Error loading plan data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTopicStatsAndPoolSize = async () => {
    if (!focusSubject) return;
    
    try {
      // Load topic stats
      const topics = await calculateTopicStats(focusSubject);
      setTopicStats(topics);
      
      // Load all questions for the subject once (used for bank counts + topic list)
      const subjectQuestions = await getQuestionsBySubject(focusSubject);
      setSubjectQuestions(subjectQuestions);
      const counts = {};
      const answeredCounts = {};
      for (const q of subjectQuestions) {
        const t = q.topic || 'Unknown';
        counts[t] = (counts[t] || 0) + 1;
        if (answeredIdSet.has(q.questionId)) {
          answeredCounts[t] = (answeredCounts[t] || 0) + 1;
        }
      }
      setTopicBankCounts(counts);
      setTopicAnsweredCounts(answeredCounts);

      // Keep saved topic if we already have one for today, otherwise pick weakest.
      let resolvedTopic = focusTopic;
      if (!resolvedTopic) {
        const topicsWithData = Object.values(topics).filter(t => t && t.totalAttempted > 0);
        if (topicsWithData.length > 0) {
          const weaknessScores = topicsWithData.map(stat => ({
            topic: stat.topic,
            weaknessScore: (100 - (stat.accuracy || 0)) * Math.log1p(stat.totalAttempted),
          }));
          weaknessScores.sort((a, b) => b.weaknessScore - a.weaknessScore);
          resolvedTopic = weaknessScores[0].topic;
        } else {
          const uniqueTopics = Object.keys(counts).filter(Boolean);
          resolvedTopic = uniqueTopics[0] || null;
        }
        setFocusTopic(resolvedTopic);
      }
      
      // Load pool size
      let poolQuestions = subjectQuestions;
      if (selectedMode === 'targeted' && resolvedTopic) {
        poolQuestions = subjectQuestions.filter(q => (q.topic || 'Unknown') === resolvedTopic);
      }
      setQuestionPoolSize(poolQuestions.length);

      // Bank progress (answered vs total) for the current pool
      const answeredCount = poolQuestions.reduce((acc, q) => acc + (answeredIdSet.has(q.questionId) ? 1 : 0), 0);
      setPoolAnsweredCount(answeredCount);
      
      // Adjust question count if needed
      if (poolQuestions.length > 0 && questionCount > poolQuestions.length) {
        setQuestionCount(Math.min(poolQuestions.length, 50));
      }
    } catch (error) {
      console.error('Error loading topic stats:', error);
    }
  };

  const getMotivationNote = () => {
    if (!focusSubject || !subjectStats[focusSubject]) {
      return {
        message: "Start practicing to build your personalized study plan!",
        type: "info"
      };
    }
    
    const stat = subjectStats[focusSubject];
    const accuracy = stat.accuracy || 0;
    
    if (accuracy < 50) {
      return {
        message: `Your accuracy in ${focusSubject} is ${Math.round(accuracy)}%. Focus on understanding the fundamentals - every question you practice brings you closer to mastery!`,
        type: "warning"
      };
    } else if (accuracy < 70) {
      return {
        message: `You're making progress in ${focusSubject} (${Math.round(accuracy)}% accuracy). Keep practicing to strengthen your understanding!`,
        type: "encouraging"
      };
    } else {
      return {
        message: `Great work! You're doing well in ${focusSubject} (${Math.round(accuracy)}% accuracy). Let's push it even higher!`,
        type: "success"
      };
    }
  };

  const handleStartPractice = async () => {
    if (!focusSubject) {
      alert('Please wait for the plan to load');
      return;
    }
    
    if (questionCount < 5) {
      alert('Please select at least 5 questions');
      return;
    }
    
    if (questionCount > questionPoolSize) {
      alert(`Only ${questionPoolSize} questions available for this subject/topic`);
      return;
    }
    
    try {
      setIsStarting(true);
      const config = {
        questionCount: Math.min(questionCount, questionPoolSize),
        subject: focusSubject,
        // Plan practice should allow repeats so you can always practice the full pool,
        // even if you've already answered many of these before.
        allowReattempts: true
      };
      
      if (selectedMode === 'targeted' && focusTopic) {
        config.topics = [focusTopic];
      }
      
      await startExam(EXAM_MODES.WEAK_AREA, config);
      navigate('/exam');
    } catch (error) {
      console.error('Error starting practice:', error);
      alert('Error starting practice: ' + error.message);
      setIsStarting(false);
    }
  };

  const motivation = getMotivationNote();
  const subjectStat = focusSubject ? subjectStats[focusSubject] : null;

  const weakTopicsList = Object.values(topicStats || {})
    .filter(t => t && (t.totalAttempted || 0) > 0)
    .map(t => ({
      ...t,
      weaknessScore: (100 - (t.accuracy || 0)) * Math.log1p(t.totalAttempted || 0)
    }))
    .sort((a, b) => b.weaknessScore - a.weaknessScore)
    .slice(0, 5);

  useEffect(() => {
    const loadMotivation = async () => {
      if (!planDateKey || !focusSubject) return;

      const storageKey = `${PLAN_MOTIVATION_KEY_PREFIX}${planDateKey}`;
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
            dateKey: planDateKey,
            focusSubject,
            focusTopic,
            subjectAccuracy: subjectStat?.accuracy || 0,
            weakestTopics: weakTopicsList
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planDateKey, focusSubject, focusTopic, subjectStat?.accuracy]);

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

  return (
    <div className="min-h-screen bg-bg text-text px-4 py-6 pb-24 md:pb-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <CalendarDaysIcon className="w-8 h-8 text-primary-500" />
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-bold text-text">Today's Study Plan</h1>
              <p className="text-muted text-sm mt-1">
                Plan date: <span className="font-medium text-text">{planDateKey}</span> • Stays the same until tomorrow
              </p>
            </div>
            <button
              onClick={() => {
                try { localStorage.removeItem(PLAN_STORAGE_KEY); } catch {}
                setFocusSubject(null);
                setFocusTopic(null);
                loadPlanData();
              }}
              className="btn-secondary text-sm"
              title="Generate a new plan for today"
            >
              Regenerate
            </button>
          </div>
          <p className="text-muted">Your personalized practice session based on your performance</p>
        </div>

        {/* Today's Focus Card */}
        <div className="card bg-gradient-to-br from-primary-500/10 to-surface border-primary-500/30">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-text mb-2 flex items-center gap-2">
                <SparklesIcon className="w-5 h-5 text-primary-500" />
                Today's Focus
              </h2>
              <div className="space-y-2">
                <div>
                  <span className="text-sm text-muted">Subject:</span>
                  <span className="ml-2 font-semibold text-text">{focusSubject || 'Loading...'}</span>
                </div>
                {focusTopic && selectedMode === 'targeted' && (
                  <div>
                    <span className="text-sm text-muted">Topic:</span>
                    <span className="ml-2 font-semibold text-text">{focusTopic}</span>
                  </div>
                )}
                {subjectStat && (
                  <div className="flex items-center gap-4 mt-3">
                    <div>
                      <span className="text-xs text-muted">Current Accuracy:</span>
                      <span className="ml-2 text-lg font-bold text-primary-500">
                        {Math.round(subjectStat.accuracy || 0)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-muted">Attempts:</span>
                      <span className="ml-2 font-semibold text-text">
                        {subjectStat.totalAttempted || 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-muted">Wrong:</span>
                      <span className="ml-2 font-semibold text-text">
                        {subjectStat.wrongCount || 0}
                      </span>
                    </div>
                  </div>
                )}

                <div className="mt-4 text-sm text-muted">
                  Question bank: <span className="font-semibold text-text">{questionPoolSize}</span> total •{' '}
                  <span className="font-semibold text-text">{poolAnsweredCount}</span> answered •{' '}
                  <span className="font-semibold text-text">{Math.max(0, questionPoolSize - poolAnsweredCount)}</span> remaining
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Daily AI Motivation */}
        <div className="card">
          <div className="flex items-start gap-3">
            <SparklesIcon className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-text mb-1">AI Coach</div>
              {isMotivationLoading ? (
                <div className="text-sm text-muted">Generating today’s motivation...</div>
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

        {/* Motivation Note */}
        <div className={`card border-l-4 ${
          motivation.type === 'warning' ? 'border-red-500 bg-red-500/10' :
          motivation.type === 'success' ? 'border-green-500 bg-green-500/10' :
          'border-primary-500 bg-primary-500/10'
        }`}>
          <div className="flex items-start gap-3">
            <LightBulbIcon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
              motivation.type === 'warning' ? 'text-red-500' :
              motivation.type === 'success' ? 'text-green-500' :
              'text-primary-500'
            }`} />
            <p className="text-sm text-text leading-relaxed">{motivation.message}</p>
          </div>
        </div>

        {/* Weakness Breakdown */}
        <div className="card">
          <h2 className="text-xl font-bold text-text mb-4 flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-primary-500" />
            Weakness Breakdown
          </h2>

          {subjectStat ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-surface rounded-lg p-4 border border-border">
                <div className="text-xs text-muted">Subject accuracy</div>
                <div className="text-2xl font-bold text-text mt-1">{Math.round(subjectStat.accuracy || 0)}%</div>
                <div className="text-xs text-muted mt-1">
                  {subjectStat.correctCount || 0} correct • {subjectStat.wrongCount || 0} wrong
                </div>
              </div>
              <div className="bg-surface rounded-lg p-4 border border-border">
                <div className="text-xs text-muted">Attempts in this subject</div>
                <div className="text-2xl font-bold text-text mt-1">{subjectStat.totalAttempted || 0}</div>
                <div className="text-xs text-muted mt-1">More attempts = better accuracy signal</div>
              </div>
              <div className="bg-surface rounded-lg p-4 border border-border">
                <div className="text-xs text-muted">Question bank (current pool)</div>
                <div className="text-2xl font-bold text-text mt-1">{questionPoolSize}</div>
                <div className="text-xs text-muted mt-1">
                  {poolAnsweredCount} answered • {Math.max(0, questionPoolSize - poolAnsweredCount)} remaining
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted mb-6">Start practicing to generate performance stats.</div>
          )}

          <div className="mb-2 text-sm font-semibold text-text">Weakest topics (ranked)</div>
          {weakTopicsList.length === 0 ? (
            <div className="text-sm text-muted">
              No topic data yet for this subject. Do a few questions, then this list will become detailed.
            </div>
          ) : (
            <div className="space-y-3">
              {weakTopicsList.map((t) => {
                const bankTotal = topicBankCounts[t.topic] || 0;
                const bankAnswered = topicAnsweredCounts[t.topic] || 0;
                return (
                  <div key={t.topic} className="bg-surface rounded-lg p-4 border border-border">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-semibold text-text truncate">{t.topic}</div>
                        <div className="text-xs text-muted mt-1">
                          Bank: {bankTotal} • answered: {bankAnswered}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm text-muted">Accuracy</div>
                        <div className="text-lg font-bold text-primary-500">{Math.round(t.accuracy || 0)}%</div>
                        <div className="text-xs text-muted">Attempts: {t.totalAttempted || 0}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Practice Configuration */}
        <div className="card">
          <h2 className="text-xl font-bold text-text mb-4 flex items-center gap-2">
            <AcademicCapIcon className="w-5 h-5 text-primary-500" />
            Practice Configuration
          </h2>
          
          <div className="space-y-4">
            {/* Mode Selection */}
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Practice Mode
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectedMode('targeted')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    selectedMode === 'targeted'
                      ? 'border-primary-500 bg-primary-500/10'
                      : 'border-border bg-surface'
                  }`}
                >
                  <div className="font-semibold text-text text-sm">Targeted</div>
                  <div className="text-xs text-muted mt-1">Subject + Weakest Topic</div>
                </button>
                <button
                  onClick={() => setSelectedMode('subject-only')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    selectedMode === 'subject-only'
                      ? 'border-primary-500 bg-primary-500/10'
                      : 'border-border bg-surface'
                  }`}
                >
                  <div className="font-semibold text-text text-sm">Subject Focus</div>
                  <div className="text-xs text-muted mt-1">All Topics in Subject</div>
                </button>
              </div>
            </div>

            {/* Question Count */}
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Number of Questions
              </label>
              <input
                type="number"
                min="5"
                max={questionPoolSize}
                value={questionCount}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 5;
                  if (value >= 5 && value <= questionPoolSize) {
                    setQuestionCount(value);
                  } else if (value > questionPoolSize) {
                    setQuestionCount(questionPoolSize);
                  }
                }}
                className="input w-full"
                placeholder={`Max: ${questionPoolSize}`}
              />
              <div className="text-xs text-muted mt-1">
                {questionPoolSize > 0 
                  ? `${questionPoolSize} questions available in ${selectedMode === 'targeted' && focusTopic ? `"${focusTopic}"` : focusSubject}`
                  : 'Loading question pool...'}
              </div>
            </div>
          </div>
        </div>

        {/* Start Button */}
        <button
          className="btn-primary w-full py-4 text-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          onClick={handleStartPractice}
          disabled={isStarting || questionPoolSize === 0 || !focusSubject}
        >
          {isStarting ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span>Starting Practice...</span>
            </>
          ) : (
            <>
              <PlayIcon className="w-5 h-5" />
              <span>Start Today's Practice</span>
            </>
          )}
        </button>

        {/* Info Banner */}
        {subjectStat && subjectStat.totalAttempted === 0 && (
          <div className="card bg-primary-500/10 border-primary-500/30">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-text">
                <p className="font-semibold mb-1">New to this subject?</p>
                <p className="text-muted">
                  Start practicing to build your performance data. Your study plan will become more personalized as you answer more questions!
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

