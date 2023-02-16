/**
 * File: /src/tools/sqlFlavorManager.ts
 * Project: apache-age-client
 * File Created: 13-09-2022 04:45:20
 * Author: Apache Software Foundation
 * -----
 * Last Modified: 13-09-2022 07:03:37
 * Modified By: Clay Risser
 * -----
 * Risser Labs LLC (c) Copyright 2022
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

import * as path from "path";
import fs from "fs";
import { flavors } from "../config";

const sqlBasePath = path.join(__dirname, "../../sql");

export function getQuery(name?: string, flavor = flavors.AGE) {
  const defaultSqlPath = path.join(sqlBasePath, `./${name}/default.sql`);
  let sqlPath = path.join(sqlBasePath, `./${name}/${flavor}.sql`);
  if (fs.existsSync(defaultSqlPath)) sqlPath = defaultSqlPath;
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`sql does not exist for name ${name}`);
  }
  return fs.readFileSync(sqlPath, "utf8");
}
