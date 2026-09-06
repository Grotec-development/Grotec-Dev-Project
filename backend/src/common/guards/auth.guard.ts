import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import type { PermissionCode, RoleCode } from '@grotec/shared';
import type { AuthedRequest } from '../auth/auth-context';
import { ApiError } from '../errors/api-error';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

export interface AccessTokenClaims {
  sub: string;
  email: string;
  fullName: string;
  role: RoleCode;
  permissions: PermissionCode[];
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw ApiError.unauthorized();
    }
    const token = header.slice('Bearer '.length);

    try {
      const claims = await this.jwtService.verifyAsync<AccessTokenClaims>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
      request.employee = {
        id: claims.sub,
        email: claims.email,
        fullName: claims.fullName,
        roleCode: claims.role,
        permissions: claims.permissions as PermissionCode[],
      };
      return true;
    } catch {
      throw ApiError.unauthorized('INVALID_TOKEN', 'Invalid or expired token');
    }
  }
}
