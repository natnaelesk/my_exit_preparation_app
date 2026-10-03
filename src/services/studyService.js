import { get, post, upload, del, getBlob } from './apiClient';

const POLL_INTERVAL_MS = 2000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---- Study materials ----

export const listStudyDocs = async () => (await get('/study-docs/')) || [];

export const getStudyDoc = async (docId) => get(`/study-docs/${docId}/`);

export const uploadStudyDoc = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return upload('/study-docs/', formData);
};

export const redescribeStudyDoc = async (docId) => post(`/study-docs/${docId}/describe/`);

export const deleteStudyDoc = async (docId) => del(`/study-docs/${docId}/`);

/**
 * Download the owner's PDF through the authenticated API and save it with its original name.
 */
export const downloadStudyDoc = async (doc) => {
  const blob = await getBlob(`/study-docs/${doc.id}/file/`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = doc.originalFilename || 'study.pdf';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// ---- Study chat ----

export const listStudySessions = async () => (await get('/study-sessions/')) || [];

/** Open (or resume) the Study chat for a daily plan day. */
export const openPlanStudySession = async (planDateKey) => post('/study-sessions/', { planDateKey });

/** Open (or resume) the Study chat for a subject/topic. */
export const openTopicStudySession = async (subject, topic) => post('/study-sessions/', { subject, topic });

export const getStudySession = async (sessionId) => get(`/study-sessions/${sessionId}/`);

export const sendStudyMessage = async (sessionId, content) => (
  post(`/study-sessions/${sessionId}/messages/`, { content })
);

export const retryStudyReply = async (sessionId) => post(`/study-sessions/${sessionId}/retry/`);

export const deleteStudySession = async (sessionId) => del(`/study-sessions/${sessionId}/`);

/**
 * Poll until the tutor finishes replying. Resolves with the final session; `isCancelled()` stops early.
 */
export const waitForStudyReply = async (sessionId, { isCancelled = () => false } = {}) => {
  for (;;) {
    const session = await getStudySession(sessionId);
    if (isCancelled() || session.status !== 'thinking') return session;
    await sleep(POLL_INTERVAL_MS);
  }
};

/**
 * Poll study docs while any are still being described.
 */
export const waitForDescriptions = async ({ onUpdate, isCancelled = () => false } = {}) => {
  for (;;) {
    await sleep(POLL_INTERVAL_MS + 1000);
    if (isCancelled()) return;
    const docs = await listStudyDocs();
    if (isCancelled()) return;
    onUpdate?.(docs);
    if (!docs.some((doc) => doc.status === 'describing')) return;
  }
};
