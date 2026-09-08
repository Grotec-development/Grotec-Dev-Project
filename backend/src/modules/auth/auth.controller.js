var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var _a, _b, _c, _d;
import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ApiError } from '../../common/errors/api-error';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { REFRESH_COOKIE, refreshCookieOptions } from './session.util';
let AuthController = class AuthController {
    constructor(auth, config) {
        this.auth = auth;
        this.config = config;
    }
    async login(dto, req, res) {
        const result = await this.auth.login(dto.email, dto.password, req.ip, req.headers['user-agent']);
        this.setRefreshCookie(res, result.newRefreshToken);
        return publicLogin(result);
    }
    async refresh(req, res) {
        const token = req.cookies?.[REFRESH_COOKIE];
        if (!token)
            throw ApiError.unauthorized('NO_REFRESH_COOKIE', 'No session cookie');
        const result = await this.auth.rotateSession(token, req.ip, req.headers['user-agent']);
        this.setRefreshCookie(res, result.newRefreshToken);
        return publicLogin(result);
    }
    async logout(req, res) {
        const token = req.cookies?.[REFRESH_COOKIE];
        await this.auth.logout(token);
        res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
    }
    async me(employee) {
        return this.auth.me(employee);
    }
    async changePassword(employee, dto) {
        await this.auth.changePassword(employee, dto.currentPassword, dto.newPassword);
    }
    setRefreshCookie(res, token) {
        const days = Number(this.config.get('REFRESH_TOKEN_TTL_DAYS') ?? 30);
        const secure = this.config.get('COOKIE_SECURE') === 'true';
        const sameSite = this.config.get('COOKIE_SAME_SITE') ?? 'lax';
        res.cookie(REFRESH_COOKIE, token, refreshCookieOptions(days, secure, sameSite));
    }
};
__decorate([
    Public(),
    HttpCode(200),
    Post('login'),
    __param(0, Body()),
    __param(1, Req()),
    __param(2, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_c = typeof LoginDto !== "undefined" && LoginDto) === "function" ? _c : Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    Public(),
    HttpCode(200),
    Post('refresh'),
    __param(0, Req()),
    __param(1, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refresh", null);
__decorate([
    Public(),
    HttpCode(204),
    Post('logout'),
    __param(0, Req()),
    __param(1, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    Get('me'),
    __param(0, CurrentEmployee()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "me", null);
__decorate([
    HttpCode(204),
    Post('change-password'),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, typeof (_d = typeof ChangePasswordDto !== "undefined" && ChangePasswordDto) === "function" ? _d : Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "changePassword", null);
AuthController = __decorate([
    Controller('auth'),
    __metadata("design:paramtypes", [typeof (_a = typeof AuthService !== "undefined" && AuthService) === "function" ? _a : Object, typeof (_b = typeof ConfigService !== "undefined" && ConfigService) === "function" ? _b : Object])
], AuthController);
export { AuthController };
function publicLogin(result) {
    const { newRefreshToken: _ignored, ...rest } = result;
    return rest;
}
