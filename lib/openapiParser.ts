import SwaggerParser from "@apidevtools/swagger-parser";
import { parse } from "yaml";
import type { OpenAPIV3, OpenAPI } from "openapi-types";

type HttpMethod =
  | "get" | "put" | "post" | "delete"
  | "options" | "head" | "patch" | "trace";

export type ParsedEndpoint = {
  method: string;
  path: string;
  summary?: string;
  parameters?: OpenAPIV3.ParameterObject[];
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
    parsedDoc = parse(fileContent);
  }

  if (
    typeof parsedDoc !== "object" ||
    parsedDoc == null ||
    !("openapi" in parsedDoc) ||
    typeof parsedDoc.openapi !== "string" ||
    !parsedDoc.openapi.startsWith("3.")
  ) {
    throw new Error("Somente OpenAPI v3 é suportado atualmente.");
  }

  const dereferenced = await new SwaggerParser().dereference(
    parsedDoc as OpenAPIV3.Document
  );
  const api = dereferenced as OpenAPIV3.Document;

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
