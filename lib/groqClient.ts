import { Groq } from "groq-sdk";

// We only use the API key server-side for security
// Client-side will use our API route instead
const apiKey = typeof window === "undefined" ? process.env.GROQ_API_KEY : undefined;

if (!apiKey && typeof window === "undefined") {
  console.warn("GROQ_API_KEY not found. Make sure to set it in your environment variables.");
}

export const groq = new Groq({
  apiKey: apiKey || "dummy-key-for-client",
  dangerouslyAllowBrowser: true,
});

// Helper for client-side usage
export const callGroqApi = async (
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  messages: any,
  model?: string,
  temperature?: number
) => {
  if (typeof window === "undefined") {
    // Server-side: Use the SDK directly
    return groq.chat.completions.create({
      messages,
      model: model || process.env.UNAPI_MODEL || "llama3-70b-8192",
      temperature: temperature || 0.7,
    });
  }

  // Client-side: Use our API route
  const response = await fetch("/api/groq", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages, model, temperature }),
  });

  if (!response.ok) {
    throw new Error("Failed to call Groq API");
  }

  return response.json();
};
