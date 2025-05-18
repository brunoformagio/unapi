import { TextDecoder, TextEncoder } from "node:util";
/**
 * @jest-environment jsdom
 * @typedef {import('@jest/types').Jest} Jest
 */
// Learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";
import "jest-extended";

import mockRouter from "next-router-mock";
// Mock next/router
import { useRouter } from "next/router";

jest.mock("next/router", () => require("next-router-mock"));

// Add TextEncoder and TextDecoder to global for Node.js environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Define global fetch environment objects needed for MSW
if (typeof global.Response === "undefined") {
  global.Response = class Response {
    constructor(body, init) {
      this.body = body;
      Object.assign(this, init);
    }
  };
  global.Request = class Request {};
  global.Headers = class Headers {
    constructor(init) {
      Object.assign(this, init);
    }
  };
}

// Mock BroadcastChannel for MSW
global.BroadcastChannel = class BroadcastChannel {
  constructor() {
    this.name = "test-broadcast-channel";
  }
  postMessage() {}
  addEventListener() {}
  removeEventListener() {}
  close() {}
};

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
