import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuditModule } from '../../common/audit/audit.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RateLimitService } from './rate-limit.service';

@Module({
  imports: [
    AuditModule,
    // Global so the shared AuthGuard can inject JwtService anywhere.
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: Number(config.get<string>('ACCESS_TOKEN_TTL_SECONDS') ?? 900) },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, RateLimitService],
})
export class AuthModule {}
