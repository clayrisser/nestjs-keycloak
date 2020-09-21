import dotenv from 'dotenv';
import fs from 'fs';
import getPort from 'get-port';
import path from 'path';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import {
  ExpressAdapter,
  NestExpressApplication
} from '@nestjs/platform-express';
import {
  FastifyAdapter,
  NestFastifyApplication
} from '@nestjs/platform-fastify';
import pkg from '../package.json';
import { Adapter } from './types';
import { AppModule } from './app.module';

const logger = console;
const rootPath = fs.existsSync(path.resolve(__dirname, '../.env'))
  ? path.resolve(__dirname, '..')
  : path.resolve(__dirname, '../../../..');
dotenv.config();
process.env = {
  ...process.env,
  ...dotenv.parse(fs.readFileSync(path.resolve(rootPath, 'prisma/.env')))
};
const { env } = process;

const adapter =
  env.NESTJS_ADAPTER?.toLowerCase() === 'fastify'
    ? Adapter.Fastify
    : Adapter.Express;

(async () => {
  const app = await NestFactory.create<
    NestExpressApplication | NestFastifyApplication
  >(
    AppModule,
    adapter === Adapter.Fastify ? new FastifyAdapter() : new ExpressAdapter(),
    { bodyParser: true }
  );
  if (adapter === Adapter.Fastify) {
    const fastifyApp = app as NestFastifyApplication;
    fastifyApp.useStaticAssets({
      root: path.join(__dirname, '..', 'public'),
      prefix: '/public/'
    });
    fastifyApp.setViewEngine({
      engine: {
        handlebars: require('ejs')
      },
      templates: path.join(__dirname, '..', 'views')
    });
  } else {
    const expressApp = app as NestExpressApplication;
    expressApp.useStaticAssets(path.resolve(rootPath, 'public'));
    expressApp.setBaseViewsDir(path.resolve(rootPath, 'views'));
    expressApp.setViewEngine('ejs');
  }
  app.useGlobalPipes(new ValidationPipe());
  if (env.SWAGGER === '1') {
    const options = new DocumentBuilder()
      .setTitle(pkg.name)
      .setDescription(pkg.description)
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, options);
    SwaggerModule.setup('api', app, document);
  }
  if (env.CORS === '1') app.enableCors();
  const port = await getPort({ port: Number(env.PORT || 3000) });
  if (adapter === Adapter.Fastify) {
    const fastifyApp = app as NestFastifyApplication;
    await fastifyApp.listen(port, '0.0.0.0').catch(logger.error);
  } else {
    const expressApp = app as NestExpressApplication;
    await expressApp.listen(port, '0.0.0.0').catch(logger.error);
  }
  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }
})();

declare const module: any;
