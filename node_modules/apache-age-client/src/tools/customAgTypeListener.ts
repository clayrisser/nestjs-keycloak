/**
 * File: /src/tools/customAgTypeListener.ts
 * Project: apache-age-client
 * File Created: 13-09-2022 04:45:20
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

import AgtypeListener from "./AgtypeListener";

export class CustomAgTypeListener extends AgtypeListener {
  rootObject: any = null;
  objectInsider: any[] = [];
  prevObject: any = null;
  lastObject: any = null;
  lastValue: any = null;

  mergeArrayOrObject(key: any) {
    if (this.prevObject instanceof Array) {
      this.mergeArray();
    } else {
      this.mergeObject(key);
    }
  }

  mergeArray() {
    this.prevObject.push(this.lastObject);
    this.lastObject = this.prevObject;
    this.objectInsider.shift();
    this.prevObject = this.objectInsider[1];
  }

  mergeObject(key: any) {
    this.prevObject[key] = this.lastObject;
    this.lastObject = this.prevObject;
    this.objectInsider.shift();
    this.prevObject = this.objectInsider[1];
  }

  createNewObject() {
    const newObject = {};
    this.objectInsider.unshift(newObject);
    this.prevObject = this.lastObject;
    this.lastObject = newObject;
  }

  createNewArray() {
    const newObject: any[] = [];
    this.objectInsider.unshift(newObject);
    this.prevObject = this.lastObject;
    this.lastObject = newObject;
  }

  pushIfArray(value: any) {
    if (this.lastObject instanceof Array) {
      this.lastObject.push(value);
      return true;
    }
    return false;
  }

  exitStringValue(ctx: any) {
    const value = this.stripQuotes(ctx.getText());
    if (!this.pushIfArray(value)) {
      this.lastValue = value;
    }
  }

  exitIntegerValue(ctx: any) {
    const value = parseInt(ctx.getText());
    if (!this.pushIfArray(value)) {
      this.lastValue = value;
    }
  }

  exitFloatValue(ctx: any) {
    const value = parseFloat(ctx.getText());
    if (!this.pushIfArray(value)) {
      this.lastValue = value;
    }
  }

  exitTrueBoolean(_ctx: any) {
    const value = true;
    if (!this.pushIfArray(value)) {
      this.lastValue = value;
    }
  }

  exitFalseBoolean(_ctx: any) {
    const value = false;
    if (!this.pushIfArray(value)) {
      this.lastValue = value;
    }
  }

  exitNullValue(_ctx: any) {
    const value = null;
    if (!this.pushIfArray(value)) {
      this.lastValue = value;
    }
  }

  exitFloatLiteral(ctx: any) {
    const value = ctx.getText();
    if (!this.pushIfArray(value)) {
      this.lastValue = value;
    }
  }

  enterObjectValue(_ctx: any) {
    this.createNewObject();
  }

  enterArrayValue(_ctx: any) {
    this.createNewArray();
  }

  exitObjectValue(_ctx: any) {
    if (this.prevObject instanceof Array) {
      this.mergeArray();
    }
  }

  exitPair(ctx: any) {
    const name = this.stripQuotes(ctx.STRING().getText());

    if (this.lastValue !== undefined) {
      this.lastObject[name] = this.lastValue;
      this.lastValue = undefined;
    } else {
      this.mergeArrayOrObject(name);
    }
  }

  exitAgType(_ctx: any) {
    this.rootObject = this.objectInsider.shift();
  }

  stripQuotes(quotesString: string) {
    return JSON.parse(quotesString);
  }

  getResult() {
    return this.rootObject || this.lastValue;
  }
}
