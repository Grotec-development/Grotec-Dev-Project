"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureApp = configureApp;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const swagger_1 = require("@nestjs/swagger");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const http_exception_filter_1 = require("./common/filters/http-exception.filter");
async function configureApp(app, options = {}) {
    const config = app.get(config_1.ConfigService);
    app.setGlobalPrefix('api/v1');
    app.use((0, cookie_parser_1.default)());
    app.useGlobalFilters(new http_exception_filter_1.HttpExceptionFilter());
    app.useGlobalPipes(new common_1.ValidationPipe({
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
        const swaggerConfig = new swagger_1.DocumentBuilder()
            .setTitle('GROTEC FarmerOS CRM API')
            .setDescription('CRM foundation API — Month 1. RBAC enforced at this layer.')
            .setVersion('0.1.0')
            .addBearerAuth()
            .build();
        const document = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
        swagger_1.SwaggerModule.setup('api/docs', app, document);
    }
}
//# sourceMappingURL=app-setup.js.map