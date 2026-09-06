import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthedRequest, AuthEmployee } from '../auth/auth-context';

/** Injects the authenticated principal (from AuthGuard) into a handler. */
export const CurrentEmployee = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthEmployee | undefined => {
    const request = ctx.switchToHttp().getRequest<AuthedRequest>();
    return request.employee;
  },
);
