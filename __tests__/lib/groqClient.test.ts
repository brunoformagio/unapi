import { callGroqApi, groq } from "@/lib/groqClient";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Mock console.warn before importing the module
const originalConsoleWarn = console.warn;
console.warn = vi.fn();

// Mock the Groq SDK
vi.mock("groq-sdk", () => {
  return {
    Groq: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: "Test response" } }],
          }),
        },
      },
    })),
  };
});

// Mock the fetch function for client-side tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("groqClient", () => {
  // Save original environment and window
  const originalEnv = { ...process.env };
  const originalWindow = global.window;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Set up default environment variables
    process.env.GROQ_API_KEY = "test-api-key";
    process.env.UNAPI_MODEL = "test-model";

    // Setup mock fetch response
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: "Client side response" } }],
      }),
    });
  });

  afterEach(() => {
    // Reset environment
    process.env = { ...originalEnv };

    // Reset window
    if (originalWindow === undefined) {
      // If it was originally undefined, set to undefined
      global.window = undefined as unknown as Window & typeof globalThis;
    } else {
      global.window = originalWindow;
    }
  });

  // Restore console.warn after all tests
  afterAll(() => {
    console.warn = originalConsoleWarn;
  });

  describe("callGroqApi", () => {
    it("should use the Groq SDK directly in server environment", async () => {
      // Ensure window is undefined to simulate server-side
      global.window = undefined as unknown as Window & typeof globalThis;

      const messages = [{ role: "user", content: "Hello" }];

      await callGroqApi(messages);

      // Check if the SDK was called with correct parameters
      expect(groq.chat.completions.create).toHaveBeenCalledWith({
        messages,
        model: "test-model",
        temperature: 0.7,
      });
    });

    it("should use the API route in client environment", async () => {
      // Define window to simulate client-side
      global.window = {} as Window & typeof globalThis;

      const messages = [{ role: "user", content: "Hello client" }];

      await callGroqApi(messages);

      // Check if fetch was called with correct parameters
      expect(mockFetch).toHaveBeenCalledWith("/api/groq", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages, model: undefined, temperature: undefined }),
      });
    });

    it("should use custom model and temperature when provided", async () => {
      // Ensure window is undefined to simulate server-side
      global.window = undefined as unknown as Window & typeof globalThis;

      const messages = [{ role: "user", content: "Hello" }];
      const customModel = "custom-model";
      const customTemperature = 0.5;

      await callGroqApi(messages, customModel, customTemperature);

      // Check if the SDK was called with custom parameters
      expect(groq.chat.completions.create).toHaveBeenCalledWith({
        messages,
        model: customModel,
        temperature: customTemperature,
      });
    });

    it("should throw an error when client-side fetch fails", async () => {
      // Define window to simulate client-side
      global.window = {} as Window & typeof globalThis;

      // Mock fetch to fail
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const messages = [{ role: "user", content: "Hello" }];

      // Call should throw
      await expect(callGroqApi(messages)).rejects.toThrow("Failed to call Groq API");
    });

    it("should fallback to default model when not provided", async () => {
      // Ensure window is undefined to simulate server-side
      global.window = undefined as unknown as Window & typeof globalThis;

      // Remove environment model
      process.env.UNAPI_MODEL = undefined;

      const messages = [{ role: "user", content: "Hello" }];

      await callGroqApi(messages);

      // Check if the SDK was called with fallback model
      expect(groq.chat.completions.create).toHaveBeenCalledWith({
        messages,
        model: "llama3-70b-8192", // Default from the code
        temperature: 0.7,
      });
    });
  });
});

// Test that must run in isolation
describe("groqClient initialization warning", () => {
  // Reset modules before this test to get a clean environment
  beforeAll(() => {
    vi.resetModules();
  });

  it("should warn when API key is not set in server environment", async () => {
    // Mock console.warn specifically for this test
    const mockWarn = vi.fn();
    const originalWarn = console.warn;
    console.warn = mockWarn;

    // Ensure we're server-side
    global.window = undefined as unknown as Window & typeof globalThis;

    // Remove the API key
    process.env.GROQ_API_KEY = undefined;

    // Force re-import to trigger the warning
    // Note: We need to use dynamic import here
    await import("@/lib/groqClient");

    // Restore console.warn
    console.warn = originalWarn;

    // Verify warning was logged
    expect(mockWarn).toHaveBeenCalledWith(
      "GROQ_API_KEY not found. Make sure to set it in your environment variables."
    );
  });
});
