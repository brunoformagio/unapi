import { groq } from "@/lib/groqClient";
import type { ParsedEndpoint } from "@/lib/openapiParser";
import type { ChatCompletionTool } from "groq-sdk/resources/chat.mjs";
import type { OpenAPIV2, OpenAPIV3 } from "openapi-types";
import {
  agentSystemPrompt,
  apiRequestFailurePrompt,
  chitchatPrompt,
  extractionPrompt,
  helpPrompt,
  intentClassificationPrompt,
  welcomeMessages,
} from "../prompts/agentPrompt";

// Environment variables for model and temperature settings
const MODEL = process.env.UNAPI_MODEL || "llama3-70b-8192";
const TEMP_CLASSIFICATION = Number.parseFloat(process.env.UNAPI_TEMP_CLASSIFICATION || "0.1");
const TEMP_EXTRACTION = Number.parseFloat(process.env.UNAPI_TEMP_EXTRACTION || "0.1");
const TEMP_CHAT = Number.parseFloat(process.env.UNAPI_TEMP_CHAT || "0.7");
const TEMP_API = Number.parseFloat(process.env.UNAPI_TEMP_API || "0.2");

let cachedTools: ChatCompletionTool[] | null = null;
let cachedSystemPrompt: string | null = null;

// Store context from previous interactions to maintain state
interface ConversationContext {
  lastEndpoint?: string;
  lastMethod?: string;
  lastPayload?: Record<string, unknown>;
  missingFields?: string[];
}

// Global conversation context
const conversationContext: ConversationContext = {};

export async function resolveUserIntent(message: string, endpoints: ParsedEndpoint[]) {
  // Handle welcome message case
  if (message.toLowerCase() === "start") {
    return handleStartMessage(endpoints);
  }

  // Handle case when no endpoints are available
  if (endpoints.length === 0) {
    return {
      message: welcomeMessages.noEndpoints,
    };
  }

  // Initialize cache if needed
  ensureAPIToolsInitialized(endpoints);

  // Check if the message is providing missing fields from a previous request
  const missingFieldResponse = await tryHandleMissingFields(message);
  if (missingFieldResponse) {
    return missingFieldResponse;
  }

  // Determine the message intent
  const intent = await classifyMessageIntent(message);

  // Route the message based on its intent
  switch (intent) {
    case "chitchat":
      return handleChitchat(message, endpoints);
    case "help_question":
      return handleHelpQuestion(endpoints);
    default:
      return handleAPIRequest(message, endpoints);
  }
}

function handleStartMessage(endpoints: ParsedEndpoint[]) {
  if (endpoints.length === 0) {
    return { message: welcomeMessages.noEndpoints };
  }

  const limitedEndpoints = endpoints.slice(0, 10);

  // Initialize cache if needed
  ensureAPIToolsInitialized(limitedEndpoints);

  // Reset conversation context when starting a new session
  resetConversationContext();

  return {
    message:
      endpoints.length > 10
        ? welcomeMessages.limited
            .replace("{totalEndpoints}", String(endpoints.length))
            .replace("{limitedEndpoints}", String(limitedEndpoints.length))
        : welcomeMessages.standard.replace("{endpointCount}", String(limitedEndpoints.length)),
  };
}

function ensureAPIToolsInitialized(endpoints: ParsedEndpoint[]) {
  if (!cachedTools || !cachedSystemPrompt) {
    const limitedEndpoints = endpoints.slice(0, 10);
    initializeAPITools(limitedEndpoints);
  }
}

async function tryHandleMissingFields(message: string): Promise<Record<string, unknown> | null> {
  if (
    conversationContext.lastEndpoint &&
    conversationContext.missingFields &&
    conversationContext.missingFields.length > 0
  ) {
    const updatedPayload = await handleMissingFieldResponse(message, conversationContext);
    if (updatedPayload) {
      return {
        method: conversationContext.lastMethod || "GET",
        endpoint: conversationContext.lastEndpoint,
        payload: updatedPayload,
      };
    }
  }
  return null;
}

