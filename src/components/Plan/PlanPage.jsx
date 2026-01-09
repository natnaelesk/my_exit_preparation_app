import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExam } from '../../contexts/ExamContext';
import { calculateSubjectStats, calculateTopicStats } from '../../services/analyticsService';
import { getQuestionsBySubject, getQuestionsByTopic } from '../../services/questionService';
import { EXAM_MODES, OFFICIAL_SUBJECTS } from '../../utils/constants';
import { 
  CalendarDaysIcon, 
  AcademicCapIcon, 
  LightBulbIcon, 
  PlayIcon,
  ClockIcon,
  BookOpenIcon,
  ExclamationTriangleIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

const PlanPage = () => {
  const navigate = useNavigate();
  const { startExam } = useExam();
  
  const [subjectStats, setSubjectStats] = useState({});
  const [focusSubject, setFocusSubject] = useState(null);
  const [focusTopic, setFocusTopic] = useState(null);
  const [topicStats, setTopicStats] = useState({});
  const [questionPoolSize, setQuestionPoolSize] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  
  // Configuration
  const [questionCount, setQuestionCount] = useState(20);
  const [selectedMode, setSelectedMode] = useState('targeted'); // 'targeted' or 'subject-only'
  const [timePerQuestion, setTimePerQuestion] = useState(60);
  const [enableTimer, setEnableTimer] = useState(false);

  useEffect(() => {
    loadPlanData();
  }, []);

  useEffect(() => {
    if (focusSubject) {
      loadTopicStatsAndPoolSize();
    }
  }, [focusSubject, selectedMode]);

  const loadPlanData = async () => {
    try {
      setIsLoading(true);
      const stats = await calculateSubjectStats();
      setSubjectStats(stats);
      
      // Compute weighted weakness score
      const subjectsWithData = Object.values(stats).filter(s => s && s.totalAttempted > 0);
      
      if (subjectsWithData.length === 0) {
        // No data yet - default to first subject
        setFocusSubject(OFFICIAL_SUBJECTS[0]);
        return;
      }

      // Calculate weakness score: (100 - accuracy) * log1p(totalAttempted)
      const weaknessScores = subjectsWithData.map(stat => ({
        subject: stat.subject,
        weaknessScore: (100 - (stat.accuracy || 0)) * Math.log1p(stat.totalAttempted),
        accuracy: stat.accuracy || 0,
        totalAttempted: stat.totalAttempted
      }));

      // Sort by weakness score (highest = worst)
      weaknessScores.sort((a, b) => b.weaknessScore - a.weaknessScore);
      
      const weakestSubject = weaknessScores[0];
      setFocusSubject(weakestSubject.subject);
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
      
      // Find weakest topic
      const topicsWithData = Object.values(topics).filter(t => t && t.totalAttempted > 0);
      if (topicsWithData.length > 0) {
        const weaknessScores = topicsWithData.map(stat => ({
          topic: stat.topic,
          weaknessScore: (100 - (stat.accuracy || 0)) * Math.log1p(stat.totalAttempted),
          accuracy: stat.accuracy || 0
        }));
        weaknessScores.sort((a, b) => b.weaknessScore - a.weaknessScore);
        setFocusTopic(weaknessScores[0].topic);
      } else {
        // No topic data - get first available topic from questions
        const questions = await getQuestionsBySubject(focusSubject);
        const topics = [...new Set(questions.map(q => q.topic).filter(Boolean))];
        if (topics.length > 0) {
          setFocusTopic(topics[0]);
        }
      }
      
      // Load pool size
      if (selectedMode === 'targeted' && focusTopic) {
        const questions = await getQuestionsByTopic(focusSubject, [focusTopic]);
        setQuestionPoolSize(questions.length);
      } else {
        const questions = await getQuestionsBySubject(focusSubject);
        setQuestionPoolSize(questions.length);
      }
      
      // Adjust question count if needed
      if (questionCount > questionPoolSize) {
        setQuestionCount(Math.min(questionPoolSize, 50));
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
        timePerQuestion: enableTimer ? timePerQuestion : null
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
            <h1 className="text-3xl md:text-4xl font-bold text-text">Today's Study Plan</h1>
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
                  </div>
                )}
              </div>
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

            {/* Timer Settings */}
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Timer Settings
              </label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableTimer}
                    onChange={(e) => setEnableTimer(e.target.checked)}
                    className="w-4 h-4 text-primary-500 rounded"
                  />
                  <span className="text-sm text-text">Enable Timer</span>
                </label>
                {enableTimer && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="10"
                      max="300"
                      step="10"
                      value={timePerQuestion}
                      onChange={(e) => setTimePerQuestion(Math.max(10, parseInt(e.target.value) || 60))}
                      className="input w-24 text-sm"
                    />
                    <span className="text-sm text-muted">seconds per question</span>
                  </div>
                )}
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

