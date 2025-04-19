import { groq } from "@/lib/groqClient";
import { agentSystemPrompt } from "@/prompts/agentPrompt";
import type { ParsedEndpoint } from "@/lib/openapiParser";
import type { ChatCompletionTool } from "groq-sdk/resources/chat.mjs";

let cachedTools: ChatCompletionTool[] | null = null;
let cachedSystemPrompt: string | null = null;
let sessionStarted = false;

export async function resolveUserIntent(
  message: string,
  endpoints: ParsedEndpoint[]
) {
  // Always show welcome message for 'iniciar' message regardless of cache state
  if (message.toLowerCase() === "iniciar" && endpoints.length > 0) {
    const limitedEndpoints = endpoints.slice(0, 10);
    
    // Initialize cache if needed
    if (!cachedTools || !cachedSystemPrompt) {
      const userContext = `You are an API assistant. Choose the best endpoint for the user's intent.
Validate the payload. If fields are missing, say which ones. Never execute incomplete calls.
Always respond in the user's language.`;

      const tools: ChatCompletionTool[] = limitedEndpoints.map((ep, index) => {
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
      cachedSystemPrompt = `${userContext}\n\nEndpoints:\n${limitedEndpoints
        .map((ep) => `- [${ep.method}] ${ep.path}`)
        .join("\n")}`;

      sessionStarted = true;
    }

    return {
      message: `🤖: Sessão iniciada com sucesso! Foram carregados os primeiros ${limitedEndpoints.length} endpoints para análise. Pode me pedir para interagir com sua API. 😄`
    };
  }

  if ((!cachedTools || !cachedSystemPrompt) && endpoints.length > 0) {
    const limitedEndpoints = endpoints.slice(0, 10);
    const userContext = `You are an API assistant. Choose the best endpoint for the user's intent.
Validate the payload. If fields are missing, say which ones. Never execute incomplete calls.
Always respond in the user's language.`;

    const tools: ChatCompletionTool[] = limitedEndpoints.map((ep, index) => {
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
    cachedSystemPrompt = `${userContext}\n\nEndpoints:\n${limitedEndpoints
      .map((ep) => `- [${ep.method}] ${ep.path}`)
      .join("\n")}`;

    sessionStarted = true;

    return {
      message: `🤖: Sessão iniciada com sucesso! Foram carregados os primeiros ${limitedEndpoints.length} endpoints para análise. Pode me pedir para interagir com sua API. 😄`
    };
  }

  const chat = await groq.chat.completions.create({
    model: "llama3-70b-8192",
    temperature: 0.2,
    messages: [
      { role: "system", content: cachedSystemPrompt || "" },
      { role: "user", content: message },
    ],
    tools: cachedTools || [],
    tool_choice: "auto",
  });

  const toolCall = chat.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall || !toolCall.function?.arguments) {
    const fallbackMessage = chat.choices[0]?.message?.content;
    return fallbackMessage
      ? { error: fallbackMessage }
      : { error: "Não foi possível entender a intenção do usuário." };
  }

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  let args: any;
  try {
    args = JSON.parse(toolCall.function.arguments);
  } catch {
    return { error: "A resposta da IA não continha argumentos válidos." };
  }

  const { method, endpoint, payload: nestedPayload, ...rest } = args;
  const payload = nestedPayload || rest;

  if (!method || !endpoint || !payload) {
    return {
      error: "A IA não conseguiu definir corretamente o método, endpoint ou payload. Por favor, tente novamente com mais contexto."
    };
  }

  const matchedEndpoint = endpoints.find(
    (ep) => ep.method === method && ep.path === endpoint
  );

  const missingFields: string[] = [];
  if (matchedEndpoint?.requestBodyExample) {
    for (const key of Object.keys(matchedEndpoint.requestBodyExample)) {
      if (!(key in payload)) {
        missingFields.push(key);
      }
    }
  }

  if (missingFields.length > 0) {
    const fieldList = missingFields.map(f => `"${f}"`).join(", ");
    const readableList = missingFields.join(", ");
    return {
      error: `❌ Para completar essa ação, você precisa fornecer os campos obrigatórios: ${readableList}. Por favor, envie esses dados para continuar.`,
      method,
      endpoint,
      payload,
      missing: missingFields
    };
  }

  return {
    method,
    endpoint,
    payload,
  };
}
