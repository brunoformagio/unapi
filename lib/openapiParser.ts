import SwaggerParser from "@apidevtools/swagger-parser";
import { parse } from "yaml";
import type { OpenAPIV3, OpenAPIV2, OpenAPI } from "openapi-types";

type HttpMethod =
  | "get" | "put" | "post" | "delete"
  | "options" | "head" | "patch" | "trace";

export type ParsedEndpoint = {
  method: string;
  path: string;
  summary?: string;
  parameters?: (OpenAPIV3.ParameterObject | OpenAPIV2.ParameterObject)[];
  requestBodyExample?: Record<string, unknown> | null;
};

function isHttpMethod(value: string): value is HttpMethod {
  return [
    "get", "put", "post", "delete",
    "options", "head", "patch", "trace"
  ].includes(value.toLowerCase());
}

export async function parseOpenAPIDocument(
  fileContent: string
): Promise<{
  endpoints: ParsedEndpoint[];
  baseUrl?: string;
}> {
  let parsedDoc: OpenAPI.Document;

  try {
    parsedDoc = JSON.parse(fileContent);
  } catch {
    try {
      parsedDoc = parse(fileContent);
    } catch (e) {
      console.error("Failed to parse the document:", e);
      throw new Error("Invalid OpenAPI document. Could not parse as JSON or YAML.");
    }
  }

  if (typeof parsedDoc !== "object" || parsedDoc == null) {
    throw new Error("Invalid OpenAPI document. Document must be an object.");
  }

  // Determine if it's OpenAPI v3 or Swagger v2
  const isOpenAPIv3 = "openapi" in parsedDoc && 
    typeof parsedDoc.openapi === "string" && 
    parsedDoc.openapi.startsWith("3.");
  
  const isSwaggerv2 = "swagger" in parsedDoc && 
    typeof parsedDoc.swagger === "string" && 
    parsedDoc.swagger.startsWith("2.");

  if (!isOpenAPIv3 && !isSwaggerv2) {
    throw new Error("Only OpenAPI v3 or Swagger v2 formats are supported.");
  }

  // Dereference the document
  const dereferenced = await new SwaggerParser().dereference(parsedDoc);
  
  // Extract endpoints based on the format
  let endpoints: ParsedEndpoint[] = [];
  let baseUrl: string | undefined;

  if (isOpenAPIv3) {
    const result = parseOpenAPIv3Document(dereferenced as OpenAPIV3.Document);
    endpoints = result.endpoints;
    baseUrl = result.baseUrl;
  } else {
    const result = parseSwaggerv2Document(dereferenced as OpenAPIV2.Document);
    endpoints = result.endpoints;
    baseUrl = result.baseUrl;
  }

  return { endpoints, baseUrl };
}

function parseOpenAPIv3Document(
  api: OpenAPIV3.Document
): {
  endpoints: ParsedEndpoint[];
  baseUrl?: string;
} {
  const endpoints: ParsedEndpoint[] = [];

  for (const path in api.paths) {
    for (const method in api.paths[path]) {
      if (isHttpMethod(method)) {
        const pathItem = api.paths[path] as OpenAPIV3.PathItemObject;
        const op = pathItem[method] as OpenAPIV3.OperationObject;

        let requestBodyExample: Record<string, unknown> | null = null;

        const jsonContent = op.requestBody &&
          "content" in op.requestBody &&
          op.requestBody.content?.["application/json"];

        if (jsonContent) {
          requestBodyExample =
            (jsonContent.example as Record<string, unknown>) ||
            (() => {
              const firstExample = Object.values(jsonContent.examples || {})[0];
              return firstExample && "value" in firstExample
                ? (firstExample.value as Record<string, unknown>)
                : null;
            })() || null;
        }

        endpoints.push({
          method: method.toUpperCase(),
          path,
          summary: op.summary || "",
          parameters: (op.parameters || []) as OpenAPIV3.ParameterObject[],
          requestBodyExample,
        });
      }
    }
  }

  const rawUrl = api.servers?.[0]?.url || "";
  const baseUrl = rawUrl.startsWith("http") ? rawUrl : undefined;

  return { endpoints, baseUrl };
}

function parseSwaggerv2Document(
  api: OpenAPIV2.Document
): {
  endpoints: ParsedEndpoint[];
  baseUrl?: string;
} {
  const endpoints: ParsedEndpoint[] = [];

  for (const path in api.paths) {
    for (const method in api.paths[path]) {
      if (isHttpMethod(method)) {
        const pathItem = api.paths[path] as Record<string, unknown>;
        const op = pathItem[method] as OpenAPIV2.OperationObject;

        // Extract request body example from definitions in Swagger v2
        let requestBodyExample: Record<string, unknown> | null = null;

        if (op.parameters) {
          const bodyParam = op.parameters.find(
            param => 'in' in param && param.in === 'body'
          ) as OpenAPIV2.ParameterObject;

          if (bodyParam && 'schema' in bodyParam) {
            // Try to find example from schema
            if (bodyParam.schema && 'example' in bodyParam.schema) {
              requestBodyExample = bodyParam.schema.example as Record<string, unknown>;
            } else if (
              bodyParam.schema && 
              '$ref' in bodyParam.schema && 
              typeof bodyParam.schema.$ref === 'string'
            ) {
              // The schema is already dereferenced by SwaggerParser, so we shouldn't
              // need to resolve the reference manually anymore
              const schemaName = bodyParam.schema.$ref.split('/').pop();
              
              if (
                schemaName && 
                api.definitions && 
                schemaName in api.definitions
              ) {
                const definition = api.definitions[schemaName];
                if ('example' in definition) {
                  requestBodyExample = definition.example as Record<string, unknown>;
                } else {
                  // Create an example from the schema properties if available
                  try {
                    requestBodyExample = createExampleFromSchema(definition);
                  } catch (e) {
                    console.warn(`Failed to create example for ${schemaName}:`, e);
                    requestBodyExample = null;
                  }
                }
              }
            }
          }
        }

        endpoints.push({
          method: method.toUpperCase(),
          path,
          summary: op.summary || "",
          parameters: (op.parameters || []) as (OpenAPIV3.ParameterObject | OpenAPIV2.ParameterObject)[],
          requestBodyExample,
        });
      }
    }
  }

  // In Swagger v2, baseUrl is constructed from host, basePath, and schemes
  let baseUrl: string | undefined;
  if (api.host) {
    const scheme = api.schemes && api.schemes.length > 0 
      ? api.schemes[0] 
      : 'https';
    
    const basePath = api.basePath || '';
    baseUrl = `${scheme}://${api.host}${basePath}`;
  }

  return { endpoints, baseUrl };
}

function createExampleFromSchema(
  schema: OpenAPIV2.SchemaObject
): Record<string, unknown> | null {
  if (!schema.properties) {
    return null;
  }

  const example: Record<string, unknown> = {};

  for (const [propName, propSchema] of Object.entries(schema.properties)) {
    if ('example' in propSchema) {
      example[propName] = propSchema.example;
    } else if (propSchema.type === 'string') {
      example[propName] = `example-${propName}`;
    } else if (propSchema.type === 'number' || propSchema.type === 'integer') {
      example[propName] = 0;
    } else if (propSchema.type === 'boolean') {
      example[propName] = false;
    } else if (propSchema.type === 'array') {
      example[propName] = [];
    } else if (propSchema.type === 'object') {
      example[propName] = {};
    }
  }

  return example;
}
