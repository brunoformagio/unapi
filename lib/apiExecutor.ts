export async function executeApiCall(
  method: string,
  endpoint: string,
  baseUrl: string,
  payload: Record<string, unknown>,
  apiKey: string
): Promise<{
  status: number;
  statusText: string;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  response: any;
}> {
  // Check if baseUrl is valid
  if (!baseUrl) {
    return createErrorResponse(
      400,
      "Bad Request",
      "❌ Missing Base URL. Please add your API's base URL in the configuration above."
    );
  }

  const url = buildRequestUrl(baseUrl, endpoint, method, payload);
  const options = buildRequestOptions(method, payload, apiKey);

  try {
    return await performRequest(url, options);
  } catch (error) {
    // Handle network or other errors
    return createErrorResponse(
      500,
      "Request Failed",
      `❌ Error executing API call: ${
        error instanceof Error ? error.message : "Unknown error"
      }. Check your Base URL and connection.`
    );
  }
}

function buildRequestUrl(
  baseUrl: string,
  endpoint: string,
  method: string,
  payload: Record<string, unknown>
): string {
  // Normalize the baseUrl and endpoint to ensure proper joining
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint.substring(1) : endpoint;

  let url = `${normalizedBaseUrl}${normalizedEndpoint}`;

  // Handle query parameters for GET requests
  if (method === "GET" && Object.keys(payload).length > 0) {
    url = appendQueryParams(url, payload);
  }

  return url;
}

function appendQueryParams(url: string, payload: Record<string, unknown>): string {
  const queryParams = new URLSearchParams();

  // Add each payload property as a query parameter
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined && value !== null) {
      queryParams.append(key, String(value));
    }
  }

  const queryString = queryParams.toString();
  if (queryString) {
    // Add query string to URL, handling existing query parameters
    return url + (url.includes("?") ? `&${queryString}` : `?${queryString}`);
  }

  return url;
}

function buildRequestOptions(
  method: string,
  payload: Record<string, unknown>,
  apiKey: string
): RequestInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const options: RequestInit = {
    method,
    headers,
  };

  if (["POST", "PUT", "PATCH"].includes(method)) {
    options.body = JSON.stringify(payload);
  }

  return options;
}

async function performRequest(
  url: string,
  options: RequestInit
): Promise<{
  status: number;
  statusText: string;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  response: any;
}> {
  const res = await fetch(url, options);

  // Handle empty responses
  if (isEmptyResponse(res)) {
    return createSuccessResponse(res);
  }

  // Try to parse the response
  const responseBody = await parseResponseBody(res);

  // Handle HTTP errors with friendly messages
  if (!res.ok) {
    return handleErrorResponse(res, responseBody, url, options.method as string);
  }

  return {
    status: res.status,
    statusText: res.statusText,
    response: responseBody,
  };
}

function isEmptyResponse(res: Response): boolean {
  const contentLength = res.headers.get("content-length");
  return contentLength === "0" || res.status === 204;
}

function createSuccessResponse(res: Response): {
  status: number;
  statusText: string;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  response: any;
} {
  return {
    status: res.status,
    statusText: res.statusText,
    response: "✅ Request successful. No content returned from server.",
  };
}

function createErrorResponse(
  status: number,
  statusText: string,
  message: string
): {
  status: number;
  statusText: string;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  response: any;
} {
  return {
    status,
    statusText,
    response: message,
  };
}

