/**
 * File: /src/decorators/authorizationCallback.decorator.ts
 * Project: nestjs-keycloak
 * File Created: 14-07-2021 11:43:57
 * Author: Clay Risser <email@clayrisser.com>
 * -----
 * Last Modified: 12-04-2023 18:22:26
 * Modified By: Clay Risser
 * -----
 * Risser Labs LLC (c) Copyright 2021
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import KeycloakService from '../keycloak.service';
import type { KeycloakRequest } from '../types';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { Grant } from 'keycloak-connect';
import type { Observable } from 'rxjs';
import type { Request, Response } from 'express';
import { BadRequestException, ForbiddenException, Inject, Logger } from '@nestjs/common';
import { Injectable, SetMetadata, UseInterceptors, applyDecorators, createParamDecorator } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { consumeAuthState } from '../authState';
import { getBaseUrl, isSafeRedirect } from '../security';
import { joinRoutePath } from '../util';

export const AUTHORIZATION_CALLBACK = 'KEYCLOAK_AUTHORIZATION_CALLBACK';

const logger = new Logger('AuthorizationCallback');

function getQuery(req: KeycloakRequest<Request> | Request): URLSearchParams {
  return new URLSearchParams(req?.originalUrl?.split('?')?.[1] || '');
}

export const AuthorizationCallback = (authorizationCallback?: AuthorizationCallback) => {
  return applyDecorators(
    UseInterceptors(AuthorizationCallbackInterceptor),
    SetMetadata(AUTHORIZATION_CALLBACK, authorizationCallback || {}),
  );
};

export const AuthorizationCode = createParamDecorator((_data: unknown, context: ExecutionContext): string | null => {
  return getQuery(context.switchToHttp().getRequest()).get('code');
});

export const AuthorizationState = createParamDecorator((_data: unknown, context: ExecutionContext): string | null => {
  return getQuery(context.switchToHttp().getRequest()).get('state');
});

export const HandleAuthorizationCallback = createParamDecorator(
  (_data: unknown, context: ExecutionContext): HandleAuthorizationCallbackFunction => {
    return async (code?: string, state?: string) => {
      const req: KeycloakRequest<Request> = context.switchToHttp().getRequest();
      if (!req) return;
      const res: Response | undefined = context.switchToHttp().getResponse();
      const keycloakService = req.keycloakService;
      const reflector = req.reflector;
      delete req.reflector;
      delete req.keycloakService;
      if (!keycloakService || !reflector) {
        throw new Error(
          '@AuthorizationCallback({ manual: true }) decorator is required to use @HandleAuthorizationCallback() decorator',
        );
      }
      const authorizationCallback = getAuthorizationCallback(context, reflector, keycloakService.appBaseUrl);
      return handleAuthorizationCallback(req, res, keycloakService, authorizationCallback, code, state);
    };
  },
);

@Injectable()
export class AuthorizationCallbackInterceptor implements NestInterceptor {
  constructor(
    @Inject(KeycloakService) private readonly keycloakService: KeycloakService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req: KeycloakRequest<Request> = context.switchToHttp().getRequest();
    const res: Response = context.switchToHttp().getResponse();
    if (!req) return next.handle();
    if (!req.keycloakService) req.keycloakService = this.keycloakService;
    if (!req.reflector) req.reflector = this.reflector;
    const authorizationCallback = getAuthorizationCallback(context, this.reflector, this.keycloakService.appBaseUrl);
    if (!authorizationCallback?.manual) {
      const result = await handleAuthorizationCallback(req, res, this.keycloakService, authorizationCallback);
      if (result) {
        const { redirectUri, destinationUri } = result;
        res.cookie('redirect_from', redirectUri.split('?')[0], {
          httpOnly: true,
          sameSite: 'lax',
          secure: redirectUri.startsWith('https:'),
          path: '/',
        });
        // 302, never 301: a permanent redirect off a one time authorization
        // callback is exactly the kind of thing browsers cache forever
        res.status(302).redirect(destinationUri);
      }
    }
    return next.handle();
  }
}

function getAuthorizationCallback(
  context: ExecutionContext,
  reflector?: Reflector,
  appBaseUrl?: string,
): AuthorizationCallback | undefined {
  const req = context.switchToHttp().getRequest();
  if (!reflector || !req) return;
  const baseUrl = getBaseUrl(req, appBaseUrl);
  const authorizationCallback: AuthorizationCallback = reflector.get(AUTHORIZATION_CALLBACK, context.getHandler());
  if (!authorizationCallback) return;
  const controllerPath = reflector.get(PATH_METADATA, context.getClass()) || '';
  const methodPath = reflector.get(PATH_METADATA, context.getHandler()) || '';
  let callbackEndpoint = authorizationCallback.callbackEndpoint || joinRoutePath(controllerPath, methodPath);
  callbackEndpoint = callbackEndpoint?.[0] === '/' ? `${baseUrl}${callbackEndpoint}` : callbackEndpoint;
  return {
    destinationUriFromQuery: true,
    manual: false,
    persistSession: true,
    ...authorizationCallback,
    callbackEndpoint,
  };
}

async function handleAuthorizationCallback(
  req: KeycloakRequest<Request>,
  res: Response | undefined,
  keycloakService: KeycloakService,
  authorizationCallback?: AuthorizationCallback,
  code?: string,
  state?: string,
): Promise<(Grant & { destinationUri: string; redirectUri: string }) | undefined> {
  let { redirectUri } = authorizationCallback || {};
  const query = getQuery(req);
  if (!code) code = query.get('code') || undefined;
  if (!state) state = query.get('state') || undefined;
  verifyAuthorizationState(req, res, keycloakService, authorizationCallback, state);
  if (!code) throw new BadRequestException('missing authorization code');
  // everything the authorization server appends to the callback url has to come
  // back off, because the `redirect_uri` sent to the token endpoint must match
  // the one sent to the authorization endpoint byte for byte. `iss` is added by
  // keycloak 18 and newer (rfc 9207)
  query.delete('code');
  query.delete('iss');
  query.delete('session_state');
  query.delete('state');
  if (!redirectUri) {
    if (authorizationCallback?.callbackEndpoint) {
      redirectUri = `${authorizationCallback.callbackEndpoint}?${query.toString()}`;
    } else {
      throw new Error('authorization callback requires a redirect uri');
    }
  }
  const grant = await keycloakService.authorizationCodeGrant(
    {
      code,
      redirectUri,
    },
    authorizationCallback?.persistSession !== false,
  );
  if (!grant) return;
  const destinationUri = resolveDestinationUri(req, keycloakService, authorizationCallback, query);
  return {
    ...((grant || {}) as any),
    destinationUri,
    redirectUri,
  };
}

/**
 * Rejects a callback whose `state` is missing, unknown, expired or replayed.
 *
 * Without this the authorization code flow has no csrf binding at all: anyone
 * who can make a victim's browser hit the callback url with a code of the
 * attacker's choosing logs that victim into the attacker's account.
 */
