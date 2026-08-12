/**
 * File: /src/decorators/injectGrant.decorator.ts
 * Project: @risserlabs/nestjs-keycloak
 * File Created: 05-11-2022 12:16:14
 * Author: Clay Risser
 * -----
 * Last Modified: 14-04-2023 19:37:59
 * Modified By: Clay Risser
 * -----
 * Risser Labs LLC (c) Copyright 2021 - 2022
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

import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
import { getReq } from '../util';

export const InjectGrant = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const req = getReq(context);
  return req?.kauth?.grant;
});
