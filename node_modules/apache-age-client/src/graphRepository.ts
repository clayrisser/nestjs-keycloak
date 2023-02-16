/**
 * File: /src/graphRepository.ts
 * Project: apache-age-client
 * File Created: 13-09-2022 05:34:30
 * Author: Apache Software Foundation
 * -----
 * Last Modified: 13-09-2022 07:56:39
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

import pg, { PoolConfig, Pool, PoolClient, QueryResult } from "pg";
import types from "pg-types";
import { flavors, pg as pgConfig } from "./config";
import { setAgeTypes } from "./tools/ageParser";
import { Flavor, ConnectionInfo } from "./types";

export class GraphRepository {
  flavor: Flavor;
  private _database?: string;
  private _graph?: string;
  private _host?: string;
  private _password?: string;
  private _pool?: Pool;
  private _port?: number;
  private _user?: string;

  constructor({
    host,
    port,
    database,
    graph,
    user,
    password,
    flavor,
  }: ConnectionInfo = {}) {
    this._host = host;
    this._port = port;
    this._database = database;
    this._graph = graph;
    this._user = user;
    this._password = password;
    this.flavor = flavor || flavors.AGE;
  }

  static async getConnection(
    { database, flavor, host, password, port, user }: ConnectionInfo = {},
    closeConnection = true
  ): Promise<pg.Client | PoolClient> {
    const client = new pg.Client({
      user,
      password,
      host,
      database,
      port,
    });
    client.connect();
    if (flavor === flavors.AGE) {
      await setAgeTypes(client, types);
    } else {
      throw new Error(`unknown flavor ${flavor}`);
    }
    if (closeConnection === true) await client.end();
    return client;
  }

  static newConnectionPool(poolConnectionConfig: PoolConfig) {
    return new pg.Pool(poolConnectionConfig);
  }

  async execute(
    query: string,
    params: (string | undefined)[] = []
  ): Promise<QueryResult> {
    const client = await this.getConnection();
    let result = null;
    try {
      result = await client.query(query, params);
    } catch (err) {
      throw err;
    } finally {
      client.release();
    }
    return result;
  }

  async getConnection() {
    if (!this._pool) {
      this._pool = GraphRepository.newConnectionPool(
        this.getPoolConnectionInfo()
      );
    }
    const client = await this._pool.connect();
    if (this.flavor === "AGE") {
      await setAgeTypes(client, types);
    } else {
      await client.query(`set graph_path = ${this._graph}`);
    }
    return client;
  }

  async releaseConnection() {
    try {
      if (this._pool) await this._pool.end();
      return true;
    } catch (err) {
      throw err;
    }
  }

  getPoolConnectionInfo(): PoolConfig {
    if (!this._host || !this._port || !this._database) {
      throw new Error("missing connection config");
    }
    return {
      connectionTimeoutMillis: pgConfig.connectionTimeoutMillis,
      database: this._database,
      host: this._host,
      idleTimeoutMillis: pgConfig.idleTimeoutMillis,
      max: pgConfig.max,
      password: this._password,
      port: this._port,
      user: this._user,
    };
  }

  getConnectionInfo() {
    if (!this._host || !this._port || !this._database) {
      throw new Error("not connected");
    }
    return {
      host: this._host,
      port: this._port,
      database: this._database,
      user: this._user,
      password: this._password,
      graph: this._graph,
      flavor: this.flavor,
    };
  }

  get graph() {
    return this._graph;
  }
}
