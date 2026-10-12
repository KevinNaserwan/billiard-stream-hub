import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WsAdapter } from '@nestjs/platform-ws';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.enableCors({ origin: '*' });
  app.useWebSocketAdapter(new WsAdapter(app));

  const PORT = process.env.PORT || 3001;
  await app.listen(PORT);
  logger.log(`⚡ [BilliardStream Nest Core] Microservice running on http://localhost:${PORT}`);
}

bootstrap();
