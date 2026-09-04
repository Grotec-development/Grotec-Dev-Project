import type { PermissionCode, RoleCode } from '@grotec/shared';
import type { Request } from 'express';

/** Authenticated principal attached to the request by AuthGuard. */
export interface AuthEmployee {
  id: string;
  email: string;
  fullName: string;
  roleCode: RoleCode;
  permissions: PermissionCode[];
}

/** Augmented Express request carrying the authenticated principal. */
export interface AuthedRequest extends Request {
  employee?: AuthEmployee;
}
