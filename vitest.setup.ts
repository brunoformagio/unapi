import { TextDecoder, TextEncoder } from "node:util";
import "@testing-library/jest-dom";
import mockRouter from "next-router-mock";
import { vi } from "vitest";

// Mock next/router
vi.mock("next/router", () => mockRouter);

// Add TextEncoder and TextDecoder to global for Node.js environment
// Using type assertion to avoid type errors
global.TextEncoder = TextEncoder as unknown as typeof global.TextEncoder;
global.TextDecoder = TextDecoder as unknown as typeof global.TextDecoder;

// Define global fetch environment objects needed for MSW
if (typeof global.Response === "undefined") {
  global.Response = class Response {
    body: ReadableStream | null;
    constructor(body: BodyInit | null, init?: ResponseInit) {
      this.body = body instanceof ReadableStream ? body : null;
      Object.assign(this, init);
    }
  } as unknown as typeof global.Response;

  global.Request = class Request {} as unknown as typeof global.Request;

  global.Headers = class Headers {
    constructor(init?: HeadersInit) {
      Object.assign(this, init);
    }
  } as unknown as typeof global.Headers;
}

// Mock BroadcastChannel for MSW
global.BroadcastChannel = class BroadcastChannel {
  name: string;

  constructor() {
    this.name = "test-broadcast-channel";
  }
  postMessage() {}
  addEventListener() {}
  removeEventListener() {}
  close() {}
} as unknown as typeof global.BroadcastChannel;

// Mock environment variables
process.env = {
  ...process.env,
  GROQ_API_KEY: "test-api-key",
  UNAPI_MODEL: "test-model",
  UNAPI_TEMP_CLASSIFICATION: "0.1",
  UNAPI_TEMP_EXTRACTION: "0.1",
  UNAPI_TEMP_CHAT: "0.7",
  UNAPI_TEMP_API: "0.2",
};
