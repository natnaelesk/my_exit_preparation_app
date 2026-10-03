import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowPathIcon, SparklesIcon, XMarkIcon } from '@heroicons/react/24/outline';
import LoadingAnimation from '../Common/LoadingAnimation';
import StudyChat from './StudyChat';
import { openTopicStudySession } from '../../services/studyService';

const questionPrompt = (question) => [
  'I want to understand this exam question:',
  '',
  question.question,
  '',
  `Choices: ${(question.choices || []).join(' | ')}`,
  `Correct answer: ${question.correctAnswer}`,
  '',
  'Explain why that answer is correct and the others are not, then teach me the topic behind it.',
].join('\n');

/**
 * Study chat for the topic of the current exam question, opened from the question card.
 * Uses the same persisted, server-side tutor as the planner's Study chat.
 */
const StudyTutorModal = ({ question, isOpen, onClose }) => {
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isOpen || !question) return undefined;
    let cancelled = false;
    setSession(null);
    setError('');
    openTopicStudySession(question.subject, question.topic || '')
      .then((opened) => { if (!cancelled) setSession(opened); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Could not open the study chat.'); });
    return () => { cancelled = true; };
  }, [isOpen, question, attempt]);

  if (!isOpen) return null;

  const prompt = question ? questionPrompt(question) : '';
  const hasHistory = session?.messages?.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-primary-500/10 rounded-lg">
              <SparklesIcon className="w-6 h-6 text-primary-500" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-text">Study tutor</h2>
              <p className="text-xs text-muted truncate">
                {question?.subject} - {question?.topic || 'General'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {session && (
              <Link to={`/study/sessions/${session.id}`} className="text-xs text-primary-500 hover:underline hidden sm:inline">
                Open full page
              </Link>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-surface transition-colors text-muted hover:text-text"
              aria-label="Close"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-4 py-3 bg-surface border-b border-border">
          <p className="text-sm text-text font-medium mb-1">Question:</p>
          <p className="text-sm text-muted line-clamp-2">{question?.question}</p>
        </div>

        {error ? (
          <div className="p-4">
            <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-4">
              <p className="text-sm text-red-500">{error}</p>
              <button onClick={() => setAttempt((n) => n + 1)} className="btn-secondary mt-3 text-sm inline-flex items-center gap-2">
                <ArrowPathIcon className="w-4 h-4" /> Try again
              </button>
            </div>
          </div>
        ) : !session ? (
          <div className="flex-1 flex items-center justify-center">
            <LoadingAnimation message="Opening your study chat" />
          </div>
        ) : (
          <StudyChat
            key={`${session.id}-${question?.questionId}`}
            sessionId={session.id}
            initialSession={session}
            startMessage={prompt}
            initialInput={hasHistory ? prompt : ''}
            className="flex-1"
          />
        )}
      </div>
    </div>
  );
};

export default StudyTutorModal;
