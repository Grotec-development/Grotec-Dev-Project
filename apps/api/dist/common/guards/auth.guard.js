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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthGuard = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const core_1 = require("@nestjs/core");
const api_error_1 = require("../errors/api-error");
const public_decorator_1 = require("../decorators/public.decorator");
let AuthGuard = class AuthGuard {
    jwtService;
    config;
    reflector;
    constructor(jwtService, config, reflector) {
        this.jwtService = jwtService;
        this.config = config;
        this.reflector = reflector;
    }
    async canActivate(context) {
        const isPublic = this.reflector.getAllAndOverride(public_decorator_1.IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic)
            return true;
        const request = context.switchToHttp().getRequest();
        const header = request.headers.authorization;
        if (!header?.startsWith('Bearer ')) {
            throw api_error_1.ApiError.unauthorized();
        }
        const token = header.slice('Bearer '.length);
        try {
            const claims = await this.jwtService.verifyAsync(token, {
                secret: this.config.get('JWT_ACCESS_SECRET'),
            });
            request.employee = {
                id: claims.sub,
                email: claims.email,
                fullName: claims.fullName,
                roleCode: claims.role,
                permissions: claims.permissions,
            };
            return true;
        }
        catch {
            throw api_error_1.ApiError.unauthorized('INVALID_TOKEN', 'Invalid or expired token');
        }
    }
};
exports.AuthGuard = AuthGuard;
exports.AuthGuard = AuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        config_1.ConfigService,
        core_1.Reflector])
], AuthGuard);
//# sourceMappingURL=auth.guard.js.map