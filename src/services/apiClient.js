/**
 * API Client for Django REST API
 * Replaces Firebase SDK calls with HTTP requests
 * Always uses production Supabase backend
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://exit-exam-backend-qii8.onrender.com/api';

const TOKEN_STORAGE_KEY = 'authToken';

// Render's free tier sleeps when idle; waking can take ~30-60s.
const SLOW_REQUEST_MS = 4000;
const WAKE_STATUS_CODES = [502, 503, 504];
const GET_RETRY_DELAYS_MS = [3000, 8000];

export const UNAUTHORIZED_EVENT = 'auth:unauthorized';
export const SERVER_STATUS_EVENT = 'api:server-status';

export const getAuthToken = () => localStorage.getItem(TOKEN_STORAGE_KEY);

export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
};

let slowRequestCount = 0;
let serverUnreachable = false;

const emitServerStatus = () => {
  window.dispatchEvent(new CustomEvent(SERVER_STATUS_EVENT, {
    detail: { waking: slowRequestCount > 0, unreachable: serverUnreachable },
  }));
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const serverUnavailableError = (cause) => {
  const error = new Error(
    'The server is waking up or unreachable. Free hosting sleeps when idle, so the first request can take up to a minute. Please retry shortly.'
  );
  error.isServerUnavailable = true;
  error.cause = cause;
  return error;
};

/**
 * Single fetch with slow-request tracking (drives the "waking up" banner).
 */
async function trackedFetch(url, config) {
  let isSlow = false;
  const slowTimer = setTimeout(() => {
    isSlow = true;
    slowRequestCount += 1;
    emitServerStatus();
  }, SLOW_REQUEST_MS);

  try {
    return await fetch(url, config);
  } finally {
    clearTimeout(slowTimer);
    if (isSlow) {
      slowRequestCount -= 1;
      emitServerStatus();
    }
  }
}

/**
 * Make API request with error handling
 */
async function apiRequest(endpoint, { responseType = 'json', ...options } = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getAuthToken();
  const isFormData = options.body instanceof FormData;
  const config = {
    ...options,
    headers: {
      // Let the browser set the multipart boundary for FormData bodies.
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Token ${token}` } : {}),
      ...options.headers,
    },
  };
  // Only idempotent reads are retried automatically while the server wakes.
  const retryDelays = (config.method || 'GET') === 'GET' ? GET_RETRY_DELAYS_MS : [];

  try {
    let response;
    for (let attempt = 0; ; attempt++) {
      try {
        response = await trackedFetch(url, config);
      } catch (networkError) {
        if (attempt < retryDelays.length) {
          await sleep(retryDelays[attempt]);
          continue;
        }
        serverUnreachable = true;
        emitServerStatus();
        throw serverUnavailableError(networkError);
      }
      if (WAKE_STATUS_CODES.includes(response.status) && attempt < retryDelays.length) {
        await sleep(retryDelays[attempt]);
        continue;
      }
      break;
    }

    if (serverUnreachable) {
      serverUnreachable = false;
      emitServerStatus();
    }

    if (WAKE_STATUS_CODES.includes(response.status)) {
      const error = serverUnavailableError();
      error.status = response.status;
      throw error;
    }

    if (response.status === 401 && token) {
      setAuthToken(null);
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
      }
      const errorMessage = errorData.error || errorData.detail || errorData.message || `HTTP ${response.status}: ${response.statusText}`;
      const error = new Error(errorMessage);
      error.status = response.status;
      error.data = errorData;
      throw error;
    }
    
    if (responseType === 'blob') {
      return await response.blob();
    }

    // Handle empty responses
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    }
    return null;
  } catch (error) {
    console.error(`API request failed: ${endpoint}`, error);
    throw error;
  }
}

/**
 * GET request
 */
export async function get(endpoint, params = {}) {
  const queryString = new URLSearchParams(params).toString();
  const url = queryString ? `${endpoint}?${queryString}` : endpoint;
  return apiRequest(url, { method: 'GET' });
}

const LIST_PAGE_SIZE = 1000;
const MAX_LIST_PAGES = 200;

/**
 * GET every row of a paginated list endpoint (DRF page-number pagination), following pages
 * until `next` is empty. Unpaginated (plain array) responses are returned as-is.
 */
export async function getAll(endpoint, params = {}) {
  const rows = [];
  for (let page = 1; page <= MAX_LIST_PAGES; page++) {
    const response = await get(endpoint, { ...params, page, page_size: LIST_PAGE_SIZE });
    if (Array.isArray(response)) return response;
    if (!response || !Array.isArray(response.results)) return rows;
    rows.push(...response.results);
    if (!response.next) return rows;
  }
  throw new Error(`Too many results from ${endpoint}; stopped after ${MAX_LIST_PAGES * LIST_PAGE_SIZE} rows.`);
}

/**
 * POST request
 */
export async function post(endpoint, data = {}) {
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * POST multipart/form-data (file uploads)
 */
export async function upload(endpoint, formData) {
  return apiRequest(endpoint, {
    method: 'POST',
    body: formData,
  });
}

/**
 * GET a file as a Blob (sends the auth token, unlike a plain link)
 */
export async function getBlob(endpoint) {
  return apiRequest(endpoint, { method: 'GET', responseType: 'blob' });
}

/**
 * PATCH request
 */
export async function patch(endpoint, data = {}) {
  return apiRequest(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/**
 * PUT request
 */
export async function put(endpoint, data = {}) {
  return apiRequest(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * DELETE request
 */
export async function del(endpoint) {
  return apiRequest(endpoint, { method: 'DELETE' });
}

export default {
  get,
  getAll,
  post,
  upload,
  getBlob,
  patch,
  put,
  delete: del,
};
