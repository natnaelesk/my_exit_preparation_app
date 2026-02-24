import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OFFICIAL_SUBJECTS, EXAM_MODES } from '../../utils/constants';
import { getQuestionsBySubject } from '../../services/questionService';
import { getAnsweredQuestionIds } from '../../services/attemptService';
import { calculateTopicStats } from '../../services/analyticsService';
import { useExam } from '../../contexts/ExamContext';
import LoadingAnimation from '../Common/LoadingAnimation';
import { BookOpenIcon, PlayIcon, FunnelIcon } from '@heroicons/react/24/outline';

const QuestionBank = () => {
  const navigate = useNavigate();
  const { startExam } = useExam();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedSubject, setSelectedSubject] = useState(OFFICIAL_SUBJECTS[0] || '');
  const [includeAnswered, setIncludeAnswered] = useState(true);
  const [questionCount, setQuestionCount] = useState(20);

  const [subjectQuestions, setSubjectQuestions] = useState([]);
  const [answeredIdSet, setAnsweredIdSet] = useState(new Set());
  const [allTopics, setAllTopics] = useState([]);
  const [topicStats, setTopicStats] = useState({});
  const [isTopicsLoading, setIsTopicsLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setError('');
        const answeredIds = await getAnsweredQuestionIds().catch(() => []);
        setAnsweredIdSet(new Set(answeredIds || []));
      } catch (e) {
        setError(e?.message || 'Failed to load question bank.');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  // Load questions + topics for the currently selected subject (single source of truth)
  useEffect(() => {
    const loadSubjectData = async () => {
      if (!selectedSubject) {
        setSubjectQuestions([]);
        setAllTopics([]);
        setTopicStats({});
        return;
      }
      try {
        setIsTopicsLoading(true);
        const questions = await getQuestionsBySubject(selectedSubject);
        const qList = Array.isArray(questions) ? questions : [];
        setSubjectQuestions(qList);

        const topicsSet = new Set();
        qList.forEach((q) => {
          if (q.topic) topicsSet.add(q.topic);
        });
        setAllTopics(Array.from(topicsSet).sort());

        const stats = await calculateTopicStats(selectedSubject);
        setTopicStats(stats || {});
      } catch (err) {
        console.error('Error loading subject data:', err);
        setSubjectQuestions([]);
        setAllTopics([]);
        setTopicStats({});
      } finally {
        setIsTopicsLoading(false);
      }
    };

    loadSubjectData();
  }, [selectedSubject]);

  const current = useMemo(() => {
    const total = subjectQuestions.length;
    const answered = subjectQuestions.filter((q) => answeredIdSet.has(q.questionId)).length;
    return { total, answered };
  }, [subjectQuestions, answeredIdSet]);

  const remaining = Math.max(0, (current.total || 0) - (current.answered || 0));
  const maxSelectable = includeAnswered ? current.total : remaining;

  useEffect(() => {
    if (maxSelectable > 0 && questionCount > maxSelectable) {
      setQuestionCount(Math.min(50, maxSelectable));
    }
  }, [maxSelectable, questionCount]);

  const handleStart = async () => {
    if (!selectedSubject) return;
    if (maxSelectable <= 0) {
      alert('No questions available for this subject.');
      return;
    }
    const count = Math.min(questionCount, maxSelectable);
    if (count < 1) {
      alert('Please choose at least 1 question.');
      return;
    }

    // Start a subject-only practice session (no exam doc is created).
    // includeAnswered=true => allowReattempts=true
    await startExam(EXAM_MODES.SUBJECT, {
      subject: selectedSubject,
      questionCount: count,
      allowReattempts: includeAnswered
    });
    navigate('/exam');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center pb-24 md:pb-6">
        <LoadingAnimation message="Loading question bank" size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4 pb-24 md:pb-6">
        <div className="card text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text px-4 py-6 pb-24 md:pb-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <BookOpenIcon className="w-7 h-7 text-primary-500" />
          <div>
            <h1 className="text-3xl font-bold text-text">Question Bank</h1>
            <p className="text-sm text-muted">Pick a subject and practice directly from the full bank.</p>
          </div>
        </div>

        <div className="card space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text mb-2">Subject</label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="input w-full"
              >
                {OFFICIAL_SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s} {s === selectedSubject ? `(${subjectQuestions.length})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-surface rounded-lg p-4 border border-border">
              <div className="text-xs text-muted">This subject</div>
              <div className="mt-1 text-sm text-text">
                Total: <span className="font-semibold">{current.total}</span> • Answered:{' '}
                <span className="font-semibold">{current.answered}</span> • Remaining:{' '}
                <span className="font-semibold">{remaining}</span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <FunnelIcon className="w-4 h-4 text-primary-500" />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAnswered}
                    onChange={(e) => setIncludeAnswered(e.target.checked)}
                    className="w-4 h-4 text-primary-500 rounded"
                  />
                  <span className="text-sm text-text">Include answered questions</span>
                </label>
              </div>
              <div className="text-xs text-muted mt-1">
                {includeAnswered ? 'You will practice from ALL questions.' : 'You will practice from unanswered only.'}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-2">Number of Questions</label>
            <input
              type="number"
              min="1"
              max={Math.max(1, maxSelectable)}
              value={questionCount}
              onChange={(e) => setQuestionCount(Math.max(1, parseInt(e.target.value) || 1))}
              className="input w-full"
            />
            <div className="text-xs text-muted mt-1">Max: {maxSelectable || 0}</div>
          </div>

          <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={handleStart}>
            <PlayIcon className="w-5 h-5" />
            Start Subject Practice
          </button>
        </div>

        {/* Topics for selected subject (similar to Plan page, but subject is user-selected) */}
        {selectedSubject && (
          <div className="card mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BookOpenIcon className="w-6 h-6 text-primary-500" />
                <div>
                  <h2 className="text-xl font-bold text-text">Topics in {selectedSubject}</h2>
                  <p className="text-xs text-muted">
                    Based on all questions in the bank for this subject.
                  </p>
                </div>
              </div>
              <span className="text-sm text-muted bg-surface px-3 py-1 rounded-full">
                {allTopics.length} topics
              </span>
            </div>

            {isTopicsLoading ? (
              <div className="py-8">
                <LoadingAnimation message="Loading topics..." size="medium" />
              </div>
            ) : allTopics.length === 0 ? (
              <div className="py-6 text-sm text-muted">
                No topics found yet for this subject. Upload more questions with topics to see them here.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {allTopics.map((topic) => {
                  const stats = topicStats[topic];
                  const accuracy = stats?.accuracy || 0;
                  const attempts = stats?.totalAttempted || 0;

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
                            <div
                              className={`text-lg font-bold ${
                                accuracy >= 80
                                  ? 'text-green-500'
                                  : accuracy >= 60
                                  ? 'text-yellow-500'
                                  : 'text-red-500'
                              }`}
                            >
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
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionBank;


