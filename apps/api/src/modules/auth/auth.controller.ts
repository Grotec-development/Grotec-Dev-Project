import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ApiError } from '../../common/errors/api-error';
import type { AuthEmployee, AuthedRequest } from '../../common/auth/auth-context';
import { AuthService, type LoginResult } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { REFRESH_COOKIE, refreshCookieOptions } from './session.util';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @HttpCode(200)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto.email, dto.password, req.ip, req.headers['user-agent']);
    this.setRefreshCookie(res, result.newRefreshToken);
    return publicLogin(result);
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  async refresh(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!token) throw ApiError.unauthorized('NO_REFRESH_COOKIE', 'No session cookie');
    const result = await this.auth.rotateSession(token, req.ip, req.headers['user-agent']);
    this.setRefreshCookie(res, result.newRefreshToken);
    return publicLogin(result);
  }

  @Public()
  @HttpCode(204)
  @Post('logout')
  async logout(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    await this.auth.logout(token);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
  }

  @Get('me')
  async me(@CurrentEmployee() employee: AuthEmployee) {
    return this.auth.me(employee);
  }

  @HttpCode(204)
  @Post('change-password')
  async changePassword(@CurrentEmployee() employee: AuthEmployee, @Body() dto: ChangePasswordDto) {
    await this.auth.changePassword(employee, dto.currentPassword, dto.newPassword);
  }

  private setRefreshCookie(res: Response, token: string): void {
    const days = Number(this.config.get<string>('REFRESH_TOKEN_TTL_DAYS') ?? 30);
    const secure = this.config.get<string>('COOKIE_SECURE') === 'true';
    const sameSite = this.config.get<string>('COOKIE_SAME_SITE') ?? 'lax';
    res.cookie(REFRESH_COOKIE, token, refreshCookieOptions(days, secure, sameSite));
  }
}

type PublicLogin = Omit<LoginResult, 'newRefreshToken'>;
function publicLogin(result: LoginResult): PublicLogin {
  const { newRefreshToken: _ignored, ...rest } = result;
  return rest;
}
