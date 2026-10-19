import express from 'express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
/** Shared HTTP configuration used by main.ts and the integration tests. */
export async function configureApp(app, options = {}) {
    const config = app.get(ConfigService);
    app.setGlobalPrefix('api/v1');
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true }));
    app.use(cookieParser());
    app.use((req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        next();
    });
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    const origins = (config.get('CORS_ORIGINS') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    const ALLOWED_ORIGIN_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$|^capacitor:\/\/localhost$/;

    const isOriginAllowed = (requestOrigin) => {
        if (!requestOrigin) return true;
        if (origins.length > 0) {
            for (const allowed of origins) {
                if (allowed === '*' || allowed === requestOrigin || requestOrigin.startsWith(allowed + '/')) return true;
                if (allowed.includes('*')) {
                    const escaped = allowed.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
                    if (new RegExp(`^${escaped}$`).test(requestOrigin)) return true;
                }
            }
            return false;
        }
        if (ALLOWED_ORIGIN_REGEX.test(requestOrigin)) return true;
        try {
            const url = new URL(requestOrigin);
            if (url.hostname.endsWith('.vercel.app') || url.hostname.endsWith('.onrender.com')) {
                return true;
            }
        } catch {
            // ignore URL parsing error
        }
        return false;
    };

    app.enableCors({
        origin: (requestOrigin, callback) => {
            if (isOriginAllowed(requestOrigin)) {
                return callback(null, true);
            }
            return callback(null, false);
        },
        credentials: true,
        optionsSuccessStatus: 204,
        methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-Requested-With',
            'Accept',
            'Origin',
            'Cookie',
            'x-event-id',
            'x-webhook-id',
            'x-delivery-id',
            'x-dialer-secret',
            'x-essl-secret',
            'x-tenant-id',
            'x-tenant-slug',
        ],
        exposedHeaders: ['Set-Cookie'],
        maxAge: 86400,
    });
    if (options.swagger !== false) {
        const swaggerConfig = new DocumentBuilder()
            .setTitle('GROTEC FarmerOS CRM API')
            .setDescription('CRM foundation API — Month 1. RBAC enforced at this layer.')
            .setVersion('0.1.0')
            .addBearerAuth()
            .build();
        const document = SwaggerModule.createDocument(app, swaggerConfig);
        SwaggerModule.setup('api/docs', app, document);
    }
}
