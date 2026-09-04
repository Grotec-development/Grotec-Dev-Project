"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const app_setup_1 = require("./app-setup");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    await (0, app_setup_1.configureApp)(app);
    const rawPort = app.get(config_1.ConfigService).get('PORT') ?? '3000';
    const parsed = Number.parseInt(rawPort, 10);
    const port = Number.isInteger(parsed) && parsed > 0 ? parsed : 3000;
    await app.listen(port);
    console.log(`API listening on http://localhost:${port}/api/v1 — docs at http://localhost:${port}/api/docs`);
}
void bootstrap();
//# sourceMappingURL=main.js.map