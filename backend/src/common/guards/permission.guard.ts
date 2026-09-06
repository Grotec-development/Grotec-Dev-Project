import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthedRequest } from '../auth/auth-context';
import { ApiError } from '../errors/api-error';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permission.decorator';

/**
 * Backend RBAC enforcement: rejects requests whose principal lacks every
 * permission declared on the handler via @RequirePermission.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const principal = request.employee;
    if (!principal) throw ApiError.unauthorized();

    const granted = new Set<string>(principal.permissions);
    const missing = required.filter((permission) => !granted.has(permission));
    if (missing.length > 0) {
      throw ApiError.forbidden('FORBIDDEN', `Missing permission: ${missing.join(', ')}`);
    }
    return true;
  }
}
