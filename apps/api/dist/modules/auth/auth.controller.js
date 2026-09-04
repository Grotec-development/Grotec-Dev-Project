"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const current_employee_decorator_1 = require("../../common/decorators/current-employee.decorator");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const api_error_1 = require("../../common/errors/api-error");
const auth_service_1 = require("./auth.service");
const change_password_dto_1 = require("./dto/change-password.dto");
const login_dto_1 = require("./dto/login.dto");
const session_util_1 = require("./session.util");
let AuthController = class AuthController {
    auth;
    config;
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
        const token = req.cookies?.[session_util_1.REFRESH_COOKIE];
        if (!token)
            throw api_error_1.ApiError.unauthorized('NO_REFRESH_COOKIE', 'No session cookie');
        const result = await this.auth.rotateSession(token, req.ip, req.headers['user-agent']);
        this.setRefreshCookie(res, result.newRefreshToken);
        return publicLogin(result);
    }
    async logout(req, res) {
        const token = req.cookies?.[session_util_1.REFRESH_COOKIE];
        await this.auth.logout(token);
        res.clearCookie(session_util_1.REFRESH_COOKIE, { path: '/api/v1/auth' });
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
        res.cookie(session_util_1.REFRESH_COOKIE, token, (0, session_util_1.refreshCookieOptions)(days, secure, sameSite));
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('login'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.LoginDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('refresh'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refresh", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.HttpCode)(204),
    (0, common_1.Post)('logout'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "me", null);
__decorate([
    (0, common_1.HttpCode)(204),
    (0, common_1.Post)('change-password'),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, change_password_dto_1.ChangePasswordDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "changePassword", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        config_1.ConfigService])
], AuthController);
function publicLogin(result) {
    const { newRefreshToken: _ignored, ...rest } = result;
    return rest;
}
//# sourceMappingURL=auth.controller.js.map