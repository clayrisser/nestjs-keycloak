/**
 * File: /src/index.ts
 * Project: apache-age-client
 * File Created: 13-09-2022 04:18:52
 * Author: Apache Software Foundation
 * -----
 * Last Modified: 13-09-2022 07:39:56
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

import { ConnectionInfo } from "./types";
import { DatabaseService, CypherService } from "./services";
import { GraphRepository } from "./graphRepository";

export class ApacheAgeClient {
  constructor(
    public graphRepository: GraphRepository,
    public databaseService: DatabaseService,
    public cypherService: CypherService
  ) {}

  static async connect(connectionInfo: ConnectionInfo) {
    const graphRepository = new GraphRepository(connectionInfo);
    const databaseService = new DatabaseService();
    await databaseService.connectDatabase(connectionInfo);
    const cypherService = new CypherService(graphRepository);
    return new ApacheAgeClient(graphRepository, databaseService, cypherService);
  }

  get graph() {
    return this.graphRepository.graph;
  }

  isConnected() {
    return this.databaseService.isConnected();
  }

  async disconnect() {
    return this.databaseService.disconnectDatabase();
  }

  async getMetaData() {
    return this.databaseService.getMetaData();
  }

  async getGraphLabels() {
    return this.databaseService.getGraphLabels();
  }

  async getGraphLabelCount(labelName: string, labelKind: string) {
    return this.databaseService.getGraphLabelCount(labelName, labelKind);
  }

  async getNodes() {
    return this.databaseService.getNodes();
  }

  async getEdges() {
    return this.databaseService.getEdges();
  }

  async getPropertyKeys() {
    return this.databaseService.getPropertyKeys();
  }

  async getRole() {
    return this.databaseService.getRole();
  }

  async getConnectionStatus() {
    return this.databaseService.getConnectionStatus();
  }

  async executeCypher(query: string) {
    return this.cypherService.executeCypher(query);
  }

  async getConnection() {
    return this.graphRepository.getConnection();
  }

  async getConnectionInfo() {
    return this.graphRepository.getConnectionInfo();
  }
}

export default ApacheAgeClient;

export * from "./config";
export * from "./graphRepository";
export * from "./services";
export * from "./types";
export * from "./tools";
