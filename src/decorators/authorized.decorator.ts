/**
 * File: /src/decorators/authorized.decorator.ts
 * Project: nestjs-keycloak
 * File Created: 14-07-2021 11:43:57
 * Author: Clay Risser <email@clayrisser.com>
 * -----
 * Last Modified: 06-11-2022 04:14:02
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

import { RENDER_METADATA } from '@nestjs/common/constants';
import type { Request, Response } from 'express';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, Inject, Logger, SetMetadata, UseFilters, applyDecorators } from '@nestjs/common';
import type { KeycloakRequest, KeycloakOptions } from '../types';
import { KEYCLOAK_OPTIONS } from '../types';
import { createAuthState, DEFAULT_AUTH_STATE_TTL } from '../authState';
import { describeError, getBaseUrl, isSafeRedirect } from '../security';
import { getGlobalRegistrationMap } from '../keycloakRegister.service';

export const AUTHORIZED = 'KEYCLOAK_AUTHORIZED';

export const Authorized = (...roles: (string | string[])[]) => {
  return applyDecorators(SetMetadata(AUTHORIZED, roles || []), UseFilters(UnauthorizedFilter));
};

@Catch(HttpException)
export class UnauthorizedFilter implements ExceptionFilter {
  private readonly logger = new Logger(UnauthorizedFilter.name);

  constructor(@Inject(KEYCLOAK_OPTIONS) private options: KeycloakOptions) {}

  catch(exception: HttpException, host: ArgumentsHost) {
    const req = host.switchToHttp()?.getRequest<KeycloakRequest<Request>>();
    const res = host.switchToHttp()?.getResponse<Response>();
    if (req.redirectUnauthorized) {
      return res.status(req.redirectUnauthorized.status).redirect(req.redirectUnauthorized.url);
    }
    const authorizationCallback = getGlobalRegistrationMap().defaultAuthorizationCallback;
    if (authorizationCallback && req.redirectUnauthorized !== false && req.annotationKeys?.has(RENDER_METADATA)) {
      const baseUrl = getBaseUrl(req, this.options.appBaseUrl);
      let { callbackEndpoint } = authorizationCallback;
      callbackEndpoint = callbackEndpoint?.[0] === '/' ? `${baseUrl}${callbackEndpoint}` : callbackEndpoint;
      const destinationUri = `${baseUrl}${req.originalUrl}`;
      if (!isSafeRedirect(destinationUri, baseUrl, this.options.allowedRedirectOrigins)) {
        return res.status(exception?.getStatus()).json(exception.getResponse());
      }
      let state: string;
      try {
        // the state is bound to this browser here and verified at the callback,
        // which is what makes the login flow resistant to csrf
        state = createAuthState(req, res, {
          secret: this.options.clientSecret,
          ttl: this.options.authorizationStateTtl ?? DEFAULT_AUTH_STATE_TTL,
          secure: baseUrl.startsWith('https:'),
        });
      } catch (err) {
        this.logger.error(`cannot start a login redirect: ${describeError(err)}`);
        return res.status(exception?.getStatus()).json(exception.getResponse());
      }
      // 302, never 301: the login redirect carries a single use state value and
      // must not be cached by the browser
      return res.status(302).redirect(
        `${(this.options.baseUrl || '').replace(/\/+$/, '')}/realms/${
          this.options.realm
        }/protocol/openid-connect/auth?${new URLSearchParams({
          client_id: this.options.clientId,
          redirect_uri: `${callbackEndpoint}?destination_uri=${encodeURIComponent(destinationUri)}`,
          response_type: 'code',
          scope: 'openid',
          state,
        }).toString()}`,
      );
    }
    return res.status(exception?.getStatus()).json(exception.getResponse());
  }
}
