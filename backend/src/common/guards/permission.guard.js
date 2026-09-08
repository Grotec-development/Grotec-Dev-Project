var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a;
import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiError } from '../errors/api-error';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
/**
 * Backend RBAC enforcement: rejects requests whose principal lacks every
 * permission declared on the handler via @RequirePermission.
 */
let PermissionGuard = class PermissionGuard {
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(context) {
        const required = this.reflector.getAllAndOverride(REQUIRED_PERMISSIONS_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!required || required.length === 0)
            return true;
        const request = context.switchToHttp().getRequest();
        const principal = request.employee;
        if (!principal)
            throw ApiError.unauthorized();
        const granted = new Set(principal.permissions);
        const missing = required.filter((permission) => !granted.has(permission));
        if (missing.length > 0) {
            throw ApiError.forbidden('FORBIDDEN', `Missing permission: ${missing.join(', ')}`);
        }
        return true;
    }
};
PermissionGuard = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof Reflector !== "undefined" && Reflector) === "function" ? _a : Object])
], PermissionGuard);
export { PermissionGuard };
