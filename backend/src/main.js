import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app-setup';
async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    await configureApp(app);
    const rawPort = app.get(ConfigService).get('PORT') ?? '3000';
    const parsed = Number.parseInt(rawPort, 10);
    // Shell environments sometimes export PORT=0; treat non-positive values as unset.
    const port = Number.isInteger(parsed) && parsed > 0 ? parsed : 3000;
    await app.listen(port, '0.0.0.0');
    // eslint-disable-next-line no-console
    console.log(`API listening on http://0.0.0.0:${port}/api/v1 — docs at http://localhost:${port}/api/docs`);
}
void bootstrap();
