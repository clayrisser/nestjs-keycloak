/**
 * File: /src/services/databaseService.ts
 * Project: apache-age-client
 * File Created: 13-09-2022 05:50:34
 * Author: Apache Software Foundation
 * -----
 * Last Modified: 13-09-2022 07:29:23
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

import * as util from "util";
import { PoolClient } from "pg";
import { ConnectionInfo } from "../types";
import { GraphRepository } from "../graphRepository";
import { getQuery } from "../tools/sqlFlavorManager";

const logger = console;

export class DatabaseService {
  private _graphRepository: GraphRepository | null;

  constructor() {
    this._graphRepository = null;
  }

  async getMetaData() {
    try {
      const connectionInfo = this.getConnectionInfo();
      return {
        database: connectionInfo.database,
        edges: await this.getEdges(),
        graph: connectionInfo.graph,
        nodes: await this.getNodes(),
        propertyKeys: await this.getPropertyKeys(),
        role: await this.getRole(),
      };
    } catch (error) {
      throw error;
    }
  }

  async getGraphLabels() {
    if (!this._graphRepository) throw new Error("not connected");
    const graphRepository = this._graphRepository;
    try {
      const queryResult = await graphRepository.execute(
        getQuery("graph_labels", graphRepository.flavor),
        [this.getConnectionInfo().graph]
      );
      return queryResult.rows;
    } catch (error) {
      throw error;
    }
  }

  async getGraphLabelCount(labelName: string, labelKind: string) {
    if (!this._graphRepository) throw new Error("not connected");
    const graphRepository = this._graphRepository;
    let query = "";
    if (labelKind === "v") {
      query = util.format(
        getQuery("label_count_vertex", graphRepository.flavor),
        `${this.getConnectionInfo().graph}.${labelName}`
      );
    } else if (labelKind === "e") {
      query = util.format(
        getQuery("label_count_edge", graphRepository.flavor),
        `${this.getConnectionInfo().graph}.${labelName}`
      );
    }
    const queryResult = await graphRepository.execute(query);
    return queryResult.rows;
  }

  async getNodes() {
    if (!this._graphRepository) throw new Error("not connected");
    const graphRepository = this._graphRepository;
    let queryResult = await graphRepository.execute(
      util.format(
        getQuery("meta_nodes", graphRepository.flavor),
        graphRepository.graph,
        graphRepository.graph
      )
    );
    return queryResult.rows;
  }

  async getEdges() {
    if (!this._graphRepository) throw new Error("not connected");
    let graphRepository = this._graphRepository;
    let queryResult = await graphRepository.execute(
      util.format(
        getQuery("meta_edges", graphRepository.flavor),
        graphRepository.graph,
        graphRepository.graph
      )
    );
    return queryResult.rows;
  }

  async getPropertyKeys() {
    if (!this._graphRepository) throw new Error("not connected");
    let graphRepository = this._graphRepository;
    let queryResult = await graphRepository.execute(
      getQuery("property_keys", graphRepository.flavor)
    );
    return queryResult.rows;
  }

  async getRole() {
    if (!this._graphRepository) throw new Error("not connected");
    const graphRepository = this._graphRepository;
    let queryResult = await graphRepository.execute(
      getQuery("get_role", graphRepository.flavor),
      [this.getConnectionInfo().user]
    );
    return queryResult.rows[0];
  }

  async connectDatabase(connectionInfo: ConnectionInfo) {
    let graphRepository = this._graphRepository;
    if (graphRepository == null) {
      this._graphRepository = new GraphRepository(connectionInfo);
      graphRepository = this._graphRepository;
    }
    try {
      const client = await GraphRepository.getConnection(
        graphRepository.getConnectionInfo(),
        true
      );
      if ((client as PoolClient).release) (client as PoolClient).release();
    } catch (err) {
      this._graphRepository = null;
      throw err;
    }
  }

  async disconnectDatabase() {
    if (!this._graphRepository) {
      logger.warn("already disconnected");
      return false;
    } else {
      const isRelease = await this._graphRepository.releaseConnection();
      if (isRelease) {
        this._graphRepository = null;
        return true;
      } else {
        logger.error("failed to release connection");
        return false;
      }
    }
  }

  async getConnectionStatus() {
    let graphRepository = this._graphRepository;
    if (!graphRepository) return false;
    try {
      const client = await GraphRepository.getConnection(
        graphRepository.getConnectionInfo()
      );
      if ((client as PoolClient).release) (client as PoolClient).release();
    } catch (err) {
      return false;
    }
    return true;
  }

  getConnectionInfo() {
    if (!this._graphRepository) throw new Error("not connected");
    return this._graphRepository.getConnectionInfo();
  }

  isConnected() {
    return !!this._graphRepository;
  }
}
