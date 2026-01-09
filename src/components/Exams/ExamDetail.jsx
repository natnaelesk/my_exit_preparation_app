import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getExamById } from '../../services/examService';
import { getQuestionsByIds } from '../../services/questionService';
import { getExamSessions, resumeExamSession } from '../../services/examEngine';
import { calculateExamSubjectStats } from '../../services/analyticsService';
import { useExam } from '../../contexts/ExamContext';
import { EXAM_MODES } from '../../utils/constants';
import { format } from 'date-fns';
import { BookOpenIcon, ExclamationTriangleIcon, PlayIcon, ArrowPathIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

const ExamDetail = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { startExam, resumeExam } = useExam();
  
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [progress, setProgress] = useState(null);
  const [subjectStats, setSubjectStats] = useState({});
  const [topicBreakdown, setTopicBreakdown] = useState({});
  
  // Exam Configuration State
  const [selectedMode, setSelectedMode] = useState(EXAM_MODES.RANDOM);
  const [questionCount, setQuestionCount] = useState(50);
  const [maxQuestions, setMaxQuestions] = useState(50);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [timePerQuestion, setTimePerQuestion] = useState(60);
  const [enableTimer, setEnableTimer] = useState(true);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (examId) {
      loadExamData();
    }
  }, [examId]);

  const loadExamData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load exam
      const examData = await getExamById(examId);
      setExam(examData);

      // Load questions
      if (examData.questionIds && examData.questionIds.length > 0) {
        const questionsData = await getQuestionsByIds(examData.questionIds);
        setQuestions(questionsData);
        
        // Set max questions and default question count
        const maxQ = questionsData.length;
        setMaxQuestions(maxQ);
        setQuestionCount(Math.min(50, maxQ));

        // Build topic breakdown
        const topics = {};
        questionsData.forEach(q => {
          const key = `${q.subject}::${q.topic || 'General'}`;
          if (!topics[key]) {
            topics[key] = {
              subject: q.subject,
              topic: q.topic || 'General',
              count: 0,
              questionIds: []
            };
          }
          topics[key].count++;
          topics[key].questionIds.push(q.questionId);
        });
        setTopicBreakdown(topics);
        
        // Get available subjects for subject-focused mode
        const subjects = [...new Set(questionsData.map(q => q.subject))];
        setAvailableSubjects(subjects.sort());
        if (subjects.length > 0 && !selectedSubject) {
          setSelectedSubject(subjects[0]);
        }
      }

      // Load progress
      const sessions = await getExamSessions(examId);
      if (sessions.length > 0) {
        const latestSession = sessions[0];
        const answeredCount = Object.keys(latestSession.answers || {}).length;
        const totalQuestions = latestSession.questionIds?.length || 0;
        const progressPercent = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

        setProgress({
          sessionId: latestSession.sessionId,
          answeredCount,
          totalQuestions,
          progressPercent: Math.round(progressPercent),
          isComplete: latestSession.isComplete || false,
          hasProgress: answeredCount > 0,
          lastAttempt: latestSession.lastUpdated,
          startedAt: latestSession.startedAt
        });

        // Load stats if there's progress
        if (answeredCount > 0) {
          try {
            const stats = await calculateExamSubjectStats(examId);
            setSubjectStats(stats);
          } catch (err) {
            console.error('Error loading exam stats:', err);
          }
        }
      }
    } catch (err) {
      setError(err.message);
      console.error('Error loading exam data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartExam = async () => {
    try {
      const config = {
        examId,
        questionCount: Math.min(questionCount, maxQuestions),
        timePerQuestion: enableTimer ? timePerQuestion : null
      };

      if (selectedMode === 'exam-subject-focused') {
        if (!selectedSubject) {
          alert('Please select a subject for subject-focused mode');
          return;
        }
        config.subject = selectedSubject;
      }

      await startExam(selectedMode, config);
      navigate('/exam');
    } catch (error) {
      console.error('Error starting exam:', error);
      alert('Error starting exam: ' + error.message);
    }
  };

  const handleResume = async () => {
    try {
      await resumeExam(progress.sessionId);
      navigate('/exam');
    } catch (err) {
      alert('Error resuming exam: ' + err.message);
    }
  };

  const handleRestart = async () => {
    if (window.confirm('Are you sure you want to start a new attempt? Your previous attempts and analysis data will be preserved.')) {
      await handleStartExam();
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'STRONG': return { bg: 'bg-green-500/10', border: 'border-green-500/50', text: 'text-green-500', label: 'bg-green-500/20' };
      case 'MEDIUM': return { bg: 'bg-yellow-500/10', border: 'border-yellow-500/50', text: 'text-yellow-500', label: 'bg-yellow-500/20' };
      case 'WEAK': return { bg: 'bg-red-500/10', border: 'border-red-500/50', text: 'text-red-500', label: 'bg-red-500/20' };
      default: return { bg: 'bg-surface', border: 'border-border', text: 'text-text-secondary', label: 'bg-surface' };
    }
  };

  const subjectList = Object.keys(subjectStats);
  const strongSubjects = subjectList.filter(s => subjectStats[s]?.status === 'STRONG');
  const weakSubjects = subjectList.filter(s => subjectStats[s]?.status === 'WEAK');
  const mediumSubjects = subjectList.filter(s => subjectStats[s]?.status === 'MEDIUM');

  // Calculate overall stats
  let totalCorrect = 0;
  let totalWrong = 0;
  let maxScore = 0;
  let avgScore = 0;
  
  Object.values(subjectStats).forEach(stat => {
    totalCorrect += stat.correctCount || 0;
    totalWrong += stat.wrongCount || 0;
    if (stat.totalAttempted > 0) {
      maxScore = Math.max(maxScore, stat.accuracy);
      avgScore += stat.accuracy;
    }
  });
  
  const totalAttempted = totalCorrect + totalWrong;
  const overallAccuracy = totalAttempted > 0 ? (totalCorrect / totalAttempted) * 100 : 0;
  avgScore = subjectList.length > 0 ? avgScore / subjectList.length : 0;

  // Group questions by subject
  const questionsBySubject = {};
  questions.forEach(q => {
    if (!questionsBySubject[q.subject]) {
      questionsBySubject[q.subject] = [];
    }
    questionsBySubject[q.subject].push(q);
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <div className="text-text-secondary">Loading exam details...</div>
        </div>
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="card text-center max-w-md">
          <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-text mb-2">Exam Not Found</h3>
          <p className="text-text-secondary mb-4">{error || 'The exam you\'re looking for doesn\'t exist.'}</p>
          <button className="btn-primary" onClick={() => navigate('/exams')}>
            Back to Exams
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text pb-24 md:pb-6">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header Section - Modern 2025 Style */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-6">
            {/* Big Title */}
            <div className="flex-1">
              <h1 className="text-4xl md:text-5xl font-bold text-text mb-2 leading-tight">
                {exam.title}
              </h1>
              <div className="flex items-center gap-4 text-sm text-text-secondary mt-2">
                <span className="flex items-center gap-1"><BookOpenIcon className="w-4 h-4" /> {questions.length} Questions</span>
                <span className="flex items-center gap-1"><BookOpenIcon className="w-4 h-4" /> {Object.keys(questionsBySubject).length} Subjects</span>
                {exam.createdAt && (
                  <span>{formatDate(exam.createdAt)}</span>
                )}
              </div>
            </div>

          </div>

          {/* Exam Configuration Section */}
          <div className="p-6 bg-gradient-to-br from-dark-card to-dark-surface rounded-xl border border-border mb-6">
            <h2 className="text-xl font-bold text-text mb-4">Exam Configuration</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {/* Mode Selection */}
              <div>
                <label className="block text-sm font-medium text-text mb-2">
                  Exam Mode
                </label>
                <select
                  value={selectedMode}
                  onChange={(e) => {
                    setSelectedMode(e.target.value);
                    if (e.target.value !== 'exam-subject-focused') {
                      setSelectedSubject('');
                    }
                  }}
                  className="input w-full"
                >
                  <option value={EXAM_MODES.RANDOM}>Random</option>
                  <option value="exam-weak-area">Weak Area</option>
                  <option value="exam-subject-focused">Subject Focused</option>
                </select>
              </div>

              {/* Subject Selection (for subject-focused mode) */}
              {selectedMode === 'exam-subject-focused' && (
                <div>
                  <label className="block text-sm font-medium text-text mb-2">
                    Subject
                  </label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="input w-full"
                  >
                    <option value="">Select Subject</option>
                    {availableSubjects.map(subject => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Question Count */}
              <div>
                <label className="block text-sm font-medium text-text mb-2">
                  Number of Questions
                </label>
                <input
                  type="number"
                  min="1"
                  max={maxQuestions}
                  value={questionCount}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 1;
                    if (value >= 1 && value <= maxQuestions) {
                      setQuestionCount(value);
                    } else if (value > maxQuestions) {
                      setQuestionCount(maxQuestions);
                    }
                  }}
                  onBlur={(e) => {
                    const value = parseInt(e.target.value) || 1;
                    if (value < 1) {
                      setQuestionCount(1);
                    } else if (value > maxQuestions) {
                      setQuestionCount(maxQuestions);
                    }
                  }}
                  className="input w-full"
                  placeholder={`Max: ${maxQuestions}`}
                />
                <div className="text-xs text-text-secondary mt-1">
                  Maximum: {maxQuestions} questions available
                </div>
              </div>

              {/* Timer Settings */}
              <div>
                <label className="block text-sm font-medium text-text mb-2">
                  Timer
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={enableTimer}
                      onChange={(e) => setEnableTimer(e.target.checked)}
                      className="w-4 h-4 text-primary-500 rounded"
                    />
                    <span className="text-sm text-text-secondary">Enable</span>
                  </label>
                  {enableTimer && (
                    <input
                      type="number"
                      min="10"
                      max="300"
                      step="10"
                      value={timePerQuestion}
                      onChange={(e) => setTimePerQuestion(Math.max(10, parseInt(e.target.value) || 60))}
                      className="input w-20 text-sm"
                    />
                  )}
                </div>
                {enableTimer && (
                  <div className="text-xs text-text-secondary mt-1">
                    {Math.floor(timePerQuestion / 60)}m {timePerQuestion % 60}s per question
                  </div>
                )}
              </div>
            </div>

            {/* Action Button - Single Clear Button */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              {progress && progress.hasProgress && !progress.isComplete ? (
                <button
                  className="btn-primary px-8 py-3 font-semibold text-base"
                  onClick={handleResume}
                >
                  <span className="flex items-center gap-2"><PlayIcon className="w-4 h-4" /> Resume Exam ({progress.progressPercent}%)</span>
                </button>
              ) : (
                <button
                  className="btn-primary px-8 py-3 font-semibold text-base"
                  onClick={progress?.isComplete ? handleRestart : handleStartExam}
                  disabled={selectedMode === 'exam-subject-focused' && !selectedSubject}
                >
                  <span className="flex items-center gap-2">{progress?.isComplete ? <ArrowPathIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />} {progress?.isComplete ? 'Start New Attempt' : 'Start Exam'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Divider Line */}
          <div className="h-px bg-gradient-to-r from-transparent via-primary-500/30 to-transparent mb-6"></div>
        </div>

        {/* Progress Overview - If has progress */}
        {progress && progress.hasProgress && (
          <div className="mb-8 p-6 bg-gradient-to-br from-dark-card to-dark-surface rounded-2xl border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-text">Your Progress</h2>
              <span className={`text-3xl font-bold ${progress.isComplete ? 'text-green-500' : 'text-primary-500'}`}>
                {progress.progressPercent}%
              </span>
            </div>
            <div className="w-full h-3 bg-bg rounded-full overflow-hidden mb-4">
              <div 
                className={`h-full transition-all duration-500 rounded-full ${
                  progress.isComplete ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gradient-to-r from-primary-500 to-primary-600'
                }`}
                style={{ width: `${progress.progressPercent}%` }}
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-bg rounded-lg border border-border">
                <div className="text-2xl font-bold text-text">{progress.answeredCount}</div>
                <div className="text-xs text-text-secondary mt-1">Answered</div>
              </div>
              <div className="text-center p-3 bg-bg rounded-lg border border-border">
                <div className="text-2xl font-bold text-green-500">{totalCorrect}</div>
                <div className="text-xs text-text-secondary mt-1">Correct</div>
              </div>
              <div className="text-center p-3 bg-bg rounded-lg border border-border">
                <div className="text-2xl font-bold text-red-500">{totalWrong}</div>
                <div className="text-xs text-text-secondary mt-1">Wrong</div>
              </div>
              <div className="text-center p-3 bg-bg rounded-lg border border-border">
                <div className="text-2xl font-bold text-primary-500">{Math.round(overallAccuracy)}%</div>
                <div className="text-xs text-text-secondary mt-1">Accuracy</div>
              </div>
            </div>
          </div>
        )}

        {/* Detailed Insights & Analysis */}
        {progress && progress.hasProgress ? (
          <div className="space-y-6">
            {/* Performance Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 bg-card rounded-xl border border-border">
                <div className="text-sm text-text-secondary mb-2 uppercase tracking-wide">Max Score</div>
                <div className="text-3xl font-bold text-primary-500">{Math.round(maxScore)}%</div>
                <div className="text-xs text-text-secondary mt-1">Highest subject accuracy</div>
              </div>
              <div className="p-5 bg-card rounded-xl border border-border">
                <div className="text-sm text-text-secondary mb-2 uppercase tracking-wide">Average Score</div>
                <div className="text-3xl font-bold text-primary-500">{Math.round(avgScore)}%</div>
                <div className="text-xs text-text-secondary mt-1">Across all subjects</div>
              </div>
              <div className="p-5 bg-card rounded-xl border border-border">
                <div className="text-sm text-text-secondary mb-2 uppercase tracking-wide">Completion</div>
                <div className="text-3xl font-bold text-primary-500">{progress.progressPercent}%</div>
                <div className="text-xs text-text-secondary mt-1">{progress.isComplete ? 'Completed' : 'In Progress'}</div>
              </div>
            </div>

            {/* Strong Areas */}
            {strongSubjects.length > 0 && (
              <div className="p-6 bg-gradient-to-br from-green-500/10 to-transparent rounded-xl border border-green-500/30">
                <h3 className="text-xl font-bold text-green-500 mb-4 flex items-center gap-2">
                  <CheckCircleIcon className="w-5 h-5" /> Strong Areas
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {strongSubjects.map(subject => {
                    const stat = subjectStats[subject];
                    const colors = getStatusColor('STRONG');
                    return (
                      <div key={subject} className={`p-4 ${colors.bg} rounded-lg border ${colors.border}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-semibold text-text text-sm">{subject}</div>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${colors.text}`}>
                            STRONG
                          </span>
                        </div>
                        <div className="text-2xl font-bold text-green-500 mb-1">{Math.round(stat.accuracy)}%</div>
                        <div className="text-xs text-text-secondary">
                          {stat.correctCount} / {stat.totalAttempted} correct
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Critical Areas (Weak) */}
            {weakSubjects.length > 0 && (
              <div className="p-6 bg-gradient-to-br from-red-500/10 to-transparent rounded-xl border border-red-500/30">
                <h3 className="text-xl font-bold text-red-500 mb-4 flex items-center gap-2">
                  <ExclamationTriangleIcon className="w-5 h-5" /> Critical Areas - Need Improvement
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {weakSubjects.map(subject => {
                    const stat = subjectStats[subject];
                    const colors = getStatusColor('WEAK');
                    return (
                      <div key={subject} className={`p-4 ${colors.bg} rounded-lg border ${colors.border}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-semibold text-text text-sm">{subject}</div>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${colors.text}`}>
                            WEAK
                          </span>
                        </div>
                        <div className="text-2xl font-bold text-red-500 mb-1">{Math.round(stat.accuracy)}%</div>
                        <div className="text-xs text-text-secondary">
                          {stat.correctCount} / {stat.totalAttempted} correct
                        </div>
                        <div className="text-xs text-red-400 mt-1">
                          {stat.wrongCount} wrong answers
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* All Subject Performance */}
            <div className="p-6 bg-card rounded-xl border border-border">
              <h3 className="text-xl font-bold text-text mb-4">Subject Performance Analysis</h3>
              <div className="space-y-3">
                {Object.entries(subjectStats)
                  .sort((a, b) => a[1].accuracy - b[1].accuracy) // Sort by accuracy (weakest first)
                  .map(([subject, stat]) => {
                    const colors = getStatusColor(stat.status);
                    const barWidth = Math.max(5, stat.accuracy);
                    return (
                      <div key={subject} className={`p-4 ${colors.bg} rounded-lg border ${colors.border}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-semibold text-text">{subject}</div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-text-secondary">
                              {stat.correctCount} / {stat.wrongCount}
                            </span>
                            <span className={`text-lg font-bold ${colors.text}`}>
                              {Math.round(stat.accuracy)}%
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${colors.text} ${colors.label}`}>
                              {stat.status}
                            </span>
                          </div>
                        </div>
                        <div className="w-full h-2 bg-bg rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${colors.bg.replace('/10', '')}`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <div className="text-xs text-text-secondary mt-2">
                          {stat.totalAttempted} questions attempted
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        ) : (
          /* Topics Covered - When no progress yet */
          <div className="space-y-6">
            <div className="p-6 bg-card rounded-xl border border-border">
              <h3 className="text-xl font-bold text-text mb-4">Topics Covered</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(questionsBySubject).map(([subject, subjectQuestions]) => (
                  <div key={subject} className="p-4 bg-surface rounded-lg border border-border">
                    <div className="font-semibold text-text mb-2">{subject}</div>
                    <div className="text-sm text-text-secondary">
                      {subjectQuestions.length} questions
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {[...new Set(subjectQuestions.map(q => q.topic || 'General'))].slice(0, 3).map(topic => (
                        <span key={topic} className="text-xs bg-bg px-2 py-0.5 rounded border border-border text-text-secondary">
                          {topic}
                        </span>
                      ))}
                      {[...new Set(subjectQuestions.map(q => q.topic || 'General'))].length > 3 && (
                        <span className="text-xs text-primary-500">
                          +{[...new Set(subjectQuestions.map(q => q.topic || 'General'))].length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Back Button */}
        <div className="mt-8">
          <button
            className="btn-secondary"
            onClick={() => navigate('/exams')}
          >
            ← Back to Exams
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExamDetail;

