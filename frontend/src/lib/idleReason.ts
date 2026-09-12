// Hands off "why was I signed out" across the redirect to /login, since the
// redirect itself (Shell's <Navigate>, or a hard window.location.assign in
// api.ts) can't carry state the way an in-memory value could. sessionStorage
// survives the navigation and is read-once so a later, unrelated login page
// visit never shows a stale message.
const KEY = 'grotec_logout_reason';

export function setLogoutReason(reason: 'idle'): void {
  try {
    sessionStorage.setItem(KEY, reason);
  } catch {
    // Private browsing / storage disabled — the notice is just skipped.
  }
}

// Pure read (no removal) so it's safe to call from a useState lazy
// initializer, which React (StrictMode, in development) invokes twice —
// consumeLogoutReason's old remove-on-read behavior made the second call
// see nothing, silently dropping the notice. Callers should pair this with
// clearLogoutReason() in a useEffect, which IS safe to run more than once.
export function peekLogoutReason(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearLogoutReason(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // no-op
  }
}
