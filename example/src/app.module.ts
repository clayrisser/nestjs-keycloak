import ConnectRedis from 'connect-redis';
import session from 'express-session';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard, KeycloakModule, ResourceGuard } from 'nestjs-keycloak';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { NestSessionOptions, SessionModule } from 'nestjs-session';
import { PassportModule } from '@nestjs/passport';
import { RedisService, RedisModule, RedisModuleOptions } from 'nestjs-redis';
import modules from './modules';

const RedisStore = ConnectRedis(session);

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    KeycloakModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        authServerUrl: `${config.get('KEYCLOAK_BASE_URL')}/auth`,
        clientId: config.get('KEYCLOAK_CLIENT_ID') || '',
        debug: config.get('DEBUG') === '1',
        realm: config.get('KEYCLOAK_REALM') || '',
        secret: config.get('KEYCLOAK_SECRET') || ''
      })
    }),
    RedisModule.forRootAsync({
      useFactory: (config: ConfigService): RedisModuleOptions => ({
        db: Number(config.get('REDIS_DATABASE') || 0),
        host: config.get('REDIS_HOST') || 'localhost',
        password: config.get('REDIS_PASSWORD') || '',
        port: Number(config.get('REDIS_PORT') || 6379)
      }),
      inject: [ConfigService]
    }),
    SessionModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService, RedisService],
      useFactory: async (
        config: ConfigService,
        redis: RedisService
      ): Promise<NestSessionOptions> => {
        const redisClient = redis.getClient();
        const store = new RedisStore({ client: redisClient as any });
        return {
          session: {
            resave: false,
            saveUninitialized: false,
            secret: config.get('SECRET') || '',
            store
          }
        };
      }
    }),
    PassportModule.register({ session: true }),
    ...modules
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard
    },
    {
      provide: APP_GUARD,
      useClass: ResourceGuard
    }
  ]
})
export class AppModule {}
