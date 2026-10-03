import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowPathIcon,
  ChevronDoubleRightIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  PaperAirplaneIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';
import LoadingAnimation from '../Common/LoadingAnimation';
import Markdown from '../Common/Markdown';
import { formatAiMarkdown } from '../../utils/formatAiMarkdown';
import {
  getStudySession,
  retryStudyReply,
  sendStudyMessage,
  waitForStudyReply,
} from '../../services/studyService';

const START_MESSAGE = 'Start the lesson.';

/**
 * Persisted tutor chat for one study session. The server runs the 4-chunk deep-study protocol;
 * this component only sends messages and polls while the tutor is replying.
 */
const StudyChat = ({ sessionId, initialSession = null, startMessage = START_MESSAGE, initialInput = '', className = '' }) => {
  const [session, setSession] = useState(initialSession);
  const [isLoading, setIsLoading] = useState(!initialSession);
  const [loadError, setLoadError] = useState('');
  const [sendError, setSendError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [input, setInput] = useState(initialInput);
  const messagesEndRef = useRef(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, [sessionId]);

  const pollIfThinking = useCallback(async (current) => {
    if (current?.status !== 'thinking') return;
    try {
      const finished = await waitForStudyReply(current.id, { isCancelled: () => cancelledRef.current });
      if (!cancelledRef.current) setSession(finished);
    } catch (err) {
      if (!cancelledRef.current) setSendError(err.message || 'Lost contact with the server. Reload to see the reply.');
    }
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const loaded = await getStudySession(sessionId);
      if (cancelledRef.current) return;
      setSession(loaded);
      pollIfThinking(loaded);
    } catch (err) {
      if (!cancelledRef.current) setLoadError(err.message || 'Could not load this study session.');
    } finally {
      if (!cancelledRef.current) setIsLoading(false);
    }
  }, [sessionId, pollIfThinking]);

  useEffect(() => {
    if (initialSession) {
      setSession(initialSession);
      setIsLoading(false);
      pollIfThinking(initialSession);
    } else {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages?.length, session?.status]);

  const send = async (content) => {
    const text = content.trim();
    if (!text || isSending || session?.status === 'thinking') return;
    setIsSending(true);
    setSendError('');
    const previous = session;
    setSession((current) => ({
      ...current,
      status: 'thinking',
      error: '',
      messages: [...(current?.messages || []), { id: `local-${Date.now()}`, role: 'user', content: text }],
    }));
    setInput('');
    try {
      const updated = await sendStudyMessage(sessionId, text);
      if (cancelledRef.current) return;
      setSession(updated);
      await pollIfThinking(updated);
    } catch (err) {
      if (cancelledRef.current) return;
      setSession(previous);
      setInput(text);
      setSendError(err.message || 'Could not send your message. Please try again.');
    } finally {
      if (!cancelledRef.current) setIsSending(false);
    }
  };

  const retry = async () => {
    setIsSending(true);
    setSendError('');
    setSession((current) => ({ ...current, status: 'thinking', error: '' }));
    try {
      const updated = await retryStudyReply(sessionId);
      if (cancelledRef.current) return;
      setSession(updated);
      await pollIfThinking(updated);
    } catch (err) {
      if (cancelledRef.current) return;
      setSendError(err.message || 'Retry failed. Please try again.');
      load();
    } finally {
      if (!cancelledRef.current) setIsSending(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send(input);
    }
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <LoadingAnimation message="Loading your study session" size="default" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-4">
          <p className="text-sm text-red-500">{loadError}</p>
          <button onClick={load} className="btn-secondary mt-3 text-sm flex items-center gap-2">
            <ArrowPathIcon className="w-4 h-4" /> Try again
          </button>
        </div>
      </div>
    );
  }

  const messages = session?.messages || [];
  const thinking = session?.status === 'thinking';
  const lastMessage = messages[messages.length - 1];
  const canRetry = session?.status === 'failed' && lastMessage?.role === 'user';
  const canContinue = !thinking && !isSending && lastMessage?.role === 'assistant';

  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      {session?.materials?.length > 0 && (
        <div className="px-4 py-2 border-b border-border flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>Using your materials:</span>
          {session.materials.map((doc) => (
            <span key={doc.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface border border-border text-text">
              <DocumentTextIcon className="w-3.5 h-3.5" />
              {doc.title}
            </span>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 && !thinking && (
          <div className="text-center py-10 space-y-4">
            <p className="text-sm text-muted max-w-md mx-auto">
              The tutor teaches {session?.topics?.length ? <strong className="text-text">{session.topics.join(', ')}</strong> : 'this topic'} in
              4 chunks. Each chunk ends with a Memory Lock, Exam Traps and Likely Questions, then waits for you to say
              &ldquo;continue&rdquo;.
            </p>
            <button onClick={() => send(startMessage)} disabled={isSending} className="btn-primary inline-flex items-center gap-2">
              <PlayIcon className="w-5 h-5" /> Start lesson
            </button>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[90%] md:max-w-[80%] rounded-lg p-3 ${
                message.role === 'user' ? 'bg-primary-500 text-white' : 'bg-surface text-text border border-border'
              }`}
            >
              {message.role === 'assistant' ? (
                <Markdown content={formatAiMarkdown(message.content)} />
              ) : (
                <div className="text-sm whitespace-pre-wrap break-words">{message.content}</div>
              )}
            </div>
          </div>
        ))}

        {thinking && (
          <div className="flex justify-start">
            <div className="bg-surface border border-border rounded-lg p-3">
              <LoadingAnimation message="Tutor is thinking" size="small" />
            </div>
          </div>
        )}

        {(session?.status === 'failed' && session?.error) || sendError ? (
          <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-3 flex items-start gap-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm text-red-500">
              <p>{sendError || session.error}</p>
              {canRetry && (
                <button onClick={retry} disabled={isSending} className="mt-2 inline-flex items-center gap-1 font-semibold hover:underline">
                  <ArrowPathIcon className="w-4 h-4" /> Retry reply
                </button>
              )}
              {!canRetry && sendError && thinking && (
                <button onClick={() => { setSendError(''); load(); }} className="mt-2 inline-flex items-center gap-1 font-semibold hover:underline">
                  <ArrowPathIcon className="w-4 h-4" /> Check again
                </button>
              )}
            </div>
          </div>
        ) : null}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-border space-y-2">
        {canContinue && (
          <button
            onClick={() => send('continue')}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-primary-500/10 text-primary-500 font-semibold text-sm hover:bg-primary-500/20 transition-colors inline-flex items-center justify-center gap-2"
          >
            <ChevronDoubleRightIcon className="w-4 h-4" /> Continue
          </button>
        )}
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            maxLength={4000}
            placeholder={messages.length ? 'Ask a question, or type "continue"…' : 'Or ask your own question…'}
            className="flex-1 input resize-none"
            disabled={thinking || isSending}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || thinking || isSending}
            className="btn-primary px-4 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Send"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-muted">Your chat is saved. Come back any time to pick up where you left off.</p>
      </div>
    </div>
  );
};

export default StudyChat;
