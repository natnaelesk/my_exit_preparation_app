import { get, post, upload, del } from './apiClient';

const POLL_INTERVAL_MS = 2500;

export const uploadExamPdf = async (file, title = '') => {
  const formData = new FormData();
  formData.append('file', file);
  if (title) {
    formData.append('title', title);
  }
  return upload('/exam-imports/', formData);
};

export const startExtraction = async (importId) => post(`/exam-imports/${importId}/extract/`);

export const getExamImport = async (importId) => get(`/exam-imports/${importId}/`);

export const deleteExamImport = async (importId) => del(`/exam-imports/${importId}/`);

/**
 * Poll an import until extraction stops (ready/failed/pending), reporting each update.
 * Resolves with the final import; `isCancelled()` stops polling early.
 */
export const waitForExtraction = async (importId, { onUpdate, isCancelled = () => false } = {}) => {
  for (;;) {
    const examImport = await getExamImport(importId);
    if (isCancelled()) return examImport;
    onUpdate?.(examImport);
    if (examImport.status !== 'extracting') return examImport;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
};

/**
 * Publish reviewed questions as an exam. Errors carry `questionErrors` ([{ index, errors }]) when validation fails.
 */
export const publishExamImport = async (importId, title, questions) => {
  try {
    return await post(`/exam-imports/${importId}/publish/`, { title, questions });
  } catch (error) {
    error.questionErrors = error.data?.questionErrors || [];
    throw error;
  }
};
