import 'reflect-metadata';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { assertEnv, clientOrigins, isProd } from './config/env';

async function bootstrap() {
  assertEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });
  const logger = new Logger('Bootstrap');
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());
  app.useBodyParser('json', { limit: '200kb' });
  app.useBodyParser('urlencoded', { limit: '50kb', extended: true });
  app.enableCors({
    origin: clientOrigins(), credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Requested-With', 'X-Request-Id'], maxAge: 600,
  });
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: false },
    exceptionFactory: undefined }));
  app.enableShutdownHooks();

  if (!isProd() || process.env.SWAGGER_ENABLED === 'true') {
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('DEE-LIGHT API').setVersion('1.0').addCookieAuth('access_token').build());
    SwaggerModule.setup('api/docs', app, doc);
  }
  const port = Number(process.env.PORT ?? 4000);
  const server = await app.listen(port, '0.0.0.0');
  server.setTimeout(30_000);
  logger.log(`API listening on :${port} (prefix /api/v1)`);
}
bootstrap().catch((e) => { console.error(e); process.exit(1); });