async function classifyMessageIntent(message: string): Promise<string> {
  const intentClassification = await groq.chat.completions.create({
    model: MODEL,
    temperature: TEMP_CLASSIFICATION,
    messages: [
      {
        role: "system",
        content: intentClassificationPrompt,
      },
      { role: "user", content: message },
    ],
    max_tokens: 10,
  });

  return intentClassification.choices[0]?.message?.content?.trim().toLowerCase() || "api_request";
}

async function handleAPIRequest(message: string, endpoints: ParsedEndpoint[]) {
  ensureAPIToolsInitialized(endpoints);

  const apiResponse = await getApiResponse(message);
  if (!apiResponse.success || !apiResponse.data) {
    return handleAPIRequestFailure(message, endpoints);
  }

  const { method, endpoint, payload } = apiResponse.data;
  const matchedEndpoint = endpoints.find((ep) => ep.method === method && ep.path === endpoint);

  // Check for missing query parameters in GET requests
  if (method === "GET" && matchedEndpoint) {
    const queryParamsResult = await checkMissingQueryParams(message, matchedEndpoint, payload);
    if (queryParamsResult.hasMissingParams) {
      return queryParamsResult.response;
    }
  }

  // Update conversation context with current request
  updateConversationContext(method, endpoint, payload);

  // Check for missing fields in request body
  const missingFieldsResult = checkMissingRequestBodyFields(matchedEndpoint, payload);
  if (missingFieldsResult.hasMissingFields) {
    return missingFieldsResult.response;
  }

  return {
    method,
    endpoint,
    payload,
  };
}

async function handleMissingFieldResponse(
  message: string,
  context: ConversationContext
): Promise<Record<string, unknown> | null> {
  if (!context.lastPayload || !context.missingFields || !context.lastEndpoint) {
    return null;
  }

  // Create a copy of the last payload to update
  const updatedPayload = { ...context.lastPayload };

  // Parse message to extract field values
  const extractedFields = await extractFieldValuesFromMessage(message, context.missingFields);

  if (Object.keys(extractedFields).length === 0) {
    // If no fields were extracted, return null to fall back to regular processing
    return null;
  }

  // Merge the extracted fields with the original payload
  const mergedPayload = { ...updatedPayload, ...extractedFields };

  // Update the context with the new payload but maintain the missing fields list
  // (it will be updated after the next API call response)
  conversationContext.lastPayload = mergedPayload;

  return mergedPayload;
}

async function extractFieldValuesFromMessage(
  message: string,
  missingFields: string[]
): Promise<Record<string, unknown>> {
  // Use AI to extract field values from natural language
  const formattedExtractionPrompt = extractionPrompt
    .replace("{missingFields}", missingFields.join(", "))
    .replace("{message}", message);

  try {
    const extraction = await groq.chat.completions.create({
      model: MODEL,
      temperature: TEMP_EXTRACTION,
      messages: [
        {
          role: "system",
          content:
            "You extract field values from text and return only valid JSON. For GET requests, recognize common patterns like 'pets available' means status=available. Be smart about extracting values even when parameters aren't explicitly mentioned but are implied by context or adjectives.",
        },
        { role: "user", content: formattedExtractionPrompt },
      ],
    });

    const content = extraction.choices[0]?.message?.content || "{}";

    try {
      // Find JSON object in the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : "{}";

      return JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse extraction response:", e);
      return {};
    }
  } catch (e) {
    console.error("Extraction API call failed:", e);
    return {};
  }
}

async function handleChitchat(message: string, endpoints: ParsedEndpoint[]) {
  const availableEndpoints = endpoints
    .slice(0, 5)
    .map((ep) => `${ep.method} ${ep.path}`)
    .join(", ");
  const formattedChitchatPrompt = chitchatPrompt.replace(
    "{availableEndpoints}",
    availableEndpoints
  );

  const chatResponse = await groq.chat.completions.create({
    model: MODEL,
    temperature: TEMP_CHAT,
    messages: [
      {
        role: "system",
        content: formattedChitchatPrompt,
      },
      { role: "user", content: message },
    ],
  });

  return {
    message: `🤖: ${
      chatResponse.choices[0]?.message?.content || "I'm here to help you with API calls!"
    }`,
  };
}

