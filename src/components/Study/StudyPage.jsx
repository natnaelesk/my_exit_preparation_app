import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AcademicCapIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowUpTrayIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import LoadingAnimation from '../Common/LoadingAnimation';
import {
  deleteStudyDoc,
  downloadStudyDoc,
  listStudyDocs,
  listStudySessions,
  redescribeStudyDoc,
  uploadStudyDoc,
  waitForDescriptions,
} from '../../services/studyService';

const MAX_UPLOAD_MB = 25;

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : '');

const DocCard = ({ doc, onRetry, onDelete, onDownload, busy }) => (
  <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2">
    <div className="flex items-start gap-3">
      <DocumentTextIcon className="w-6 h-6 text-primary-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-text truncate" title={doc.title}>{doc.title || doc.originalFilename}</h3>
        <p className="text-xs text-muted truncate">
          {doc.originalFilename} · {doc.pageCount} page{doc.pageCount === 1 ? '' : 's'} · {formatDate(doc.createdAt)}
        </p>
      </div>
    </div>

    {doc.status === 'describing' && (
      <p className="text-sm text-muted flex items-center gap-2">
        <ArrowPathIcon className="w-4 h-4 animate-spin" /> AI is reading this PDF…
      </p>
    )}
    {doc.status === 'ready' && <p className="text-sm text-text">{doc.description}</p>}
    {doc.status === 'failed' && (
      <div className="text-sm text-red-500 flex items-start gap-2">
        <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>{doc.error}</span>
      </div>
    )}

    {(doc.subject || doc.topics?.length > 0) && (
      <div className="flex flex-wrap gap-1.5">
        {doc.subject && (
          <span className="px-2 py-0.5 rounded-full text-xs bg-primary-500/10 text-primary-500">{doc.subject}</span>
        )}
        {doc.topics?.map((topic) => (
          <span key={topic} className="px-2 py-0.5 rounded-full text-xs bg-surface border border-border text-muted">{topic}</span>
        ))}
      </div>
    )}

    <div className="flex flex-wrap gap-2 pt-1">
      {doc.fileAvailable && (
        <button onClick={() => onDownload(doc)} disabled={busy} className="text-xs px-3 py-1.5 rounded-lg bg-surface border border-border text-text hover:bg-surface/70 inline-flex items-center gap-1">
          <ArrowDownTrayIcon className="w-4 h-4" /> Download
        </button>
      )}
      {doc.status === 'failed' && (
        <button onClick={() => onRetry(doc)} disabled={busy} className="text-xs px-3 py-1.5 rounded-lg bg-primary-500/10 text-primary-500 hover:bg-primary-500/20 inline-flex items-center gap-1">
          <ArrowPathIcon className="w-4 h-4" /> Retry description
        </button>
      )}
      <button onClick={() => onDelete(doc)} disabled={busy} className="text-xs px-3 py-1.5 rounded-lg text-red-500 hover:bg-red-500/10 inline-flex items-center gap-1 ml-auto">
        <TrashIcon className="w-4 h-4" /> Delete
      </button>
    </div>
    {!doc.fileAvailable && doc.status !== 'describing' && (
      <p className="text-xs text-muted">
        The file itself is no longer stored on the server; its description is still used by Study chat.
      </p>
    )}
  </div>
);

