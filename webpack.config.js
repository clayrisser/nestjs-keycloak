/**
 * File: /webpack.config.js
 * Project: whisker-keycloak
 * File Created: 14-07-2021 11:43:59
 * Author: Clay Risser <email@clayrisser.com>
 * -----
 * Last Modified: 14-07-2021 11:46:58
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

const path = require('path');

module.exports = {
  mode: 'production',
  entry: './src/index.ts',
  target: 'web',
  resolve: {
    extensions: ['.mjs', '.tsx', '.ts', '.js', '.jsx']
  },
  output: {
    filename: 'bundle.js',
    library: 'whiskerKeycloak',
    libraryExport: 'default',
    libraryTarget: 'assign',
    path: path.resolve(__dirname, 'dist')
  },
  module: {
    rules: [
      {
        test: /\.(m?js)|([jt]sx?)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            babelrc: true,
            envName: 'umd'
          }
        }
      }
    ]
  }
};
