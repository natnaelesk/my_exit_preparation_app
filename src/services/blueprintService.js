import { get, getAll, post, upload, del } from './apiClient';

const POLL_INTERVAL_MS = 2500;

export const uploadBlueprintPdf = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return upload('/blueprint-imports/', formData);
};

export const listBlueprintImports = async () => getAll('/blueprint-imports/');

export const startBlueprintExtraction = async (importId) => post(`/blueprint-imports/${importId}/extract/`);

export const getBlueprintImport = async (importId) => get(`/blueprint-imports/${importId}/`);

export const deleteBlueprintImport = async (importId) => del(`/blueprint-imports/${importId}/`);

/**
 * Poll an import until extraction stops (ready/failed/pending), reporting each update.
 * Resolves with the final import; `isCancelled()` stops polling early.
 */
export const waitForBlueprintExtraction = async (importId, { onUpdate, isCancelled = () => false } = {}) => {
  for (;;) {
    const blueprintImport = await getBlueprintImport(importId);
    if (isCancelled()) return blueprintImport;
    onUpdate?.(blueprintImport);
    if (blueprintImport.status !== 'extracting') return blueprintImport;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
};

/**
 * Apply the reviewed draft: it joins the blueprint history and becomes the active curriculum.
 * Errors carry `draftErrors` (strings) when validation fails.
 */
export const applyBlueprintImport = async (importId, draft) => {
  try {
    return await post(`/blueprint-imports/${importId}/apply/`, draft);
  } catch (error) {
    error.draftErrors = error.data?.draftErrors || [];
    throw error;
  }
};

/** The active curriculum, or null when no blueprint has been applied yet. */
export const getActiveBlueprint = async () => {
  try {
    return await get('/blueprint/');
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
};

export const listBlueprints = async () => getAll('/blueprints/');

export const getBlueprint = async (blueprintId) => get(`/blueprints/${blueprintId}/`);

export const activateBlueprint = async (blueprintId) => post(`/blueprints/${blueprintId}/activate/`);

export const courseNames = (blueprint) =>
  (blueprint?.themes || []).flatMap((theme) => theme.courses.map((course) => course.name));
