/// <reference types="@testing-library/jest-dom" />
// All mocks must be defined before imports
vi.mock("@/lib/stores/useApiDocStore", () => ({
  useApiDocStore: vi.fn(),
}));

vi.mock("@/lib/apiExecutor", () => ({
  executeApiCall: vi.fn(),
}));

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: vi.fn().mockImplementation(({ children, ...props }) => (
      <div data-testid="motion-div" {...props}>
        {children}
      </div>
    )),
  },
}));

// Now we can import the modules
import ChatWindow from "@/components/ChatWindow";
import { executeApiCall } from "@/lib/apiExecutor";
import type { ParsedEndpoint } from "@/lib/openapiParser";
import { useApiDocStore } from "@/lib/stores/useApiDocStore";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MockInstance, beforeEach, describe, expect, it, vi } from "vitest";

// Mock UploadBox component instead of importing the real one
vi.mock("@/components/UploadBox", () => ({
  default: vi.fn().mockImplementation(({ onWelcome, onConfigSaved }) => {
    return (
      <div data-testid="mock-upload-box">
        <button type="button" onClick={() => onWelcome?.("Welcome to the API assistant!")}>
          Trigger Welcome
        </button>
        <button type="button" onClick={() => onConfigSaved?.()}>
          Config Saved
        </button>
      </div>
    );
  }),
}));

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((cb) => {
  cb();
  return 0;
});

// Mock scrollHeight and scrollTop
Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
  configurable: true,
  get: () => 1000,
});

// Global fetch mock
global.fetch = vi.fn() as unknown as typeof global.fetch;