function verifyAuthorizationState(
  req: KeycloakRequest<Request>,
  res: Response | undefined,
  keycloakService: KeycloakService,
  authorizationCallback?: AuthorizationCallback,
  state?: string,
) {
  const required = authorizationCallback?.requireState ?? keycloakService.requireAuthorizationState;
  const result = consumeAuthState(req, res, state, keycloakService.authStateOptions);
  if (result.valid) return;
  if (!required) {
    logger.warn(
      `accepting an authorization callback with ${result.reason} oauth state because state verification is disabled`,
    );
    return;
  }
  throw new ForbiddenException(`invalid oauth state (${result.reason})`);
}

/**
 * Resolves where to send the browser after a successful login, rejecting any
 * destination that would leave the application's own origin.
 */
function resolveDestinationUri(
  req: KeycloakRequest<Request>,
  keycloakService: KeycloakService,
  authorizationCallback: AuthorizationCallback | undefined,
  query: URLSearchParams,
): string {
  const fromQuery =
    !authorizationCallback || authorizationCallback?.destinationUriFromQuery
      ? decodeURIComponent(query.get('destination_uri') || '')
      : '';
  const fallback = authorizationCallback?.destinationUri;
  if (fromQuery) {
    const baseUrl = getBaseUrl(req, keycloakService.appBaseUrl);
    if (isSafeRedirect(fromQuery, baseUrl, keycloakService.allowedRedirectOrigins)) return fromQuery;
    logger.warn('rejected an off origin destination_uri on the authorization callback');
    if (!fallback) throw new BadRequestException('invalid destination uri');
    return fallback;
  }
  if (!fallback) throw new BadRequestException('authorization callback requires a destination uri');
  return fallback;
}

export { getBaseUrl };

export interface AuthorizationCallback {
  callbackEndpoint?: string;
  default?: boolean;
  destinationUri?: string;
  destinationUriFromQuery?: boolean;
  manual?: boolean;
  persistSession?: boolean;
  redirectUri?: string;
  // overrides the module level `requireAuthorizationState` option
  requireState?: boolean;
}

export type HandleAuthorizationCallbackFunction = (
  code?: string,
  state?: string,
) => Promise<(Grant & { destinationUri: string; redirectUri: string }) | undefined>;