async function handleHelpQuestion(endpoints: ParsedEndpoint[]) {
  const exampleEndpoints = endpoints.slice(0, 3);
  const exampleRequests = exampleEndpoints
    .map((ep) => `• "${generateExampleRequest(ep)}"`)
    .join("\n");
  const formattedHelpPrompt = helpPrompt.replace("{exampleRequests}", exampleRequests);

  return {
    message: `🤖:${formattedHelpPrompt}`,
  };
}

async function getApiResponse(message: string): Promise<{
  success: boolean;
  data?: { method: string; endpoint: string; payload: Record<string, unknown> };
}> {
  const chat = await groq.chat.completions.create({
    model: MODEL,
    temperature: TEMP_API,
    messages: [
      { role: "system", content: cachedSystemPrompt || "" },
      { role: "user", content: message },
    ],
    tools: cachedTools || [],
    tool_choice: "auto",
  });

  const toolCall = chat.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall || !toolCall.function?.arguments) {
    return { success: false };
  }

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  let args: any;
  try {
    args = JSON.parse(toolCall.function.arguments);
  } catch {
    return { success: false };
  }

  const { method, endpoint, payload: nestedPayload, ...rest } = args;
  const payload = nestedPayload || rest;

  if (!method || !endpoint || !payload) {
    return { success: false };
  }

  return {
    success: true,
    data: { method, endpoint, payload },
  };
}

async function checkMissingQueryParams(
  message: string,
  endpoint: ParsedEndpoint,
  payload: Record<string, unknown>
) {
  const queryParams =
    endpoint.parameters?.filter(
      (param) =>
        "in" in param && param.in === "query" && "required" in param && param.required === true
    ) || [];

  // Check if any required query parameters are missing
  const missingQueryParams: string[] = [];

  for (const param of queryParams) {
    const paramName = "name" in param ? param.name : "";
    if (paramName && !(paramName in payload)) {
      missingQueryParams.push(paramName);
    }
  }

  // If there are no missing params, return early
  if (missingQueryParams.length === 0) {
    return { hasMissingParams: false };
  }

  // Try to extract values from the message text directly
  const extractedFields = await extractFieldValuesFromMessage(message, missingQueryParams);

  // If we found any values, update the payload
  if (Object.keys(extractedFields).length > 0) {
    Object.assign(payload, extractedFields);

    // Recalculate missing params after extraction
    const stillMissingParams = missingQueryParams.filter((param) => !(param in payload));

    // If we still have missing params, ask the user
    if (stillMissingParams.length > 0) {
      conversationContext.lastMethod = endpoint.method;
      conversationContext.lastEndpoint = endpoint.path;
      conversationContext.lastPayload = payload;
      conversationContext.missingFields = stillMissingParams;

      return {
        hasMissingParams: true,
        response: {
          error: `I need query parameters to make this API call. Please provide values for: ${stillMissingParams.join(
            ", "
          )}`,
        },
      };
    }
  } else {
    // No values extracted, ask for all missing params
    conversationContext.lastMethod = endpoint.method;
    conversationContext.lastEndpoint = endpoint.path;
    conversationContext.lastPayload = payload;
    conversationContext.missingFields = missingQueryParams;

    return {
      hasMissingParams: true,
      response: {
        error: `I need query parameters to make this API call. Please provide values for: ${missingQueryParams.join(
          ", "
        )}`,
      },
    };
  }

  return { hasMissingParams: false };
}

function checkMissingRequestBodyFields(
  endpoint: ParsedEndpoint | undefined,
  payload: Record<string, unknown>
) {
  if (!endpoint?.requestBodyExample) {
    return { hasMissingFields: false };
  }

  const missingFields: string[] = [];
  for (const key of Object.keys(endpoint.requestBodyExample)) {
    if (!(key in payload)) {
      missingFields.push(key);
    }
  }

  // If there are missing required fields, ask the user to provide them
  if (missingFields.length > 0) {
    conversationContext.missingFields = missingFields;

    return {
      hasMissingFields: true,
      response: {
        error: `I need more information to make this API call. Please provide values for: ${missingFields.join(
          ", "
        )}`,
      },
    };
  }

  return { hasMissingFields: false };
}

