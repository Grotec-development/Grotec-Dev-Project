import axios from 'axios';

/**
 * BUG-017: Cause-based API error reporting.
 * Maps status codes, network states, and validation bodies to clear, actionable messages.
 */
export function describeApiError(err: unknown, fallback = 'An unexpected error occurred. Please try again.'): string {
  if (!err) return fallback;

  if (axios.isAxiosError(err)) {
    // Network offline / unreachable
    if (!err.response) {
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        return 'Request timed out. Please check your connection and try again.';
      }
      return 'Network connection lost. Please verify your internet connection and try again.';
    }

    const { status, data } = err.response;

    // Check backend JSON error format: { error: { message, code } } or { message }
    const serverMessage =
      (typeof data === 'object' && data !== null && (data.error?.message || data.message)) ||
      null;

    if (status === 401) {
      return 'Your session has expired. Please sign in again.';
    }

    if (status === 403) {
      return 'You do not have permission to perform this action.';
    }

    if (status === 404) {
      return serverMessage || 'The requested resource was not found.';
    }

    if (status === 409) {
      return serverMessage || 'An employee or record with this information already exists.';
    }

    if (status === 400) {
      if (Array.isArray(data?.message)) {
        return data.message.join('. ');
      }
      return serverMessage || 'Please check your inputs and try again.';
    }

    if (status >= 500) {
      return 'A server error occurred. Our team has been notified. Please retry shortly.';
    }

    if (serverMessage) {
      return String(serverMessage);
    }
  }

  if (err instanceof Error) {
    return err.message;
  }

  return fallback;
}