async function parseResponseBody(res: Response): Promise<unknown> {
  try {
    // Try to get the text first
    const text = await res.text();

    // If it's HTML content (error page), return null
    if (text.includes("<!DOCTYPE html>") || text.includes("<html")) {
      return null;
    }

    const contentType = res.headers.get("content-type") || "";

    // Try to parse as JSON if it looks like JSON
    if (
      contentType.includes("application/json") ||
      (text.startsWith("{") && text.endsWith("}")) ||
      (text.startsWith("[") && text.endsWith("]"))
    ) {
      try {
        return text ? JSON.parse(text) : null;
      } catch {
        // If it fails to parse but looks like JSON, just return the text
        return text;
      }
    }

    // Not JSON, return as text
    return text;
  } catch (error) {
    // Handle parse errors
    throw new Error(
      `Response could not be processed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

function handleErrorResponse(
  res: Response,
  responseBody: unknown,
  url: string,
  method: string
): {
  status: number;
  statusText: string;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  response: any;
} {
  // Special handling for validation errors (422)
  if (res.status === 422 && responseBody) {
    return handleValidationError(
      res.status,
      res.statusText,
      responseBody as Record<string, unknown>,
      new URL(url).pathname
    );
  }

  return {
    status: res.status,
    statusText: res.statusText,
    response: getHumanFriendlyErrorMessage(res.status, url, method),
  };
}

// Helper function to specifically handle validation errors
function handleValidationError(
  status: number,
  statusText: string,
  responseBody: Record<string, unknown>,
  endpoint: string
): {
  status: number;
  statusText: string;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  response: any;
} {
  try {
    const { missingFields, invalidFields } = extractValidationErrors(responseBody);

    // Generate a natural, helpful response
    if (missingFields.length > 0 || invalidFields.length > 0) {
      return {
        status,
        statusText,
        response: formatValidationErrorMessage(missingFields, invalidFields, endpoint),
      };
    }
  } catch (error) {
    // If error analysis fails, fall back to generic message
    console.error("Error analyzing validation error:", error);
  }

  // Fallback to generic validation error message
  return {
    status,
    statusText,
    response:
      "I couldn't process your request because some required information is missing. Please provide more details about what you want to create.",
  };
}

function extractValidationErrors(responseBody: Record<string, unknown>): {
  missingFields: string[];
  invalidFields: string[];
} {
  const missingFields: string[] = [];
  const invalidFields: string[] = [];

  // Handle FastAPI style validation errors
  if (responseBody?.detail && Array.isArray(responseBody.detail)) {
    processDetailErrors(responseBody.detail, missingFields, invalidFields);
  }
  // Handle Django/DRF style validation errors
  else if (responseBody && typeof responseBody === "object") {
    processDjangoStyleErrors(responseBody, missingFields, invalidFields);

    // Try to detect missing required fields if none found yet
    if (missingFields.length === 0 && invalidFields.length === 0) {
      detectCommonRequiredFields(responseBody, missingFields);
    }
  }

  return { missingFields, invalidFields };
}

function processDetailErrors(
  details: unknown[],
  missingFields: string[],
  invalidFields: string[]
): void {
  for (const error of details) {
    processDetailError(error, missingFields, invalidFields);
  }
}

function processDetailError(
  error: unknown,
  missingFields: string[],
  invalidFields: string[]
): void {
  if (!isValidErrorObject(error)) return;

  const errorObj = error as Record<string, unknown>;
  const loc = errorObj.loc;

  if (!Array.isArray(loc) || loc.length === 0) return;

  const fieldName = loc[loc.length - 1];
  const msg = typeof errorObj.msg === "string" ? errorObj.msg : "";

  if (msg.toLowerCase().includes("required") && fieldName) {
    missingFields.push(String(fieldName));
  } else if (fieldName) {
    invalidFields.push(`${fieldName} (${msg || "invalid"})`);
  }
}

function isValidErrorObject(error: unknown): boolean {
  return typeof error === "object" && error !== null;
}

function processDjangoStyleErrors(
  responseBody: Record<string, unknown>,
  missingFields: string[],
  invalidFields: string[]
): void {
  for (const key of Object.keys(responseBody)) {
    const value = responseBody[key];
    if (Array.isArray(value) && value.length > 0) {
      const errorMsg = value[0];
      if (typeof errorMsg === "string") {
        if (
          errorMsg.toLowerCase().includes("required") ||
          errorMsg.toLowerCase().includes("this field")
        ) {
          missingFields.push(key);
        } else {
          invalidFields.push(`${key} (${errorMsg})`);
        }
      }
    }
  }
}

function detectCommonRequiredFields(
  responseBody: Record<string, unknown>,
  missingFields: string[]
): void {
  const commonRequiredFields = getCommonRequiredFields();
  const payloadKeys = Object.keys(responseBody);
  const messageParts = JSON.stringify(responseBody).toLowerCase();

  for (const field of commonRequiredFields) {
    if (shouldAddAsMissingField(field, messageParts, payloadKeys)) {
      missingFields.push(field);
    }
  }
}

function getCommonRequiredFields(): string[] {
  return [
    "name",
    "username",
    "full_name",
    "firstName",
    "lastName",
    "email",
    "phone",
    "address",
    "password",
    "confirm_password",
    "title",
    "description",
    "content",
    "price",
    "quantity",
  ];
}

function shouldAddAsMissingField(
  field: string,
  messageParts: string,
  payloadKeys: string[]
): boolean {
  return (
    messageParts.includes(field.toLowerCase()) &&
    messageParts.includes("required") &&
    !payloadKeys.includes(field)
  );
}

function formatValidationErrorMessage(
  missingFields: string[],
  invalidFields: string[],
  endpoint: string
): string {
  const resourceType = getResourceTypeFromEndpoint(endpoint);
  let message = `I tried to create a ${resourceType} for you, but the API couldn't process the request due to some validation issues.\n\n`;

  if (missingFields.length > 0) {
    message += `To create a ${resourceType}, you also need to provide these required fields: **${missingFields.join(
      ", "
    )}**.\n\n`;
  }

  if (invalidFields.length > 0) {
    message += `Additionally, there were issues with these fields: ${invalidFields.join(
      ", "
    )}.\n\n`;
  }

  message += "Could you please provide the missing information so I can complete your request?";

  return message;
}

// Helper function to get resource type from endpoint path
function getResourceTypeFromEndpoint(endpoint: string): string {
  // Extract the resource name from the endpoint (e.g., /api/user/ -> user)
  const parts = endpoint.split("/").filter(Boolean);
  const resource = parts[parts.length - 1] || parts[parts.length - 2] || "";

  // Convert to singular form if plural
  return resource.endsWith("s") ? resource.slice(0, -1) : resource;
}

// Helper function to provide human-friendly error messages
function getHumanFriendlyErrorMessage(statusCode: number, url: string, method: string): string {
  // Extract domain from URL for better error messages
  const urlObj = new URL(url);
  const domain = urlObj.hostname;
  const path = urlObj.pathname;

  switch (statusCode) {
    case 400:
      return "❌ Bad Request (400): The server couldn't understand your request. This usually happens when the data sent is incorrect or malformed. Check your request payload.";

    case 401:
      return "❌ Unauthorized (401): Authentication failed. You need to provide a valid API key or token. Please check your Bearer Token in the configuration.";

    case 403:
      return "❌ Forbidden (403): You don't have permission to access this resource. Your API key might not have the required permissions.";

    case 404:
      return `❌ Not Found (404): The endpoint ${path} doesn't exist on ${domain}. 
      
Possible solutions:
• Check if your Base URL is correct
• Make sure the API endpoint path is correct
• Verify that the API is properly deployed and running`;

    case 405:
      return `❌ Method Not Allowed (405): The ${method} method is not supported for this endpoint. Try a different HTTP method.`;

    case 408:
      return "❌ Request Timeout (408): The request took too long to complete. Try again or check if the server is overloaded.";

    case 409:
      return "❌ Conflict (409): The request couldn't be completed due to a conflict with the current state of the resource. For example, you might be trying to create something that already exists.";

    case 422:
      return "❌ Unprocessable Entity (422): The server understood your request but couldn't process it. This usually happens when validation fails.";

    case 429:
      return "❌ Too Many Requests (429): You've sent too many requests in a short period. Please wait before trying again.";

    case 500:
      return "❌ Internal Server Error (500): Something went wrong on the server. This is not your fault, but the server's issue. Try again later or contact the API provider.";

    case 502:
      return "❌ Bad Gateway (502): The server received an invalid response from an upstream server. This could be a temporary issue.";

    case 503:
      return "❌ Service Unavailable (503): The server is temporarily unavailable, usually due to maintenance or overload. Try again later.";

    case 504:
      return "❌ Gateway Timeout (504): The server took too long to respond. This could be due to network issues or server overload.";

    default:
      return `❌ Error (${statusCode}): The request failed. Check your API configuration and try again.`;
  }
}
