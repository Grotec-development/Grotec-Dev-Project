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
    app.enableCors({ origin: origins.length > 0 ? origins : true, credentials: true });
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
