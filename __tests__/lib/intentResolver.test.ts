/* eslint-disable */
// @ts-nocheck
import { groq } from "@/lib/groqClient";
import { resetApiCache, resolveUserIntent } from "@/lib/intentResolver";
import type { ParsedEndpoint } from "@/lib/openapiParser";
import { type MockInstance, beforeEach, describe, expect, it, vi } from "vitest";

// Mock groq API
vi.mock("@/lib/groqClient", () => ({
  groq: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
}));

describe("intentResolver", () => {
  const mockEndpoints: ParsedEndpoint[] = [
    {
      method: "GET",
      path: "/api/pets",
      summary: "List all pets",
      parameters: [],
    },
    {
      method: "POST",
      path: "/api/pets",
      summary: "Create a pet",
      requestBodyExample: { name: "fluffy", type: "cat", age: 3 },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    resetApiCache();
  });

  describe("resolveUserIntent", () => {
    it("should return welcome message for start command", async () => {
      const result = await resolveUserIntent("start", mockEndpoints);

      expect(result).toHaveProperty("message");
      expect(result.message).toContain("Welcome to Unapi");
      expect(result.message).toContain("2 endpoints");
    });

    it("should return noEndpoints message when no endpoints are available", async () => {
      const result = await resolveUserIntent("start", []);

      expect(result).toHaveProperty("message");
      expect(result.message).toContain("Please upload your API documentation");
    });

    it("should classify message as chitchat and respond accordingly", async () => {
      // Mock the classification response
      const mockClassification = {
        choices: [
          {
            message: {
              content: "chitchat",
            },
          },
        ],
      };

      const mockChatResponse = {
        choices: [
          {
            message: {
              content: "I'm just a friendly API assistant!",
            },
          },
        ],
      };

      (groq.chat.completions.create as MockInstance)
        .mockResolvedValueOnce(mockClassification)
        .mockResolvedValueOnce(mockChatResponse);

      const result = await resolveUserIntent("How are you today?", mockEndpoints);

      expect(result).toHaveProperty("message");
      expect(result.message).toContain("I'm just a friendly API assistant!");
    });

    it("should handle API requests and map to correct endpoint", async () => {
      // Mock the classification response
      const mockClassification = {
        choices: [
          {
            message: {
              content: "api_request",
            },
          },
        ],
      };

      // Mock the tool call response
      const mockToolCall = {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  function: {
                    arguments: JSON.stringify({
                      method: "GET",
                      endpoint: "/api/pets",
                      payload: { limit: 10 },
                    }),
                  },
                },
              ],
            },
          },
        ],
      };

      (groq.chat.completions.create as MockInstance)
        .mockResolvedValueOnce(mockClassification)
        .mockResolvedValueOnce(mockToolCall);

      const result = await resolveUserIntent("Get all pets with a limit of 10", mockEndpoints);

      expect(result).toHaveProperty("method");
      expect(result).toHaveProperty("endpoint");
      expect(result).toHaveProperty("payload");
      expect(result.method).toBe("GET");
      expect(result.endpoint).toBe("/api/pets");
      expect(result.payload).toEqual({ limit: 10 });
    });

    it("should detect missing fields in request body and ask for them", async () => {
      // Mock the classification response
      const mockClassification = {
        choices: [
          {
            message: {
              content: "api_request",
            },
          },
        ],
      };

      // Mock the tool call response with incomplete payload
      const mockToolCall = {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  function: {
                    arguments: JSON.stringify({
                      method: "POST",
                      endpoint: "/api/pets",
                      payload: { name: "fluffy" }, // Missing type and age
                    }),
                  },
                },
              ],
            },
          },
        ],
      };

      (groq.chat.completions.create as MockInstance)
        .mockResolvedValueOnce(mockClassification)
        .mockResolvedValueOnce(mockToolCall);

      const result = await resolveUserIntent("Create a pet named fluffy", mockEndpoints);

      expect(result).toHaveProperty("error");
      expect(result.error).toContain("I need more information");
      // Should list the missing fields
      expect(result.error).toContain("type");
      expect(result.error).toContain("age");
    });
  });
});
