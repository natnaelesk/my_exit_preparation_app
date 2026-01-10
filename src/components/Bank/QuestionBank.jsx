import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OFFICIAL_SUBJECTS, EXAM_MODES } from '../../utils/constants';
import { getAllQuestions } from '../../services/questionService';
import { getAnsweredQuestionIds } from '../../services/attemptService';
import { useExam } from '../../contexts/ExamContext';
import { BookOpenIcon, PlayIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { normalizeSubject } from '../../utils/subjectNormalization';

const QuestionBank = () => {
  const navigate = useNavigate();
  const { startExam } = useExam();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedSubject, setSelectedSubject] = useState(OFFICIAL_SUBJECTS[0] || '');
  const [includeAnswered, setIncludeAnswered] = useState(true);
  const [questionCount, setQuestionCount] = useState(20);

  const [allQuestions, setAllQuestions] = useState([]);
  const [answeredIdSet, setAnsweredIdSet] = useState(new Set());

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setError('');
        const [qs, answeredIds] = await Promise.all([
          getAllQuestions(),
          getAnsweredQuestionIds().catch(() => [])
        ]);
        setAllQuestions(qs || []);
        setAnsweredIdSet(new Set(answeredIds || []));
      } catch (e) {
        setError(e?.message || 'Failed to load question bank.');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const subjectSummary = useMemo(() => {
    const bySubject = {};
    for (const s of OFFICIAL_SUBJECTS) {
      bySubject[s] = { total: 0, answered: 0 };
    }
    for (const q of allQuestions) {
      const normalized = normalizeSubject(q.subject) || String(q.subject || '').trim() || 'Unknown';
      // Only count into official buckets; everything else is ignored for the selector count.
      if (!bySubject[normalized]) continue;
      bySubject[normalized].total += 1;
      if (answeredIdSet.has(q.questionId)) bySubject[normalized].answered += 1;
    }
    return bySubject;
  }, [allQuestions, answeredIdSet]);

  const current = subjectSummary[selectedSubject] || { total: 0, answered: 0 };
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
        <div className="text-muted">Loading question bank...</div>
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

        <div className="card space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text mb-2">Subject</label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="input w-full"
              >
                {OFFICIAL_SUBJECTS.map((s) => {
                  const sum = subjectSummary[s] || { total: 0, answered: 0 };
                  return (
                    <option key={s} value={s}>
                      {s} ({sum.total})
                    </option>
                  );
                })}
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
      </div>
    </div>
  );
};

export default QuestionBank;