const StudyPage = () => {
  const navigate = useNavigate();
  const [docs, setDocs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);
  const cancelledRef = useRef(false);
  const pollingRef = useRef(false);

  const pollDescriptions = async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      await waitForDescriptions({ onUpdate: setDocs, isCancelled: () => cancelledRef.current });
    } catch {
      // A later reload will show the final state.
    } finally {
      pollingRef.current = false;
    }
  };

  const load = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [loadedDocs, loadedSessions] = await Promise.all([listStudyDocs(), listStudySessions()]);
      if (cancelledRef.current) return;
      setDocs(loadedDocs);
      setSessions(loadedSessions);
      if (loadedDocs.some((doc) => doc.status === 'describing')) pollDescriptions();
    } catch (err) {
      if (!cancelledRef.current) setLoadError(err.message || 'Could not load your study materials.');
    } finally {
      if (!cancelledRef.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    cancelledRef.current = false;
    load();
    return () => { cancelledRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uploadFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setActionError('');
    for (const [index, file] of files.entries()) {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        setActionError(`${file.name} is not a PDF.`);
        continue;
      }
      if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
        setActionError(`${file.name} is larger than ${MAX_UPLOAD_MB} MB.`);
        continue;
      }
      setUploadStatus(files.length > 1 ? `Uploading ${index + 1} of ${files.length}: ${file.name}…` : `Uploading ${file.name}…`);
      try {
        const doc = await uploadStudyDoc(file);
        if (cancelledRef.current) return;
        setDocs((current) => [doc, ...current]);
      } catch (err) {
        if (cancelledRef.current) return;
        setActionError(`${file.name}: ${err.message || 'upload failed.'}`);
      }
    }
    setUploadStatus('');
    if (inputRef.current) inputRef.current.value = '';
    pollDescriptions();
  };

  const runDocAction = async (doc, action) => {
    setBusyId(doc.id);
    setActionError('');
    try {
      await action();
    } catch (err) {
      setActionError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRetry = (doc) => runDocAction(doc, async () => {
    const updated = await redescribeStudyDoc(doc.id);
    setDocs((current) => current.map((d) => (d.id === doc.id ? updated : d)));
    pollDescriptions();
  });

  const handleDelete = (doc) => {
    if (!window.confirm(`Delete "${doc.title || doc.originalFilename}"? Study chat will stop using it.`)) return;
    runDocAction(doc, async () => {
      await deleteStudyDoc(doc.id);
      setDocs((current) => current.filter((d) => d.id !== doc.id));
    });
  };

  const handleDownload = (doc) => runDocAction(doc, () => downloadStudyDoc(doc));

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="border-b border-border/50 bg-gradient-to-r from-primary-500/10 via-primary-500/5 to-transparent">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
            <AcademicCapIcon className="w-9 h-9 text-primary-500" /> Study
          </h1>
          <p className="text-muted mt-2">
            Upload your notes and handouts. The AI tutor uses them when you study a plan day or a topic.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10 pb-32 md:pb-8">
        {isLoading ? (
          <div className="py-16 flex justify-center">
            <LoadingAnimation message="Loading your study materials" />
          </div>
        ) : loadError ? (
          <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-4">
            <p className="text-sm text-red-500">{loadError}</p>
            <button onClick={load} className="btn-secondary mt-3 text-sm inline-flex items-center gap-2">
              <ArrowPathIcon className="w-4 h-4" /> Try again
            </button>
          </div>
        ) : (
          <>
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-bold">Study chats</h2>
                <button onClick={() => navigate('/plan')} className="text-sm text-primary-500 hover:underline inline-flex items-center gap-1">
                  <CalendarDaysIcon className="w-4 h-4" /> Study today&apos;s plan
                </button>
              </div>
              {sessions.length === 0 ? (
                <div className="bg-card border border-dashed border-border rounded-xl p-6 text-center text-sm text-muted">
                  No study chats yet. Open the <Link to="/plan" className="text-primary-500 hover:underline">planner</Link> and
                  press <strong className="text-text">Study</strong> to start one for today&apos;s topics.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {sessions.map((session) => (
                    <Link
                      key={session.id}
                      to={`/study/sessions/${session.id}`}
                      className="bg-card border border-border rounded-xl p-4 hover:border-primary-500/50 transition-colors flex items-start gap-3"
                    >
                      <ChatBubbleLeftRightIcon className="w-6 h-6 text-primary-500 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-semibold text-text truncate">{session.title}</p>
                        <p className="text-xs text-muted truncate">{session.topics.join(', ')}</p>
                        <p className="text-xs text-muted mt-1">Last active {formatDate(session.updatedAt)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold">Study materials</h2>
              <div
                onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => { event.preventDefault(); setIsDragging(false); uploadFiles(event.dataTransfer.files); }}
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                  isDragging ? 'border-primary-500 bg-primary-500/5' : 'border-border bg-card'
                }`}
              >
                <ArrowUpTrayIcon className="w-8 h-8 text-primary-500 mx-auto mb-2" />
                <p className="text-sm text-text font-medium">Drop PDFs here, or</p>
                <button
                  onClick={() => inputRef.current?.click()}
                  disabled={Boolean(uploadStatus)}
                  className="btn-primary mt-3 text-sm disabled:opacity-50"
                >
                  Choose PDFs
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  className="hidden"
                  onChange={(event) => uploadFiles(event.target.files)}
                />
                <p className="text-xs text-muted mt-3">
                  Up to {MAX_UPLOAD_MB} MB each. Only you can see your materials. Scanned PDFs work too.
                </p>
                {uploadStatus && <p className="text-sm text-primary-500 mt-3">{uploadStatus}</p>}
              </div>

              {actionError && (
                <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-3 text-sm text-red-500">{actionError}</div>
              )}

              {docs.length === 0 ? (
                <p className="text-sm text-muted text-center py-4">
                  No materials yet. Upload lecture notes or handouts so the tutor can teach from them.
                </p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {docs.map((doc) => (
                    <DocCard
                      key={doc.id}
                      doc={doc}
                      busy={busyId === doc.id}
                      onRetry={handleRetry}
                      onDelete={handleDelete}
                      onDownload={handleDownload}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default StudyPage;
