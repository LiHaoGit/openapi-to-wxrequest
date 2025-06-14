# OpenAPI 转 wx.request 函数库生成器

这个工具可以将 OpenAPI 3.0.1 规范转换为微信小程序 `wx.request` 函数库，生成包含所有 API 端点函数的 JavaScript 模块。

## 功能特点

- 支持解析 JSON 和 YAML 格式的 OpenAPI 3.0.x 规范文件
- 为每个 API 端点生成对应的 JavaScript 函数
- 自动处理路径参数、查询参数、请求头参数和请求体
- 为每个函数添加详细的 JSDoc 注释
- 支持复杂类型定义和 `$ref` 引用解析
- 提供 Promise 封装的请求函数

## 安装

```bash
npm install
```

## 使用方法

```bash
node openapi-to-wxrequest.js -i <OpenAPI规范文件> -o <输出JavaScript文件> [-b <基础URL>]
```

### 参数说明

- `-i, --input <path>`: OpenAPI 规范文件路径（JSON 或 YAML 格式）【必需】
- `-o, --output <path>`: 输出 JavaScript 文件路径【必需】
- `-b, --base-url <url>`: API 请求的基础 URL【可选】

### 示例

```bash
node openapi-to-wxrequest.js -i v1.json -o wx-api.js -b "http://localhost:5149/"
```

## 函数说明

以下是脚本中的主要函数及其功能说明：

### convertOpenApiToWxRequest

主函数，负责读取和解析 OpenAPI 规范，验证版本，提取基础 URL，生成输出代码并写入文件。

```javascript
async function convertOpenApiToWxRequest()
```

### generateJavaScriptModule

生成包含 wx.request 函数的 JavaScript 模块。

```javascript
function generateJavaScriptModule(spec, baseUrl)
```

参数：
- `spec`: 解析后的 OpenAPI 规范对象
- `baseUrl`: API 请求的基础 URL

返回：生成的 JavaScript 代码字符串

### generateModuleHeader

生成模块头部，包含导入、配置和辅助函数。

```javascript
function generateModuleHeader(spec, baseUrl)
```

参数：
- `spec`: 解析后的 OpenAPI 规范对象
- `baseUrl`: API 请求的基础 URL

返回：生成的模块头部代码字符串

### generateFunction

为特定的 API 端点生成函数。

```javascript
function generateFunction(spec, path, method, operation, baseUrl)
```

参数：
- `spec`: 解析后的 OpenAPI 规范对象
- `path`: API 路径
- `method`: HTTP 方法
- `operation`: 操作对象
- `baseUrl`: API 请求的基础 URL

返回：包含函数名和代码的对象

### generateJSDoc

为函数生成 JSDoc 注释。

```javascript
function generateJSDoc(spec, operation, pathParams, queryParams, headerParams, requestBody)
```

参数：
- `spec`: 解析后的 OpenAPI 规范对象
- `operation`: 操作对象
- `pathParams`: 路径参数数组
- `queryParams`: 查询参数数组
- `headerParams`: 请求头参数数组
- `requestBody`: 请求体对象

返回：生成的 JSDoc 注释字符串

### generateFunctionParams

生成函数参数字符串。

```javascript
function generateFunctionParams(pathParams, queryParams, headerParams, requestBody)
```

参数：
- `pathParams`: 路径参数数组
- `queryParams`: 查询参数数组
- `headerParams`: 请求头参数数组
- `requestBody`: 请求体对象

返回：函数参数字符串

### generateFunctionNameFromPath

根据路径和方法生成函数名。

```javascript
function generateFunctionNameFromPath(method, path)
```

参数：
- `method`: HTTP 方法
- `path`: API 路径

返回：生成的函数名

### resolveSchema

解析可能包含 $ref 引用的 schema。

```javascript
function resolveSchema(spec, schema)
```

参数：
- `spec`: 解析后的 OpenAPI 规范对象
- `schema`: 可能包含 $ref 的 schema 对象

返回：解析后的 schema

### getTypeFromSchema

从 OpenAPI schema 获取 JavaScript 类型字符串。

```javascript
function getTypeFromSchema(schema)
```

参数：
- `schema`: OpenAPI schema 对象

返回：JavaScript 类型字符串

## 生成的函数示例

```javascript
/**
 * 获取动态列表
 *
 * @param {number} lastId - 最后一条动态ID (optional)
 * @param {number} size - 获取数量 (optional)
 * @returns {Promise<Array<any>>} Promise resolving to OK
 */
function listMoment(lastId = undefined, size = undefined) {
  // Construct URL with path parameters
  let url = `http://localhost:5149//moment/list`;

  // Add query parameters
  const queryString = [];
  if (lastId !== undefined) {
    queryString.push(`lastId=${encodeURIComponent(lastId)}`);
  }
  if (size !== undefined) {
    queryString.push(`size=${encodeURIComponent(size)}`);
  }
  if (queryString.length > 0) {
    url += `?${queryString.join('&')}`;
  }

  // Prepare request options
  const options = {
    url,
    method: 'GET',
  };

  return request(options);
}
```

## 许可证

MIT