describe("ChatWindow", () => {
  const mockEndpoints: ParsedEndpoint[] = [
    { method: "GET", path: "/test", summary: "Test endpoint" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset scrollTop
    Object.defineProperty(HTMLElement.prototype, "scrollTop", {
      configurable: true,
      get: function () {
        return this._scrollTop || 0;
      },
      set: function (v) {
        this._scrollTop = v;
      },
    });

    // Set up store mock with default values for configured state
    (useApiDocStore as unknown as MockInstance).mockImplementation((selector) => {
      const state = {
        apiKey: "test-api-key",
        baseUrl: "https://api.example.com",
        endpoints: mockEndpoints,
      };
      return selector(state);
    });

    // Setup fetch mock
    (global.fetch as unknown as MockInstance).mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        method: "GET",
        endpoint: "/test",
        payload: { param: "value" },
      }),
    });

    // Setup executeApiCall mock
    (executeApiCall as unknown as MockInstance).mockResolvedValue({
      status: 200,
      statusText: "OK",
      response: { success: true, data: "Test response data" },
    });
  });

  it("renders the chat interface correctly", () => {
    render(<ChatWindow />);

    // Check if chat components are rendered
    expect(screen.getByText("💬 Chat with Assistant")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Type your message...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send message" })).toBeInTheDocument();
  });

  it("displays welcome message from UploadBox", () => {
    render(<ChatWindow />);

    // Click the mock welcome button
    fireEvent.click(screen.getByText("Trigger Welcome"));

    // Welcome message should display
    expect(screen.getByText("Welcome to the API assistant!")).toBeInTheDocument();
  });

  it("clears logs when configuration is saved", () => {
    render(<ChatWindow />);

    // Add a welcome message first
    fireEvent.click(screen.getByText("Trigger Welcome"));
    expect(screen.getByText("Welcome to the API assistant!")).toBeInTheDocument();

    // Now clear logs
    fireEvent.click(screen.getByText("Config Saved"));

    // Message should be gone
    expect(screen.queryByText("Welcome to the API assistant!")).not.toBeInTheDocument();
  });

  it("disables input and button when not configured", () => {
    // Mock state as not configured
    (useApiDocStore as unknown as MockInstance).mockImplementation((selector) => {
      const state = {
        apiKey: "",
        baseUrl: "",
        endpoints: [],
      };
      return selector(state);
    });

    render(<ChatWindow />);

    // Input and button should be disabled
    const input = screen.getByPlaceholderText("Type your message...");
    const button = screen.getByRole("button", { name: "Send message" });

    expect(input).toBeDisabled();
    expect(button).toBeDisabled();
  });

  it("handles user input and sends messages", async () => {
    render(<ChatWindow />);

    // Type a message
    const input = screen.getByPlaceholderText("Type your message...");
    fireEvent.change(input, { target: { value: "Hello" } });
    expect(input).toHaveValue("Hello");

    // Send message
    const sendButton = screen.getByRole("button", { name: "Send message" });
    fireEvent.click(sendButton);

    // Input should be cleared
    expect(input).toHaveValue("");

    // User message should be in the chat
    expect(screen.getByText("Hello")).toBeInTheDocument();

    // API call should be made
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/resolve-intent-groq",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Hello",
          endpoints: mockEndpoints,
        }),
      })
    );

    // Wait for API response to be processed
    await waitFor(() => {
      // Should show request sent message
      expect(screen.getByText("📤 Request sent.")).toBeInTheDocument();

      // Should show response message
      expect(screen.getByText(/📥 Response \[200 OK\]/)).toBeInTheDocument();
      expect(screen.getByText(/Test response data/)).toBeInTheDocument();
    });

    // API executor should be called with correct params
    expect(executeApiCall).toHaveBeenCalledWith(
      "GET",
      "/test",
      "https://api.example.com",
      { param: "value" },
      "test-api-key"
    );
  });

  it("sends message when pressing Enter", () => {
    render(<ChatWindow />);

    // Type a message
    const input = screen.getByPlaceholderText("Type your message...");
    fireEvent.change(input, { target: { value: "Test with Enter key" } });

    // Press Enter to send
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    // Input should be cleared
    expect(input).toHaveValue("");

    // User message should be in the chat
    expect(screen.getByText("Test with Enter key")).toBeInTheDocument();
  });

  it("doesn't send message when pressing Enter with shift key", () => {
    render(<ChatWindow />);

    const input = screen.getByPlaceholderText("Type your message...");
    fireEvent.change(input, { target: { value: "Test with Shift+Enter" } });

    // Press Shift+Enter (should not send)
    fireEvent.keyDown(input, { key: "Enter", code: "Enter", shiftKey: true });

    // Input should still have value
    expect(input).toHaveValue("Test with Shift+Enter");

    // No fetch call should be made
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("doesn't send empty messages", () => {
    render(<ChatWindow />);

    // Try to send with empty input
    const sendButton = screen.getByRole("button", { name: "Send message" });
    fireEvent.click(sendButton);

    // No fetch call should be made
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("handles API error responses", async () => {
    // Mock fetch to return an error
    (global.fetch as unknown as MockInstance).mockResolvedValueOnce({
      json: vi.fn().mockResolvedValue({
        error: "API not available",
      }),
    });

    render(<ChatWindow />);

    // Type and send a message
    const input = screen.getByPlaceholderText("Type your message...");
    fireEvent.change(input, { target: { value: "Cause error" } });
    const sendButton = screen.getByRole("button", { name: "Send message" });
    fireEvent.click(sendButton);

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText("❌ API not available")).toBeInTheDocument();
    });

    // executeApiCall should not be called
    expect(executeApiCall).not.toHaveBeenCalled();
  });

  it("handles plain text message responses", async () => {
    // Mock fetch to return a message directly
    (global.fetch as unknown as MockInstance).mockResolvedValueOnce({
      json: vi.fn().mockResolvedValue({
        message: "This is a direct message response",
      }),
    });

    render(<ChatWindow />);

    // Type and send a message
    const input = screen.getByPlaceholderText("Type your message...");
    fireEvent.change(input, { target: { value: "Cause message" } });
    const sendButton = screen.getByRole("button", { name: "Send message" });
    fireEvent.click(sendButton);

    // Should show the message
    await waitFor(() => {
      expect(screen.getByText("This is a direct message response")).toBeInTheDocument();
    });

    // executeApiCall should not be called
    expect(executeApiCall).not.toHaveBeenCalled();
  });

  it("handles plain text API responses", async () => {
    // Setup executeApiCall to return text response
    (executeApiCall as unknown as MockInstance).mockResolvedValueOnce({
      status: 200,
      statusText: "OK",
      response: "This is a plain text response",
    });

    render(<ChatWindow />);

    // Type and send a message
    const input = screen.getByPlaceholderText("Type your message...");
    fireEvent.change(input, { target: { value: "Get text response" } });
    const sendButton = screen.getByRole("button", { name: "Send message" });
    fireEvent.click(sendButton);

    // Should show the plain text response
    await waitFor(() => {
      expect(screen.getByText(/📥 Response \[200 OK\]:/)).toBeInTheDocument();
      expect(screen.getByText(/This is a plain text response/)).toBeInTheDocument();
    });
  });

  it("auto-scrolls to bottom when new messages arrive", async () => {
    render(<ChatWindow />);

    // Send a message to trigger scroll behavior
    const input = screen.getByPlaceholderText("Type your message...");
    fireEvent.change(input, { target: { value: "Test scroll" } });
    const sendButton = screen.getByRole("button", { name: "Send message" });
    fireEvent.click(sendButton);

    // Check if requestAnimationFrame was called
    expect(global.requestAnimationFrame).toHaveBeenCalled();

    // Chat container should be scrolled to bottom
    const chatContainers = document.querySelectorAll(".overflow-y-auto");
    const chatContainer = chatContainers[0] as HTMLElement;

    // Use a type assertion to access the scrollTop property
    // This is safe in a test environment where we defined this property
    expect((chatContainer as unknown as { _scrollTop: number })._scrollTop).toBe(1000);
  });
});
