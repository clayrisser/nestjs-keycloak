/**
 * File: /src/types.ts
 * Project: apache-age-client
 * File Created: 13-09-2022 05:28:37
 * Author: Apache Software Foundation
 * -----
 * Last Modified: 13-09-2022 07:01:22
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

export type AgeRecord = Record<string, any>;

export type Flavor = "AGE";

export interface PathResult {
  edges: EdgeResult[];
  end: IdResult;
  len: number;
  start: IdResult;
  vertices: VertexResult[];
}

export interface VertexResult {
  id: IdResult;
  label: string;
  props: Record<string, any>;
}

export interface EdgeResult {
  end: IdResult;
  id: IdResult;
  label: string;
  props: Properties;
  start: IdResult;
}

export interface IdResult {
  id: string;
  oid: string;
}

export interface Edge {
  end: string;
  id: string;
  label: string;
  properties: Record<string, any>;
  start: string;
}

export interface Vertex {
  label: string;
  id: string;
  properties: Properties;
}

export type Properties = Record<string, any>;

export type Path = (Vertex | Edge)[];

export type Result = Record<string, Vertex | Edge | Path | null>;

export interface ConnectionInfo {
  database?: string;
  flavor?: Flavor;
  graph?: string;
  host?: string;
  password?: string;
  port?: number;
  user?: string;
}
