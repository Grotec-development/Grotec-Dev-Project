import { SetMetadata } from '@nestjs/common';
export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';
/**
 * Declares the permission(s) required to reach a handler. Enforced server-side by
 * PermissionGuard (UI-only authorization is never acceptable).
 */
export const RequirePermission = (...permissions) => SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
