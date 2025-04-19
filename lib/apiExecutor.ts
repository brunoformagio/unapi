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
    return {
      status: 400,
      statusText: "Bad Request",
      response: "❌ Missing Base URL. Please add your API's base URL in the configuration above."
    };
  }

  // Normalize the baseUrl and endpoint to ensure proper joining
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
  
  const url = `${normalizedBaseUrl}${normalizedEndpoint}`;
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

  try {
    const res = await fetch(url, options);

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    let responseBody: any = null;
    
    // Check if response has content before trying to parse it
    const contentType = res.headers.get("content-type") || "";
    const contentLength = res.headers.get("content-length");
    
    // Handle empty responses
    if (contentLength === "0" || res.status === 204) {
      return {
        status: res.status,
        statusText: res.statusText,
        response: "✅ Request successful. No content returned from server.",
      };
    }
    
    try {
      // Try to get the text first
      const text = await res.text();
      
      // If it's HTML content (error page), provide a more helpful message
      if (text.includes("<!DOCTYPE html>") || text.includes("<html")) {
        return {
          status: res.status,
          statusText: res.statusText,
          response: getHumanFriendlyErrorMessage(res.status, url, method),
        };
      }
      
      // Try to parse as JSON if it looks like JSON
      if (contentType.includes("application/json") || 
          (text.startsWith("{") && text.endsWith("}")) || 
          (text.startsWith("[") && text.endsWith("]"))) {
        try {
          responseBody = text ? JSON.parse(text) : null;
        } catch {
          // If it fails to parse but looks like JSON, just return the text
          responseBody = text;
        }
      } else {
        // Not JSON, return as text
        responseBody = text;
      }
    } catch (error) {
      // Handle parse errors
      return {
        status: res.status,
        statusText: res.statusText,
        response: `❌ Response could not be processed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }

    // Handle HTTP errors with friendly messages
    if (!res.ok) {
      // Special handling for validation errors (422)
      if (res.status === 422) {
        return handleValidationError(res.status, res.statusText, responseBody, endpoint);
      }
      
      return {
        status: res.status,
        statusText: res.statusText,
        response: getHumanFriendlyErrorMessage(res.status, url, method, responseBody),
      };
    }

    return {
      status: res.status,
      statusText: res.statusText,
      response: responseBody,
    };
  } catch (error) {
    // Handle network or other errors
    return {
      status: 500,
      statusText: "Request Failed",
      response: `❌ Error executing API call: ${error instanceof Error ? error.message : "Unknown error"}. Check your Base URL and connection.`,
    };
  }
}

// Helper function to specifically handle validation errors
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
function handleValidationError(status: number, statusText: string, responseBody: any, endpoint: string): {
  status: number;
  statusText: string;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  response: any;
} {
  // Common field names that might be required in APIs
  const commonRequiredFields = [
    "name", "username", "full_name", "firstName", "lastName", 
    "email", "phone", "address", "password", "confirm_password",
    "title", "description", "content", "price", "quantity"
  ];

  try {
    const missingFields: string[] = [];
    const invalidFields: string[] = [];

    // Handle FastAPI style validation errors
    if (responseBody?.detail && Array.isArray(responseBody.detail)) {
      for (const error of responseBody.detail) {
        if (typeof error === "object") {
          // Extract field name from the location path
          const fieldName = error.loc?.[error.loc.length - 1];
          
          if (error.msg?.toLowerCase().includes("required") && fieldName) {
            missingFields.push(fieldName);
          } else if (fieldName) {
            invalidFields.push(`${fieldName} (${error.msg || "invalid"})`);
          }
        }
      }
    } 
    // Handle Django/DRF style validation errors
    else if (responseBody && typeof responseBody === "object") {
      for (const key of Object.keys(responseBody)) {
        if (Array.isArray(responseBody[key])) {
          const errorMsg = responseBody[key][0];
          if (typeof errorMsg === "string") {
            if (errorMsg.toLowerCase().includes("required") || 
                errorMsg.toLowerCase().includes("this field")) {
              missingFields.push(key);
            } else {
              invalidFields.push(`${key} (${errorMsg})`);
            }
          }
        }
      }

      // Try to detect missing required fields based on common patterns
      if (missingFields.length === 0 && invalidFields.length === 0) {
        // If no validation errors detected, check for common required fields
        const payloadKeys = Object.keys(responseBody);
        for (const field of commonRequiredFields) {
          // Check if common field is mentioned in the error message
          const messageParts = JSON.stringify(responseBody).toLowerCase();
          if (messageParts.includes(field.toLowerCase()) && 
              messageParts.includes("required") && 
              !payloadKeys.includes(field)) {
            missingFields.push(field);
          }
        }
      }
    }

    // Generate a natural, helpful response
    if (missingFields.length > 0 || invalidFields.length > 0) {
      const resourceType = getResourceTypeFromEndpoint(endpoint);
      let message = `I tried to create a ${resourceType} for you, but the API couldn't process the request due to some validation issues.\n\n`;
      
      if (missingFields.length > 0) {
        message += `To create a ${resourceType}, you also need to provide these required fields: **${missingFields.join(", ")}**.\n\n`;
      }
      
      if (invalidFields.length > 0) {
        message += `Additionally, there were issues with these fields: ${invalidFields.join(", ")}.\n\n`;
      }
      
      message += "Could you please provide the missing information so I can complete your request?";
      
      return {
        status,
        statusText,
        response: message
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
    response: "I couldn't process your request because some required information is missing. Please provide more details about what you want to create."
  };
}

// Helper function to get resource type from endpoint path
function getResourceTypeFromEndpoint(endpoint: string): string {
  // Extract the resource name from the endpoint (e.g., /api/user/ -> user)
  const parts = endpoint.split('/').filter(Boolean);
  const resource = parts[parts.length - 1] || parts[parts.length - 2] || "";
  
  // Convert to singular form if plural
  return resource.endsWith('s') ? resource.slice(0, -1) : resource;
}

// Helper function to provide human-friendly error messages
function getHumanFriendlyErrorMessage(
  statusCode: number, 
  url: string, 
  method: string,
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  responseBody?: any
): string {
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
