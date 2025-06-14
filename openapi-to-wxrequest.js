#!/usr/bin/env node

/**
 * OpenAPI to wx.request Generator
 * 
 * This script converts an OpenAPI 3.0.1 specification into a JavaScript module
 * with wx.request functions for WeChat Mini Program.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { program } = require('commander');

// Set up command line interface
program
  .name('openapi-to-wxrequest')
  .description('Converts OpenAPI 3.0.1 spec to wx.request functions')
  .version('1.0.0')
  .requiredOption('-i, --input <path>', 'Path to OpenAPI spec file (JSON or YAML)')
  .requiredOption('-o, --output <path>', 'Output JavaScript file path')
  .option('-b, --base-url <url>', 'Base URL for API requests')
  .parse(process.argv);

const options = program.opts();

/**
 * Main function to convert OpenAPI spec to wx.request functions
 */
async function convertOpenApiToWxRequest() {
  try {
    // Read and parse the OpenAPI spec
    const specContent = fs.readFileSync(options.input, 'utf8');
    const spec = options.input.endsWith('.yaml') || options.input.endsWith('.yml')
      ? yaml.load(specContent)
      : JSON.parse(specContent);

    // Validate OpenAPI version
    if (!spec.openapi || !spec.openapi.startsWith('3.0')) {
      throw new Error('Only OpenAPI 3.0.x specifications are supported');
    }

    // Extract base URL from spec or command line option
    const baseUrl = options.baseUrl || (spec.servers && spec.servers[0] && spec.servers[0].url) || '';

    // Generate the output JavaScript code
    const outputCode = generateJavaScriptModule(spec, baseUrl);

    // Write the output to file
    fs.writeFileSync(options.output, outputCode, 'utf8');
    console.log(`Successfully generated wx.request functions at ${options.output}`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

/**
 * Generate the JavaScript module with wx.request functions
 * @param {Object} spec - The parsed OpenAPI specification
 * @param {string} baseUrl - The base URL for API requests
 * @returns {string} - The generated JavaScript code
 */
function generateJavaScriptModule(spec, baseUrl) {
  // Start with module header
  let code = generateModuleHeader(spec, baseUrl);

  // Generate functions for each path and method
  const functionDefinitions = [];
  const exportedFunctions = [];

  // Process all paths
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      // Skip if not an HTTP method
      if (!['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(method)) {
        continue;
      }

      const functionInfo = generateFunction(spec, path, method, operation, baseUrl);
      functionDefinitions.push(functionInfo.code);
      exportedFunctions.push(functionInfo.name);
    }
  }

  // Add function definitions to the code
  code += functionDefinitions.join('\n\n');

  // Add return client and module exports
  code += '\n\n  return client;\n}\n\n';
  code += '// Export the client factory function\nmodule.exports = { createClient };\n';

  return code;
}

/**
 * Generate the module header with imports and configuration
 * @param {Object} spec - The parsed OpenAPI specification
 * @param {string} baseUrl - The base URL for API requests
 * @returns {string} - The generated header code
 */
function generateModuleHeader(spec, baseUrl) {
  return `/**
 * ${spec.info.title} - API Client
 * ${spec.info.description || ''}
 * Version: ${spec.info.version}
 * 
 * Auto-generated from OpenAPI specification
 */

/**
 * Creates an API client with the specified configuration
 * @param {Object} config - Client configuration
 * @param {string} config.baseUrl - Base URL for API requests
 * @returns {Object} - API client object with all available methods
 */
function createClient(config = {}) {
  // Use provided baseUrl or default
  const BASE_URL = config.baseUrl || "${baseUrl}";

  /**
   * Makes a request using wx.request with Promise wrapper
   * @param {Object} options - The wx.request options
   * @returns {Promise<any>} - Promise resolving to the response data
   */
  function request(options) {
    return new Promise((resolve, reject) => {
      wx.request({
        ...options,
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data);
          } else {
            reject({
              statusCode: res.statusCode,
              message: res.data?.message || 'Request failed',
              data: res.data
            });
          }
        },
        fail: (err) => {
          reject({
            message: err.errMsg || 'Network error',
            ...err
          });
        }
      });
    });
  }

  // Client object to hold all API methods
  const client = {};

`;
}

/**
 * Normalize a parameter name to follow JavaScript naming conventions
 * @param {string} name - The original parameter name
 * @returns {string} - The normalized parameter name
 */
function normalizeParamName(name) {
  // Replace invalid characters with underscores
  let normalized = name.replace(/[^a-zA-Z0-9_$]/g, '_');
  
  // Ensure the name doesn't start with a number
  if (/^\d/.test(normalized)) {
    normalized = '_' + normalized;
  }
  
  // Convert to camelCase if it contains underscores or hyphens
  if (name.includes('-') || name.includes('_')) {
    normalized = normalized.replace(/[_-]([a-zA-Z0-9])/g, (_, char) => char.toUpperCase());
  }
  
  return normalized;
}

/**
 * Generate a function for a specific API endpoint
 * @param {Object} spec - The parsed OpenAPI specification
 * @param {string} path - The API path
 * @param {string} method - The HTTP method
 * @param {Object} operation - The operation object from the spec
 * @param {string} baseUrl - The base URL for API requests
 * @returns {Object} - Object containing the function name and code
 */
function generateFunction(spec, path, method, operation, baseUrl) {
  // Generate function name based on operationId or path+method
  const functionName = operation.operationId || generateFunctionNameFromPath(method, path);
  
  // Extract parameters and request body
  const pathParams = (operation.parameters || []).filter(p => p.in === 'path');
  const queryParams = (operation.parameters || []).filter(p => p.in === 'query');
  const headerParams = (operation.parameters || []).filter(p => p.in === 'header');
  const requestBody = operation.requestBody;
  
  // Generate JSDoc for the function
  let jsDoc = generateJSDoc(spec, operation, pathParams, queryParams, headerParams, requestBody);
  
  // Generate function implementation - now as a client method
  let functionCode = `${jsDoc}\n  client.${functionName} = function(params = {}) {\n`;
  
  // Destructure parameters with defaults
  if (pathParams.length > 0 || queryParams.length > 0 || headerParams.length > 0 || requestBody) {
    functionCode += `    // Destructure parameters with defaults\n`;
    functionCode += `    const {\n`;
    
    // Add path parameters
    for (const param of pathParams) {
      const normalizedName = normalizeParamName(param.name);
      functionCode += `      ${normalizedName},\n`;
    }
    
    // Add query parameters with defaults
    for (const param of queryParams) {
      const normalizedName = normalizeParamName(param.name);
      functionCode += `      ${normalizedName}${param.required ? '' : ' = undefined'},\n`;
    }
    
    // Add header parameters with defaults
    for (const param of headerParams) {
      const normalizedName = normalizeParamName(param.name);
      functionCode += `      ${normalizedName}${param.required ? '' : ' = undefined'},\n`;
    }
    
    // Add request body if present
    if (requestBody) {
      functionCode += `      requestData${requestBody.required ? '' : ' = undefined'},\n`;
    }
    
    functionCode += `    } = params;\n\n`;
  }
  
  // URL construction with normalized parameter names - now using BASE_URL from client
  functionCode += `    // Construct URL with path parameters\n`;
  functionCode += `    let url = \`\${BASE_URL}${path.replace(/{([^}]+)}/g, (_, paramName) => {
    const normalizedName = normalizeParamName(paramName);
    return `\${${normalizedName}}`;
  })}\`;\n`;
  
  // Query parameters with normalized names
  if (queryParams.length > 0) {
    functionCode += `\n    // Add query parameters\n`;
    functionCode += `    const queryString = [];\n`;
    for (const param of queryParams) {
      const normalizedName = normalizeParamName(param.name);
      functionCode += `    if (${normalizedName} !== undefined) {\n`;
      functionCode += `      queryString.push(\`${param.name}=\${encodeURIComponent(${normalizedName})}\`);\n`;
      functionCode += `    }\n`;
    }
    functionCode += `    if (queryString.length > 0) {\n`;
    functionCode += `      url += \`?\${queryString.join('&')}\`;\n`;
    functionCode += `    }\n`;
  }
  
  // Request options
  functionCode += `\n    // Prepare request options\n`;
  functionCode += `    const options = {\n`;
  functionCode += `      url,\n`;
  functionCode += `      method: '${method.toUpperCase()}',\n`;
  
  // Headers with normalized names
  if (headerParams.length > 0) {
    functionCode += `      header: {\n`;
    for (const param of headerParams) {
      const normalizedName = normalizeParamName(param.name);
      functionCode += `        '${param.name}': ${normalizedName},\n`;
    }
    functionCode += `      },\n`;
  }
  
  // Request body
  if (requestBody) {
    const contentType = Object.keys(requestBody.content)[0] || 'application/json';
    functionCode += `      header: {\n`;
    functionCode += `        'Content-Type': '${contentType}',\n`;
    if (headerParams.length > 0) {
      for (const param of headerParams) {
        const normalizedName = normalizeParamName(param.name);
        functionCode += `        '${param.name}': ${normalizedName},\n`;
      }
    }
    functionCode += `      },\n`;
    functionCode += `      data: requestData,\n`;
  }
  
  functionCode += `    };\n\n`;
  functionCode += `    return request(options);\n`;
  functionCode += `  };\n`;
  
  return {
    name: functionName,
    code: functionCode
  };
}

/**
 * Generate JSDoc comment for a function
 * @param {Object} spec - The parsed OpenAPI specification
 * @param {Object} operation - The operation object from the spec
 * @param {Array} pathParams - Path parameters
 * @param {Array} queryParams - Query parameters
 * @param {Array} headerParams - Header parameters
 * @param {Object} requestBody - Request body object
 * @returns {string} - The generated JSDoc comment
 */
function generateJSDoc(spec, operation, pathParams, queryParams, headerParams, requestBody) {
  let jsDoc = '/**\n';
  
  // Function description
  jsDoc += ` * ${operation.summary || ''}\n`;
  if (operation.description) {
    jsDoc += ` * ${operation.description}\n`;
  }
  jsDoc += ` *\n`;
  
  // Single params object parameter
  jsDoc += ` * @param {Object} params - The parameters for the request\n`;
  
  // Individual parameters as properties
  const allParams = [...pathParams, ...queryParams, ...headerParams];
  if (allParams.length > 0) {
    for (const param of allParams) {
      const schema = resolveSchema(spec, param.schema);
      const type = getTypeFromSchema(schema);
      const description = param.description || '';
      const required = param.required ? '' : ' (optional)';
      const normalizedName = normalizeParamName(param.name);
      jsDoc += ` * @param {${type}} params.${normalizedName} - ${description}${required}\n`;
    }
  }
  
  // Request body
  if (requestBody) {
    const contentType = Object.keys(requestBody.content)[0] || 'application/json';
    const schema = resolveSchema(spec, requestBody.content[contentType].schema);
    const type = getTypeFromSchema(schema);
    const description = requestBody.description || 'Request body';
    const required = requestBody.required ? '' : ' (optional)';
    jsDoc += ` * @param {${type}} params.requestData - ${description}${required}\n`;
  }
  
  // Return type
  const successResponse = operation.responses && operation.responses['200'];
  if (successResponse && successResponse.content) {
    const contentType = Object.keys(successResponse.content)[0] || 'application/json';
    const schema = successResponse.content[contentType].schema;
    if (schema) {
      const resolvedSchema = resolveSchema(spec, schema);
      const type = getTypeFromSchema(resolvedSchema);
      jsDoc += ` * @returns {Promise<${type}>} Promise resolving to ${successResponse.description || 'response data'}\n`;
    } else {
      jsDoc += ` * @returns {Promise<any>} Promise resolving to ${successResponse.description || 'response data'}\n`;
    }
  } else {
    jsDoc += ` * @returns {Promise<any>} Promise resolving to response data\n`;
  }
  
  jsDoc += ` */`;
  return jsDoc;
}

/**
 * Generate a function name from the path and method
 * @param {string} method - The HTTP method
 * @param {string} path - The API path
 * @returns {string} - The generated function name
 */
function generateFunctionNameFromPath(method, path) {
  // Remove leading slash and replace path parameters
  const cleanPath = path.replace(/^\//, '').replace(/{([^}]+)}/g, '$1');
  
  // Split by slashes and convert to camelCase
  const parts = cleanPath.split('/');
  const camelCaseParts = parts.map((part, index) => {
    // First part is lowercase, rest are capitalized
    if (index === 0) {
      return part.toLowerCase();
    }
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  });
  
  // Combine method and path parts
  return `${method.toLowerCase()}${camelCaseParts.join('')}`;
}

/**
 * Resolve a schema that might contain $ref references
 * @param {Object} spec - The parsed OpenAPI specification
 * @param {Object} schema - The schema object that might contain $ref
 * @returns {Object} - The resolved schema
 */
function resolveSchema(spec, schema) {
  if (!schema) return { type: 'any' };
  
  if (schema.$ref) {
    const refPath = schema.$ref.replace('#/', '').split('/');
    let resolved = spec;
    for (const segment of refPath) {
      resolved = resolved[segment];
      if (!resolved) {
        console.warn(`Could not resolve reference: ${schema.$ref}`);
        return { type: 'any' };
      }
    }
    return resolveSchema(spec, resolved);
  }
  
  return schema;
}

/**
 * Get a JavaScript type string from an OpenAPI schema
 * @param {Object} schema - The OpenAPI schema
 * @returns {string} - The JavaScript type
 */
function getTypeFromSchema(schema) {
  if (!schema) return 'any';
  
  if (schema.type === 'array') {
    const itemType = schema.items ? getTypeFromSchema(schema.items) : 'any';
    return `Array<${itemType}>`;
  }
  
  if (schema.type === 'object' || (!schema.type && schema.properties)) {
    if (schema.properties) {
      const props = Object.entries(schema.properties).map(([name, propSchema]) => {
        const propType = getTypeFromSchema(propSchema);
        const isRequired = schema.required && schema.required.includes(name);
        return `${name}${isRequired ? '' : '?'}: ${propType}`;
      });
      return `{${props.join(', ')}}`;
    }
    return 'object';
  }
  
  // Map OpenAPI types to JavaScript types
  const typeMap = {
    'integer': 'number',
    'number': 'number',
    'string': 'string',
    'boolean': 'boolean',
    'null': 'null'
  };
  
  return typeMap[schema.type] || 'any';
}

// Run the main function
convertOpenApiToWxRequest();