import type { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

/**
 * Route guard: renders the page only when the user holds at least one of
 * `anyOf`; otherwise sends them to the Restricted page. The API enforces the
 * same permissions — this keeps the UI from rendering an empty shell.
 */
export function RequirePermission({ anyOf, children }: { anyOf: string[]; children: ReactElement }) {
  const { hasPermission } = useAuth();
  return anyOf.some(hasPermission) ? children : <Navigate to="/restricted" replace />;
}