function updateConversationContext(
  method: string,
  endpoint: string,
  payload: Record<string, unknown>
) {
  conversationContext.lastMethod = method;
  conversationContext.lastEndpoint = endpoint;
  conversationContext.lastPayload = payload;
  conversationContext.missingFields = []; // Reset missing fields
}

function resetConversationContext() {
  for (const key of Object.keys(conversationContext)) {
    delete conversationContext[key as keyof ConversationContext];
  }
}

async function handleAPIRequestFailure(message: string, endpoints: ParsedEndpoint[]) {
  const availableEndpoints = endpoints
    .slice(0, 5)
    .map((ep) => `- [${ep.method}] ${ep.path}: ${ep.summary || "No description"}`)
    .join("\n");
  const formattedFailurePrompt = apiRequestFailurePrompt.replace(
    "{availableEndpoints}",
    availableEndpoints
  );

  const response = await groq.chat.completions.create({
    model: MODEL,
    temperature: TEMP_CHAT,
    messages: [
      {
        role: "system",
        content: formattedFailurePrompt,
      },
      { role: "user", content: message },
    ],
  });

  return {
    message: `${
      response.choices[0]?.message?.content ||
      "I couldn't match your request to an available API endpoint. Could you try rephrasing?"
    }`,
  };
}

function initializeAPITools(endpoints: ParsedEndpoint[]) {
  // Categorize endpoints by resource type to help with selection
  const endpointsByResource = categorizeEndpointsByResource(endpoints);

  // Create tool definitions for each endpoint
  cachedTools = createToolsFromEndpoints(endpoints);

  // Create a comprehensive system prompt with categorized endpoints
  cachedSystemPrompt = createSystemPromptWithEndpoints(endpointsByResource);
}

function categorizeEndpointsByResource(
  endpoints: ParsedEndpoint[]
): Record<string, ParsedEndpoint[]> {
  const endpointsByResource: Record<string, ParsedEndpoint[]> = {};

  // Extract resource types from endpoints
  for (const ep of endpoints) {
    const resourceType = getResourceTypeFromPath(ep.path);
    if (!endpointsByResource[resourceType]) {
      endpointsByResource[resourceType] = [];
    }
    endpointsByResource[resourceType].push(ep);
  }

  return endpointsByResource;
}

function createToolsFromEndpoints(endpoints: ParsedEndpoint[]): ChatCompletionTool[] {
  return endpoints.map((ep, index) => {
    let payloadSchema: Record<string, unknown> = { type: "object", properties: {} };
    const required: string[] = [];

    // Process request body schema for POST, PUT, PATCH
    if (ep.requestBodyExample && typeof ep.requestBodyExample === "object") {
      payloadSchema = createRequestBodySchema(ep, required);
    }

    // Process query parameters for GET requests
    if (ep.method === "GET" && ep.parameters?.length) {
      payloadSchema = createQueryParamsSchema(ep, required);
    }

    // Create a clear, descriptive name for the endpoint
    const resourceType = getResourceTypeFromPath(ep.path);
    const action = getActionFromMethod(ep.method);
    const description = ep.summary || `${action} ${resourceType} using ${ep.method} ${ep.path}`;

    return {
      type: "function",
      function: {
        name: `call_endpoint_${index}`,
        description,
        parameters: {
          type: "object",
          properties: {
            method: { type: "string", enum: [ep.method] },
            endpoint: { type: "string", enum: [ep.path] },
            payload: payloadSchema,
          },
          required: ["method", "endpoint", "payload"],
        },
      },
    };
  });
}

function createRequestBodySchema(
  endpoint: ParsedEndpoint,
  required: string[]
): Record<string, unknown> {
  const properties: Record<string, { type: string; description?: string }> = {};

  if (!endpoint.requestBodyExample) {
    return { type: "object", properties: {}, required: [] };
  }

  for (const key of Object.keys(endpoint.requestBodyExample)) {
    const value = endpoint.requestBodyExample[key];
    const type = typeof value;
    properties[key] = {
      type: type === "number" ? "number" : type === "boolean" ? "boolean" : "string",
      description: `The ${key} of the ${getResourceTypeFromPath(endpoint.path)}`,
    };
    required.push(key);
  }

  return {
    type: "object",
    properties,
    required,
    example: endpoint.requestBodyExample,
  };
}

