import ChatWindow from "@/components/ChatWindow";
import { useApiDocStore } from "@/lib/stores/useApiDocStore";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
/* eslint-disable */
// @ts-nocheck
import "groq-sdk/shims/node";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the API responses
const server = setupServer(
  http.post("/api/resolve-intent", () => {
    return HttpResponse.json({
      method: "GET",
      endpoint: "/api/pets",
      payload: { status: "available" },
    });
  }),

  http.post("/api/execute-api-call", () => {
    return HttpResponse.json({
      status: 200,
      statusText: "OK",
      response: [
        { id: 1, name: "Fluffy", status: "available" },
        { id: 2, name: "Rex", status: "available" },
      ],
    });
  })
);

// Mock zustand store
vi.mock("@/lib/stores/useApiDocStore", () => ({
  useApiDocStore: vi.fn(),
}));

describe("API Flow Integration Test", () => {
  // Start mock server before tests
  beforeAll(() => server.listen());
  // Reset any request handlers between tests
  afterEach(() => server.resetHandlers());
  // Clean up after all tests are done
  afterAll(() => server.close());

  beforeEach(() => {
    // Setup the mock store with endpoints
    (useApiDocStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      endpoints: [
        {
          method: "GET",
          path: "/api/pets",
          summary: "Find pets by status",
          parameters: [
            {
              name: "status",
              in: "query",
              required: true,
            },
          ],
        },
      ],
      baseUrl: "https://example.com",
      apiKey: "test-api-key",
      setApiKey: vi.fn(),
      setBaseUrl: vi.fn(),
    }));
  });

  it("should handle a complete API flow from user message to response", async () => {
    render(<ChatWindow />);

    // Find the chat input
    const input = screen.getByPlaceholderText(/type a message/i) as HTMLInputElement;

    // Type a message and submit
    fireEvent.change(input, { target: { value: "Get available pets" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    // Check for user message in chat
    expect(await screen.findByText("Get available pets")).toBeInTheDocument();

    // Wait for API call and response
    await waitFor(() => {
      // Should show success message
      expect(screen.getByText(/fluffy/i)).toBeInTheDocument();
      expect(screen.getByText(/rex/i)).toBeInTheDocument();
    });
  });

  it("should handle API errors gracefully", async () => {
    // Override server handler for this test to return an error
    server.use(
      http.post("/api/execute-api-call", () => {
        return HttpResponse.json({
          status: 404,
          statusText: "Not Found",
          response: "Resource not found",
        });
      })
    );

    render(<ChatWindow />);

    const input = screen.getByPlaceholderText(/type a message/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Get available pets" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText(/not found/i)).toBeInTheDocument();
    });
  });
});
