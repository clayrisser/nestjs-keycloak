/**
 * File: /src/services/cypherService.ts
 * Project: apache-age-client
 * File Created: 13-09-2022 05:50:34
 * Author: Apache Software Foundation
 * -----
 * Last Modified: 13-09-2022 07:27:40
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

import { QueryResult } from "pg";
import { GraphRepository } from "../graphRepository";
import {
  Edge,
  EdgeResult,
  Path,
  PathResult,
  Result,
  Vertex,
  VertexResult,
} from "../types";

export class CypherService {
  private _graphRepository: GraphRepository;

  constructor(graphRepository: GraphRepository) {
    this._graphRepository = graphRepository;
  }

  async executeCypher(query: string) {
    if (!query) {
      throw new Error("query not entered!");
    } else {
      try {
        let resultSet = await this._graphRepository.execute(query);
        return this.createResult(resultSet);
      } catch (err) {
        throw err;
      }
    }
  }

  private createResult(resultSet: QueryResult) {
    let result;
    let targetItem = resultSet;
    if (Array.isArray(resultSet)) {
      targetItem = resultSet.pop();
    }
    let cypherRow = targetItem.rows;
    result = {
      rows: cypherRow,
      columns: this._getColumns(targetItem),
      rowCount: this._getRowCount(targetItem),
      command: this._getCommand(targetItem),
    };
    return result;
  }

  private _getColumns(resultSet: QueryResult) {
    return resultSet.fields.map((field) => field.name);
  }

  private _getRowCount(resultSet: QueryResult) {
    return resultSet.rowCount;
  }

  private _getCommand(resultSet: QueryResult) {
    return resultSet.command;
  }

  private _convertRowToResult(resultSet: QueryResult): Result[] {
    return resultSet.rows.map((row) => {
      let convertedObject: Result = {};
      for (let k in row) {
        if (row[k]) {
          let typeName = row[k].constructor.name;
          if (typeName === "Path") {
            convertedObject[k] = this.convertPath(row[k]);
          } else if (typeName === "Vertex") {
            convertedObject[k] = this.convertVertex(row[k] as VertexResult);
          } else if (typeName === "Edge") {
            convertedObject[k] = this.convertEdge(row[k] as EdgeResult);
          } else {
            convertedObject[k] = row[k];
          }
        } else {
          convertedObject[k] = null;
        }
      }
      return convertedObject;
    });
  }

  private convertPath({ vertices, edges }: PathResult): Path {
    const result: Path = [];
    for (let idx in vertices) {
      result.push(this.convertVertex(vertices[idx]));
    }
    for (let idx in edges) {
      result.push(this.convertEdge(edges[idx]));
    }
    return result;
  }

  private convertEdge({ label, id, start, end, props }: EdgeResult): Edge {
    return {
      label: label,
      id: `${id.oid}.${id.id}`,
      start: `${start.oid}.${start.id}`,
      end: `${end.oid}.${end.id}`,
      properties: props,
    };
  }

  private convertVertex({ label, id, props }: VertexResult): Vertex {
    return {
      label: label,
      id: `${id.oid}.${id.id}`,
      properties: props,
    };
  }
}