function createQueryParamsSchema(
  endpoint: ParsedEndpoint,
  required: string[]
): Record<string, unknown> {
  const properties: Record<string, { type: string; description?: string }> = {};

  const queryParams = endpoint.parameters?.filter((param) => "in" in param && param.in === "query");

  if (!queryParams || queryParams.length === 0) {
    return { type: "object", properties: {}, required: [] };
  }

  // Process the query parameters
  processQueryParams(queryParams, properties, required, endpoint.path);

  return {
    type: "object",
    properties,
    required,
  };
}

function processQueryParams(
  queryParams: (OpenAPIV3.ParameterObject | OpenAPIV2.ParameterObject)[],
  properties: Record<string, { type: string; description?: string }>,
  required: string[],
  path: string
): void {
  for (const param of queryParams) {
    if (!("name" in param)) continue;

    const paramName = param.name;
    const isRequired = "required" in param && param.required === true;

    // Define parameter type and description
    properties[paramName] = {
      type:
        "schema" in param && param.schema && "type" in param.schema
          ? (param.schema.type as string)
          : "string",
      description:
        "description" in param
          ? param.description
          : `${paramName} parameter for ${getResourceTypeFromPath(path)}`,
    };

    if (isRequired) {
      required.push(paramName);
    }
  }
}

function createSystemPromptWithEndpoints(
  endpointsByResource: Record<string, ParsedEndpoint[]>
): string {
  let resourceSections = "";

  for (const [resource, eps] of Object.entries(endpointsByResource)) {
    resourceSections += `\n### ${resource.toUpperCase()} ENDPOINTS:\n`;
    resourceSections += eps
      .map((ep) => {
        const action = getActionFromMethod(ep.method);
        return `- [${ep.method}] ${ep.path} - ${ep.summary || `${action} ${resource}`}`;
      })
      .join("\n");
    resourceSections += "\n";
  }

  return `${agentSystemPrompt}\n\nAvailable API Endpoints by Resource:${resourceSections}`;
}

// Helper function to extract resource type from path
function getResourceTypeFromPath(path: string): string {
  // Extract meaningful resource name from the path
  // Examples: /pet/findByStatus -> pet, /user/login -> user, /store/inventory -> store
  const segments = path.split("/").filter(Boolean);

  if (segments.length === 0) return "api";

  // First segment is usually the resource type
  const resourceType = segments[0].toLowerCase();

  // Clean up plural forms
  return resourceType.endsWith("s") && !resourceType.endsWith("status")
    ? resourceType.slice(0, -1)
    : resourceType;
}

// Helper function to get a descriptive action from HTTP method
function getActionFromMethod(method: string): string {
  switch (method.toUpperCase()) {
    case "GET":
      return "Get";
    case "POST":
      return "Create";
    case "PUT":
      return "Update";
    case "DELETE":
      return "Delete";
    case "PATCH":
      return "Update";
    default:
      return method;
  }
}

function generateExampleRequest(endpoint: ParsedEndpoint): string {
  const resourceType = getResourceTypeFromPath(endpoint.path);

  switch (endpoint.method.toUpperCase()) {
    case "GET":
      return `Get ${resourceType} information from ${endpoint.path}`;
    case "POST":
      return `Create a new ${resourceType} with specific details`;
    case "PUT":
      return `Update the ${resourceType} with new information`;
    case "DELETE":
      return `Delete the ${resourceType}`;
    default:
      return `Perform a ${endpoint.method} operation on ${endpoint.path}`;
  }
}

/**
 * Reset all cached data when a new API document is loaded
 * This ensures we don't use stale endpoints from a previous API
 */
export function resetApiCache(): void {
  cachedTools = null;
  cachedSystemPrompt = null;
  resetConversationContext();
  console.info("API cache has been reset");
}
