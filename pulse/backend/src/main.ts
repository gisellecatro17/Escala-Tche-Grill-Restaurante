import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(helmet());

  const corsOrigins = (
    config.get<string>('CORS_ORIGINS') ?? 'http://localhost:3000'
  )
    .split(',')
    .map((origin) => origin.trim());

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Pulse API')
    .setDescription(
      'API do Pulse — BPO financeiro, contas a pagar/receber, conciliação bancária e inteligência financeira.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addSecurityRequirements('bearer')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = config.get<number>('PORT') ?? 3333;

  // `0.0.0.0` explícito, não o padrão. Em container, escutar só em `localhost` faz o
  // processo subir sem erro nenhum e recusar toda conexão vinda de fora — o deploy fica
  // "verde" e o serviço, inalcançável.
  await app.listen(port, '0.0.0.0');

  Logger.log(`Pulse API escutando na porta ${port}`, 'Bootstrap');
  Logger.log(`Origens liberadas: ${corsOrigins.join(', ')}`, 'Bootstrap');
}

void bootstrap();
