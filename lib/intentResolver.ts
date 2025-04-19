import { groq } from "@/lib/groqClient";
import { 
  agentSystemPrompt, 
  intentClassificationPrompt, 
  extractionPrompt,
  chitchatPrompt,
  helpPrompt,
  apiRequestFailurePrompt,
  welcomeMessages
} from "../prompts/agentPrompt";
import type { ParsedEndpoint } from "@/lib/openapiParser";
import type { ChatCompletionTool } from "groq-sdk/resources/chat.mjs";

// Environment variables for model and temperature settings
const MODEL = process.env.UNAPI_MODEL || "llama3-70b-8192";
const TEMP_CLASSIFICATION = Number.parseFloat(process.env.UNAPI_TEMP_CLASSIFICATION || "0.1");
const TEMP_EXTRACTION = Number.parseFloat(process.env.UNAPI_TEMP_EXTRACTION || "0.1");
const TEMP_CHAT = Number.parseFloat(process.env.UNAPI_TEMP_CHAT || "0.7");
const TEMP_API = Number.parseFloat(process.env.UNAPI_TEMP_API || "0.2");

let cachedTools: ChatCompletionTool[] | null = null;
let cachedSystemPrompt: string | null = null;
let sessionStarted = false;

// Store context from previous interactions to maintain state
interface ConversationContext {
  lastEndpoint?: string;
  lastMethod?: string;
  lastPayload?: Record<string, unknown>;
  missingFields?: string[];
}

// Global conversation context
const conversationContext: ConversationContext = {};

// Check if a message is a simple greeting
function isGreeting(message: string): boolean {
  const greetings = [
    // English greetings
    "hi", "hello", "hey", "greetings", "howdy", "hola", 
    // Portuguese greetings
    "oi", "olá", "e aí", "tudo bem", "bom dia", "boa tarde", "boa noite"
  ];
  const normalizedMessage = message.toLowerCase().trim();
  
  // Check if the message is in the greetings list
  if (greetings.includes(normalizedMessage)) {
    return true;
  }
  
  // Check if the message starts with a greeting
  return greetings.some(greeting => normalizedMessage.startsWith(greeting));
}

export async function resolveUserIntent(
  message: string,
  endpoints: ParsedEndpoint[]
) {
  // Always show welcome message for 'start' message regardless of cache state
  if (message.toLowerCase() === "start" && endpoints.length > 0) {
    const limitedEndpoints = endpoints.slice(0, 10);
    
    // Initialize cache if needed
    if (!cachedTools || !cachedSystemPrompt) {
      initializeAPITools(limitedEndpoints);
    }

    // Reset conversation context when starting a new session
    resetConversationContext();

    return {
      message: 
      endpoints.length > 10
      ? welcomeMessages.limited.replace("{totalEndpoints}", String(endpoints.length))
                            .replace("{limitedEndpoints}", String(limitedEndpoints.length))
      : welcomeMessages.standard.replace("{endpointCount}", String(limitedEndpoints.length))
    };
  }

  // Handle case when no endpoints are available
  if (endpoints.length === 0) {
    return {
      message: welcomeMessages.noEndpoints
    };
  }

  // Initialize cache if needed
  if (!cachedTools || !cachedSystemPrompt) {
    const limitedEndpoints = endpoints.slice(0, 10);
    initializeAPITools(limitedEndpoints);
  }

  // Check if the message appears to be providing missing fields
  if (conversationContext.lastEndpoint && 
      conversationContext.missingFields && 
      conversationContext.missingFields.length > 0) {
    const updatedPayload = await handleMissingFieldResponse(message, conversationContext);
    if (updatedPayload) {
      return {
        method: conversationContext.lastMethod || "GET",
        endpoint: conversationContext.lastEndpoint,
        payload: updatedPayload
      };
    }
  }

  // First, determine if the message is a conversational message or an API request
  const intentClassification = await groq.chat.completions.create({
    model: MODEL,
    temperature: TEMP_CLASSIFICATION,
    messages: [
      { 
        role: "system", 
        content: intentClassificationPrompt
      },
      { role: "user", content: message }
    ],
    max_tokens: 10,
  });

  const classification = intentClassification.choices[0]?.message?.content?.trim().toLowerCase() || "";

  // If it's a casual conversation, respond naturally but guide back to API functionality
  if (classification === "chitchat") {
    return handleChitchat(message, endpoints);
  }
  
  // If it's a help question, provide guidance
  if (classification === "help_question") {
    return handleHelpQuestion(endpoints);
  }

  // Otherwise, treat as an API request
  return handleAPIRequest(message, endpoints);
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
        { role: "system", content: "You extract field values from text and return only valid JSON." },
        { role: "user", content: formattedExtractionPrompt }
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
  const availableEndpoints = endpoints.slice(0, 5).map(ep => `${ep.method} ${ep.path}`).join(", ");
  const formattedChitchatPrompt = chitchatPrompt.replace("{availableEndpoints}", availableEndpoints);

  const chatResponse = await groq.chat.completions.create({
    model: MODEL,
    temperature: TEMP_CHAT,
    messages: [
      { 
        role: "system", 
        content: formattedChitchatPrompt
      },
      { role: "user", content: message }
    ],
  });

  return {
    message: `🤖: ${chatResponse.choices[0]?.message?.content || "I'm here to help you with API calls!"}`
  };
}

