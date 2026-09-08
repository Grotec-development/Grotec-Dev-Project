var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuditModule } from '../../common/audit/audit.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RateLimitService } from './rate-limit.service';
let AuthModule = class AuthModule {
};
AuthModule = __decorate([
    Module({
        imports: [
            AuditModule,
            // Global so the shared AuthGuard can inject JwtService anywhere.
            JwtModule.registerAsync({
                global: true,
                imports: [ConfigModule],
                inject: [ConfigService],
                useFactory: (config) => ({
                    secret: config.get('JWT_ACCESS_SECRET'),
                    signOptions: { expiresIn: Number(config.get('ACCESS_TOKEN_TTL_SECONDS') ?? 900) },
                }),
            }),
        ],
        controllers: [AuthController],
        providers: [AuthService, RateLimitService],
    })
], AuthModule);
export { AuthModule };
