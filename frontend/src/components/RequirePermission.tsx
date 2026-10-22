import type { ReactElement } from 'react';
import { Navigate, useParams } from 'react-router-dom';
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

/**
 * Route guard for employee profiles:
 * Allows employees to access their own personal profile and performance scorecard
 * regardless of administrative HRMS read permissions.
 */
export function RequireEmployeeProfileAccess({ children }: { children: ReactElement }) {
  const { user, hasPermission } = useAuth();
  const { id } = useParams<{ id: string }>();
  const isSelf = !!(user?.id && id === user.id);
  const canReadEmployees = ['employee.read', 'hrms.employee.read'].some(hasPermission);

  if (isSelf || canReadEmployees) {
    return children;
  }
  return <Navigate to="/restricted" replace />;
}

export function MyProfileRedirect() {
  const { user } = useAuth();
  if (!user?.id) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={`/hrms/employees/${user.id}`} replace />;
}
