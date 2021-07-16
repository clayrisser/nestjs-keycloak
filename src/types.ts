/**
 * File: /src/types.ts
 * Project: nestjs-keycloak
 * File Created: 14-07-2021 11:43:59
 * Author: Clay Risser <email@clayrisser.com>
 * -----
 * Last Modified: 15-07-2021 16:44:34
 * Modified By: Clay Risser <email@clayrisser.com>
 * -----
 * Silicon Hills LLC (c) Copyright 2021
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

import { ModuleMetadata } from '@nestjs/common/interfaces';

type Grant = import('keycloak-connect').Grant;
type Request = import('express').Request;

export interface HashMap<T = any> {
  [key: string]: T;
}

export interface KeycloakOptions {
  adminClientId?: string;
  adminPassword?: string;
  adminUsername?: string;
  baseUrl: string;
  clientId: string;
  clientSecret?: string;
  realm: string;
  register?: boolean;
  strict?: boolean;
}

export interface KeycloakAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  inject?: any[];
  useFactory?: (...args: any[]) => Promise<KeycloakOptions> | KeycloakOptions;
}

export interface UserInfo {
  emailVerified: boolean;
  preferredUsername: string;
  sub: string;
  [key: string]: any;
}

export type KeycloakRequest<T = Request> = {
  kauth?: Kauth;
  resourceDenied?: boolean;
  session?: {
    token?: string;
    kauth?: {
      accessToken?: string;
      refreshToken?: string;
      userInfo?: UserInfo;
    };
    [key: string]: any;
  };
} & T;

export interface Kauth {
  grant?: Grant;
  userInfo?: UserInfo;
}
