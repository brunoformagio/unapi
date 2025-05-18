/// <reference types="@testing-library/jest-dom" />
// All mocks must be defined before imports
vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/openapiParser", () => ({
  parseOpenAPIDocument: vi.fn(),
}));

vi.mock("@/lib/stores/useApiDocStore", () => ({
  useApiDocStore: vi.fn(),
}));

vi.mock("@/lib/intentResolver", () => ({
  resetApiCache: vi.fn(),
}));

// Now we can import the modules
import UploadBox from "@/components/UploadBox";
import { parseOpenAPIDocument } from "@/lib/openapiParser";
import type { ParsedEndpoint } from "@/lib/openapiParser";
import { useApiDocStore } from "@/lib/stores/useApiDocStore";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import toast from "react-hot-toast";
import { MockInstance, beforeEach, describe, expect, it, vi } from "vitest";

// Get references to the mocked functions
const mockToastError = toast.error as unknown as MockInstance;

// Global fetch mock
global.fetch = vi.fn() as unknown as typeof global.fetch;

describe("UploadBox", () => {
  const mockSetEndpoints = vi.fn();
  const mockSetBaseUrl = vi.fn();
  const mockSetApiKey = vi.fn();
  const mockSetDocUrl = vi.fn();
  const mockOnWelcome = vi.fn();
  const mockOnConfigSaved = vi.fn();

  interface ApiDocStoreMock {
    endpoints: ParsedEndpoint[];
    baseUrl: string;
    apiKey: string;
    docUrl: string;
    setEndpoints: (endpoints: ParsedEndpoint[]) => void;
    setBaseUrl: (url: string) => void;
    setApiKey: (key: string) => void;
    setDocUrl: (url: string) => void;
  }

  let initialState: ApiDocStoreMock;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup initial state
    initialState = {
      endpoints: [],
      baseUrl: "",
      apiKey: "",
      docUrl: "",
      setEndpoints: mockSetEndpoints,
      setBaseUrl: mockSetBaseUrl,
      setApiKey: mockSetApiKey,
      setDocUrl: mockSetDocUrl,
    };

    // Setup store mock implementation to update state
    (useApiDocStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) => {
      return selector(initialState);
    });

    // Setup fetch mock
    (global.fetch as unknown as MockInstance).mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        message: "Welcome message",
      }),
    });

    // Setup default parseOpenAPIDocument mock
    (parseOpenAPIDocument as unknown as MockInstance).mockResolvedValue({
      endpoints: [{ method: "GET", path: "/test", summary: "Test endpoint" }],
      baseUrl: "https://api.example.com",
    });
  });

  it("renders the upload form correctly", () => {
    render(<UploadBox />);

    expect(screen.getByText("🔧 OpenAPI docs")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/paste a swagger\/openapi url/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/paste your base url/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/paste your api key here/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
  });

  it("calls the setter functions when input values change", () => {
    render(<UploadBox />);

    const urlInput = screen.getByPlaceholderText(/paste a swagger\/openapi url/i);
    const baseUrlInput = screen.getByPlaceholderText(/paste your base url/i);
    const apiKeyInput = screen.getByPlaceholderText(/paste your api key here/i);

    fireEvent.change(urlInput, { target: { value: "https://example.com/api.json" } });
    fireEvent.change(baseUrlInput, { target: { value: "https://example.com" } });
    fireEvent.change(apiKeyInput, { target: { value: "test-api-key" } });

    // Just verify the callbacks were called with correct values
    expect(mockSetBaseUrl).toHaveBeenCalledWith("https://example.com");
    expect(mockSetApiKey).toHaveBeenCalledWith("test-api-key");
  });

  it("calls onWelcome and onConfigSaved when form is submitted successfully", async () => {
    render(<UploadBox onWelcome={mockOnWelcome} onConfigSaved={mockOnConfigSaved} />);

    // Set up form values
    fireEvent.change(screen.getByPlaceholderText(/paste a swagger\/openapi url/i), {
      target: { value: "https://example.com/api.json" },
    });
    fireEvent.change(screen.getByPlaceholderText(/paste your base url/i), {
      target: { value: "https://example.com" },
    });

    // Submit the form
    const form = screen.getByPlaceholderText(/paste a swagger\/openapi url/i).closest("form");
    if (form) {
      fireEvent.submit(form);
    }

    // Wait for async operations to complete
    await waitFor(() => {
      expect(mockSetDocUrl).toHaveBeenCalledWith("https://example.com/api.json");
      expect(mockOnConfigSaved).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledTimes(2); // Once for the URL, once for the welcome message
      expect(mockOnWelcome).toHaveBeenCalledWith("Welcome message");
    });
  });

  it("extracts base URL from doc URL when input loses focus and baseUrl is empty", () => {
    render(<UploadBox />);

    const urlInput = screen.getByPlaceholderText(/paste a swagger\/openapi url/i);

    fireEvent.change(urlInput, {
      target: { value: "https://api.example.com/v1/docs/swagger.json" },
    });

    fireEvent.blur(urlInput);

    expect(mockSetBaseUrl).toHaveBeenCalledWith("https://api.example.com/v1/docs");
  });

  it("does not extract base URL when input URL is invalid", () => {
    render(<UploadBox />);

    const urlInput = screen.getByPlaceholderText(/paste a swagger\/openapi url/i);

    fireEvent.change(urlInput, { target: { value: "invalid-url" } });
    fireEvent.blur(urlInput);

    expect(mockSetBaseUrl).not.toHaveBeenCalled();
  });

  it("does not extract base URL when baseUrl is not empty", () => {
    // Update initial state to have a baseUrl
    initialState.baseUrl = "https://existing-base.com";

    render(<UploadBox />);

    const urlInput = screen.getByPlaceholderText(/paste a swagger\/openapi url/i);

    fireEvent.change(urlInput, {
      target: { value: "https://api.example.com/v1/docs/swagger.json" },
    });

    fireEvent.blur(urlInput);

    expect(mockSetBaseUrl).not.toHaveBeenCalled();
  });

  it("shows error message when URL submission fails", async () => {
    // Mock fetch to reject
    (global.fetch as unknown as MockInstance).mockRejectedValueOnce(new Error("Network error"));

    render(<UploadBox />);

    // Set up form values with inputUrl and baseUrl to enable the submit button
    fireEvent.change(screen.getByPlaceholderText(/paste a swagger\/openapi url/i), {
      target: { value: "https://example.com/api.json" },
    });

    fireEvent.change(screen.getByPlaceholderText(/paste your base url/i), {
      target: { value: "https://example.com" },
    });

    // Submit the form
    const form = screen.getByPlaceholderText(/paste a swagger\/openapi url/i).closest("form");
    if (form) {
      fireEvent.submit(form);
    }

    // Wait for async operations to complete
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Error loading the URL.");
    });
  });

  it("shows error message when no endpoints are found", async () => {
    // Mock parseOpenAPIDocument to return no endpoints
    (parseOpenAPIDocument as unknown as MockInstance).mockResolvedValueOnce({
      endpoints: [],
      baseUrl: "https://api.example.com",
    });

    render(<UploadBox />);

    // Set up form values
    fireEvent.change(screen.getByPlaceholderText(/paste a swagger\/openapi url/i), {
      target: { value: "https://example.com/api.json" },
    });

    fireEvent.change(screen.getByPlaceholderText(/paste your base url/i), {
      target: { value: "https://example.com" },
    });

    // Submit the form
    const form = screen.getByPlaceholderText(/paste a swagger\/openapi url/i).closest("form");
    if (form) {
      fireEvent.submit(form);
    }

    // Wait for async operations to complete
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("No endpoints found.");
    });
  });

  it("toggles configuration view when isConfigured changes", async () => {
    render(<UploadBox onWelcome={mockOnWelcome} onConfigSaved={mockOnConfigSaved} />);

    // Set up form values and submit
    fireEvent.change(screen.getByPlaceholderText(/paste a swagger\/openapi url/i), {
      target: { value: "https://example.com/api.json" },
    });
    fireEvent.change(screen.getByPlaceholderText(/paste your base url/i), {
      target: { value: "https://example.com" },
    });

    // Submit the form
    const form = screen.getByPlaceholderText(/paste a swagger\/openapi url/i).closest("form");
    if (form) {
      fireEvent.submit(form);
    }

    // After successful submission, the config button should be visible
    await waitFor(() => {
      expect(screen.queryByText("🔧 OpenAPI docs")).not.toBeInTheDocument();
      expect(screen.getByText("Configuration ⚙️")).toBeInTheDocument();
    });

    // Click the config button to show the form again
    fireEvent.click(screen.getByText("Configuration ⚙️"));

    // Form should be visible again
    expect(screen.getByText("🔧 OpenAPI docs")).toBeInTheDocument();
  });

  it("syncs input URL with doc URL from store on initial render", () => {
    // Set a value in docUrl
    initialState.docUrl = "https://api.example.com/swagger.json";

    render(<UploadBox />);

    // Input should have the value from docUrl
    const urlInput = screen.getByPlaceholderText(/paste a swagger\/openapi url/i);
    expect(urlInput).toHaveValue("https://api.example.com/swagger.json");
  });

  it("does not submit the form when URL is empty", async () => {
    render(<UploadBox />);

    // Submit the form without setting any values
    const form = screen.getByPlaceholderText(/paste a swagger\/openapi url/i).closest("form");
    if (form) {
      fireEvent.submit(form);
    }

    // Fetch should not be called
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
