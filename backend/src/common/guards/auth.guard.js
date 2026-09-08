var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a, _b, _c;
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { ApiError } from '../errors/api-error';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
let AuthGuard = class AuthGuard {
    constructor(jwtService, config, reflector) {
        this.jwtService = jwtService;
        this.config = config;
        this.reflector = reflector;
    }
    async canActivate(context) {
        const isPublic = this.reflector.getAllAndOverride(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic)
            return true;
        const request = context.switchToHttp().getRequest();
        const header = request.headers.authorization;
        if (!header?.startsWith('Bearer ')) {
            throw ApiError.unauthorized();
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
            throw ApiError.unauthorized('INVALID_TOKEN', 'Invalid or expired token');
        }
    }
};
AuthGuard = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof JwtService !== "undefined" && JwtService) === "function" ? _a : Object, typeof (_b = typeof ConfigService !== "undefined" && ConfigService) === "function" ? _b : Object, typeof (_c = typeof Reflector !== "undefined" && Reflector) === "function" ? _c : Object])
], AuthGuard);
export { AuthGuard };