async function handleHelpQuestion(endpoints: ParsedEndpoint[]) {
  const exampleEndpoints = endpoints.slice(0, 3);
  const exampleRequests = exampleEndpoints.map(ep => `• "${generateExampleRequest(ep)}"`).join("\n");
  const formattedHelpPrompt = helpPrompt.replace("{exampleRequests}", exampleRequests);
  
  return {
    message: `🤖:${formattedHelpPrompt}`
  };
}

async function handleAPIRequest(message: string, endpoints: ParsedEndpoint[]) {
  if (!cachedTools || !cachedSystemPrompt) {
    const limitedEndpoints = endpoints.slice(0, 10);
    initializeAPITools(limitedEndpoints);
  }

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
    // If AI couldn't map to an endpoint, respond conversationally with guidance
    return await handleAPIRequestFailure(message, endpoints);
  }

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  let args: any;
  try {
    args = JSON.parse(toolCall.function.arguments);
  } catch {
    return await handleAPIRequestFailure(message, endpoints);
  }

  const { method, endpoint, payload: nestedPayload, ...rest } = args;
  const payload = nestedPayload || rest;

  if (!method || !endpoint || !payload) {
    return await handleAPIRequestFailure(message, endpoints);
  }

  const matchedEndpoint = endpoints.find(
    (ep) => ep.method === method && ep.path === endpoint
  );

  // Update conversation context with current request
  updateConversationContext(method, endpoint, payload);

  const missingFields: string[] = [];
  if (matchedEndpoint?.requestBodyExample) {
    for (const key of Object.keys(matchedEndpoint.requestBodyExample)) {
      if (!(key in payload)) {
        missingFields.push(key);
      }
    }
  }

  // If there are missing required fields, ask the user to provide them
  if (missingFields.length > 0) {
    conversationContext.missingFields = missingFields;
    
    return {
      error: `I need more information to make this API call. Please provide values for: ${missingFields.join(", ")}`
    };
  }

  return {
    method,
    endpoint,
    payload,
  };
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
  const availableEndpoints = endpoints.slice(0, 5).map(ep => `- [${ep.method}] ${ep.path}: ${ep.summary || "No description"}`).join("\n");
  const formattedFailurePrompt = apiRequestFailurePrompt.replace("{availableEndpoints}", availableEndpoints);

  const response = await groq.chat.completions.create({
    model: MODEL,
    temperature: TEMP_CHAT,
    messages: [
      { 
        role: "system", 
        content: formattedFailurePrompt
      },
      { role: "user", content: message }
    ],
  });

  return {
    message: `${response.choices[0]?.message?.content || "I couldn't match your request to an available API endpoint. Could you try rephrasing?"}`
  };
}

function initializeAPITools(endpoints: ParsedEndpoint[]) {
  const tools: ChatCompletionTool[] = endpoints.map((ep, index) => {
    let payloadSchema: Record<string, unknown> = { type: "object", properties: {} };
    const required: string[] = [];

    if (ep.requestBodyExample && typeof ep.requestBodyExample === "object") {
      const properties: Record<string, { type: string }> = {};
      for (const key of Object.keys(ep.requestBodyExample)) {
        const value = ep.requestBodyExample[key];
        const type = typeof value;
        properties[key] = {
          type:
            type === "number"
              ? "number"
              : type === "boolean"
              ? "boolean"
              : "string",
        };
        required.push(key);
      }
      payloadSchema = {
        type: "object",
        properties,
        required,
        example: ep.requestBodyExample,
      };
    }

    return {
      type: "function",
      function: {
        name: `call_endpoint_${index}`,
        description: ep.summary || `${ep.method} ${ep.path}`,
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

  cachedTools = tools;
  cachedSystemPrompt = `${agentSystemPrompt}\n\nEndpoints:\n${endpoints
    .map((ep) => `- [${ep.method}] ${ep.path}`)
    .join("\n")}`;

  sessionStarted = true;
}

function generateExampleRequest(endpoint: ParsedEndpoint): string {
  switch (endpoint.method.toUpperCase()) {
    case "GET":
      return `Get information from ${endpoint.path}`;
    case "POST":
      return `Create a new ${endpoint.path.split("/").pop()} with specific details`;
    case "PUT":
      return `Update the ${endpoint.path.split("/").pop()} with new information`;
    case "DELETE":
      return `Delete the ${endpoint.path.split("/").pop()}`;
    default:
      return `Perform a ${endpoint.method} operation on ${endpoint.path}`;
  }
}
