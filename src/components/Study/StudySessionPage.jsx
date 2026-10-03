import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon, ArrowPathIcon, TrashIcon } from '@heroicons/react/24/outline';
import LoadingAnimation from '../Common/LoadingAnimation';
import StudyChat from './StudyChat';
import { deleteStudySession, getStudySession } from '../../services/studyService';

const StudySessionPage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');

  const load = async (isCancelled = () => false) => {
    setError('');
    try {
      const loaded = await getStudySession(sessionId);
      if (!isCancelled()) setSession(loaded);
    } catch (err) {
      if (!isCancelled()) {
        setError(err.status === 404 ? 'This study chat does not exist.' : (err.message || 'Could not load this study chat.'));
      }
    }
  };

  useEffect(() => {
    let cancelled = false;
    setSession(null);
    load(() => cancelled);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const handleStartOver = async () => {
    if (!window.confirm('Delete this chat history? You can start a fresh chat for the same plan day or topic afterwards.')) return;
    try {
      await deleteStudySession(sessionId);
      navigate('/study');
    } catch (err) {
      setError(err.message || 'Could not delete this chat.');
    }
  };

  return (
    <div className="h-[100dvh] pb-20 md:pb-0 flex flex-col bg-bg text-text">
      <div className="border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/study" className="p-2 rounded-lg hover:bg-surface text-muted hover:text-text" aria-label="Back to Study">
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-bold text-text truncate">{session?.title || 'Study chat'}</h1>
          {session?.topics?.length > 0 && <p className="text-xs text-muted truncate">{session.topics.join(', ')}</p>}
        </div>
        {session && (
          <button onClick={handleStartOver} className="p-2 rounded-lg text-muted hover:text-red-500 hover:bg-red-500/10" title="Delete chat history">
            <TrashIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      {error ? (
        <div className="p-4">
          <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-4 max-w-xl">
            <p className="text-sm text-red-500">{error}</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => load()} className="btn-secondary text-sm inline-flex items-center gap-2">
                <ArrowPathIcon className="w-4 h-4" /> Try again
              </button>
              <Link to="/study" className="btn-secondary text-sm">Back to Study</Link>
            </div>
          </div>
        </div>
      ) : !session ? (
        <div className="flex-1 flex items-center justify-center">
          <LoadingAnimation message="Loading your study chat" />
        </div>
      ) : (
        <StudyChat key={session.id} sessionId={session.id} initialSession={session} className="flex-1 max-w-4xl w-full mx-auto" />
      )}
    </div>
  );
};

export default StudySessionPage;
