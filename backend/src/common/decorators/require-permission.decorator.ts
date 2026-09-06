import { SetMetadata } from '@nestjs/common';
import type { PermissionCode } from '@grotec/shared';

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';
/**
 * Declares the permission(s) required to reach a handler. Enforced server-side by
 * PermissionGuard (UI-only authorization is never acceptable).
 */
export const RequirePermission = (...permissions: PermissionCode[]): MethodDecorator =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
