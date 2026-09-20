import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
/** Shared HTTP configuration used by main.ts and the integration tests. */
export async function configureApp(app, options = {}) {
    const config = app.get(ConfigService);
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
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
    const ALLOWED_ORIGIN_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$|^capacitor:\/\/localhost$/;
    app.enableCors({
        origin: (requestOrigin, callback) => {
            if (!requestOrigin) return callback(null, true);
            if (
                ALLOWED_ORIGIN_REGEX.test(requestOrigin) ||
                origins.includes(requestOrigin) ||
                origins.some((o) => requestOrigin.startsWith(o))
            ) {
                return callback(null, true);
            }
            return callback(null, false);
        },
        credentials: true,
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
