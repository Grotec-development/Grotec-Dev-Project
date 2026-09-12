var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a, _b, _c, _d;
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { ApiError } from '../errors/api-error';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
// How often, per session, lastUsedAt is allowed to be written. Idle-timeout
// only needs minute-level precision (SESSION_IDLE_TIMEOUT_SECONDS defaults to
// 900s), so writing on literally every request would be pure overhead — this
// keeps the write volume bounded regardless of how chatty a session is.
const TOUCH_THROTTLE_MS = 60 * 1000;
let AuthGuard = class AuthGuard {
    constructor(jwtService, config, reflector, prisma) {
        this.jwtService = jwtService;
        this.config = config;
        this.reflector = reflector;
        this.prisma = prisma;
        this.lastTouch = new Map();
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
            if (claims.sid)
                this.touchSession(claims.sid);
            return true;
        }
        catch {
            throw ApiError.unauthorized('INVALID_TOKEN', 'Invalid or expired token');
        }
    }
    // Fire-and-forget, throttled per session so idle-timeout tracking adds no
    // latency to the request it rides on and no meaningful write volume.
    touchSession(sessionId) {
        const now = Date.now();
        const last = this.lastTouch.get(sessionId) ?? 0;
        if (now - last < TOUCH_THROTTLE_MS)
            return;
        this.lastTouch.set(sessionId, now);
        this.prisma.authSession
            .update({ where: { id: sessionId }, data: { lastUsedAt: new Date() } })
            .catch(() => {
            // Session row may have been revoked/deleted concurrently — the next
            // refresh attempt will fail on its own terms either way.
        });
    }
};
AuthGuard = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof JwtService !== "undefined" && JwtService) === "function" ? _a : Object, typeof (_b = typeof ConfigService !== "undefined" && ConfigService) === "function" ? _b : Object, typeof (_c = typeof Reflector !== "undefined" && Reflector) === "function" ? _c : Object, typeof (_d = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _d : Object])
], AuthGuard);
export { AuthGuard };
