/* eslint-disable */
// @ts-nocheck
import { executeApiCall } from "@/lib/apiExecutor";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock fetch with a better implementation
global.fetch = vi.fn();

// Setup mock responses
const createMockResponse = (status, statusText, data, headers = {}) => ({
  ok: status < 400,
  status,
  statusText,
  text: vi.fn().mockResolvedValue(typeof data === "string" ? data : JSON.stringify(data)),
  headers: new Headers({
    "content-type": "application/json",
    ...headers,
  }),
});

describe("apiExecutor", () => {
  beforeEach(() => {
    // Reset mock before each test
    vi.clearAllMocks();
    // Mock console.error to avoid polluting test output
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("executeApiCall", () => {
    it("should handle successful GET request", async () => {
      const mockResponse = createMockResponse(200, "OK", { id: 1, name: "Test" });

      // Set up mock to return successful response
      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await executeApiCall(
        "GET",
        "/api/test",
        "https://example.com",
        { param: "value" },
        "test-api-key"
      );

      expect(result.status).toBe(200);
      expect(result.statusText).toBe("OK");
      expect(result.response).toEqual({ id: 1, name: "Test" });

      // Verify fetch was called with correct URL (including query params)
      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.com/api/test?param=value",
        expect.objectContaining({
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-api-key",
          },
        })
      );
    });

    it("should handle successful POST request", async () => {
      const mockResponse = createMockResponse(201, "Created", { id: 1, success: true });

      // Set up mock to return successful response
      global.fetch.mockResolvedValueOnce(mockResponse);

      const payload = { name: "Test", value: 123 };
      const result = await executeApiCall(
        "POST",
        "/api/create",
        "https://example.com",
        payload,
        "test-api-key"
      );

      expect(result.status).toBe(201);
      expect(result.response).toEqual({ id: 1, success: true });

      // Verify fetch was called with correct body
      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.com/api/create",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-api-key",
          },
          body: JSON.stringify(payload),
        })
      );
    });

    it("should handle 404 error", async () => {
      const mockResponse = createMockResponse(404, "Not Found", "");

      // Set up mock to return 404 response
      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await executeApiCall("GET", "/api/nonexistent", "https://example.com", {}, "");

      expect(result.status).toBe(404);
      expect(result.response).toContain("Not Found (404)");
    });

    it("should handle validation errors (422)", async () => {
      const mockResponse = createMockResponse(422, "Unprocessable Entity", {
        detail: [
          {
            loc: ["body", "name"],
            msg: "field required",
            type: "value_error.missing",
          },
        ],
      });

      // Set up mock to return 422 response
      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await executeApiCall(
        "POST",
        "/api/user",
        "https://example.com",
        { email: "test@example.com" },
        "test-api-key"
      );

      expect(result.status).toBe(422);
      expect(result.response).toContain("required fields");
      expect(result.response).toContain("name");
    });

    it("should handle network errors", async () => {
      // Use mockRejectedValueOnce to simulate a network failure
      global.fetch.mockRejectedValueOnce(new Error("Network failure"));

      const result = await executeApiCall("GET", "/api/test", "https://example.com", {}, "");

      expect(result.status).toBe(500);
      expect(result.response).toContain("Error executing API call");
      expect(result.response).toContain("Network failure");
    });

    it("should handle missing base URL", async () => {
      const result = await executeApiCall("GET", "/api/test", "", {}, "test-api-key");

      expect(result.status).toBe(400);
      expect(result.response).toContain("Missing Base URL");
    });

    it("should handle PUT request", async () => {
      const mockResponse = createMockResponse(200, "OK", { id: 1, updated: true });
      global.fetch.mockResolvedValueOnce(mockResponse);

      const payload = { name: "Updated", active: true };
      const result = await executeApiCall(
        "PUT",
        "/api/update/1",
        "https://example.com",
        payload,
        "test-api-key"
      );

      expect(result.status).toBe(200);
      expect(result.response).toEqual({ id: 1, updated: true });
      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.com/api/update/1",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify(payload),
        })
      );
    });

    it("should handle PATCH request", async () => {
      const mockResponse = createMockResponse(200, "OK", { id: 1, patched: true });
      global.fetch.mockResolvedValueOnce(mockResponse);

      const payload = { active: false };
      const result = await executeApiCall(
        "PATCH",
        "/api/patch/1",
        "https://example.com",
        payload,
        "test-api-key"
      );

      expect(result.status).toBe(200);
      expect(result.response).toEqual({ id: 1, patched: true });
      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.com/api/patch/1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify(payload),
        })
      );
    });

    it("should handle DELETE request", async () => {
      const mockResponse = createMockResponse(204, "No Content", "");
      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await executeApiCall(
        "DELETE",
        "/api/delete/1",
        "https://example.com",
        {},
        "test-api-key"
      );

      expect(result.status).toBe(204);
      expect(result.response).toContain("Request successful");
      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.com/api/delete/1",
        expect.objectContaining({
          method: "DELETE",
        })
      );
    });

    it("should normalize URL slashes properly", async () => {
      const mockResponse = createMockResponse(200, "OK", { success: true });
      global.fetch.mockResolvedValueOnce(mockResponse);

      // Base URL with trailing slash, endpoint without leading slash
      await executeApiCall("GET", "api/test", "https://example.com/", {}, "");

      expect(global.fetch).toHaveBeenCalledWith("https://example.com/api/test", expect.any(Object));

      // Reset fetch mock
      global.fetch.mockReset();
      global.fetch.mockResolvedValueOnce(mockResponse);

      // Base URL without trailing slash, endpoint with leading slash
      await executeApiCall("GET", "/api/test", "https://example.com", {}, "");

      expect(global.fetch).toHaveBeenCalledWith("https://example.com/api/test", expect.any(Object));
    });

    it("should handle query parameters with existing query string", async () => {
      const mockResponse = createMockResponse(200, "OK", {});
      global.fetch.mockResolvedValueOnce(mockResponse);

      await executeApiCall(
        "GET",
        "/api/search?q=test",
        "https://example.com",
        { filter: "active", sort: "desc" },
        ""
      );

      // Should properly append query params to existing query string
      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.com/api/search?q=test&filter=active&sort=desc",
        expect.any(Object)
      );
    });

    it("should skip null or undefined query parameters", async () => {
      const mockResponse = createMockResponse(200, "OK", {});
      global.fetch.mockResolvedValueOnce(mockResponse);

      await executeApiCall(
        "GET",
        "/api/users",
        "https://example.com",
        { page: 1, filter: null, search: undefined, limit: 10 },
        ""
      );

      // Should include only non-null params
      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.com/api/users?page=1&limit=10",
        expect.any(Object)
      );
    });

    it("should properly parse plain text responses", async () => {
      const mockResponse = createMockResponse(200, "OK", "Plain text response", {
        "content-type": "text/plain",
      });
      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await executeApiCall("GET", "/api/text", "https://example.com", {}, "");

      expect(result.status).toBe(200);
      expect(result.response).toBe("Plain text response");
    });

    it("should handle empty responses with 204 status", async () => {
      const mockResponse = {
        ok: true,
        status: 204,
        statusText: "No Content",
        headers: new Headers({
          "content-length": "0",
        }),
        text: vi.fn().mockResolvedValue(""),
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await executeApiCall("DELETE", "/api/delete/1", "https://example.com", {}, "");

      expect(result.status).toBe(204);
      expect(result.response).toContain("Request successful");
      // The text method should not be called for empty responses
      expect(mockResponse.text).not.toHaveBeenCalled();
    });

    it("should handle HTML error responses", async () => {
      const htmlResponse = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Error Page</title>
          </head>
          <body>
            <h1>Server Error</h1>
          </body>
        </html>
      `;

      const mockResponse = createMockResponse(500, "Server Error", htmlResponse, {
        "content-type": "text/html",
      });
      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await executeApiCall("GET", "/api/error", "https://example.com", {}, "");

      expect(result.status).toBe(500);
      expect(result.response).toContain("Internal Server Error (500)");
    });

    it("should handle Django-style validation errors", async () => {
      const mockResponse = createMockResponse(422, "Unprocessable Entity", {
        email: ["Enter a valid email address."],
        username: ["This field is required."],
      });
      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await executeApiCall(
        "POST",
        "/api/users",
        "https://example.com",
        { name: "Test" },
        ""
      );

      expect(result.status).toBe(422);
      expect(result.response).toContain("required fields");
      expect(result.response).toContain("username");
      expect(result.response).toContain("email");
    });

    it("should handle malformed JSON responses", async () => {
      const malformedJson = '{"name": "Test", "broken": true,}'; // Note the trailing comma
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({
          "content-type": "application/json",
        }),
        text: vi.fn().mockResolvedValue(malformedJson),
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await executeApiCall("GET", "/api/malformed", "https://example.com", {}, "");

      expect(result.status).toBe(200);
      // Should return the raw text when JSON parsing fails
      expect(result.response).toBe(malformedJson);
    });

    it("should provide human-friendly error messages for different status codes", async () => {
      const errorCodes = [400, 401, 403, 405, 408, 409, 429, 502, 503, 504];

      for (const code of errorCodes) {
        const mockResponse = createMockResponse(code, "Error", "");
        global.fetch.mockResolvedValueOnce(mockResponse);

        const result = await executeApiCall("GET", "/api/test", "https://example.com", {}, "");

        expect(result.status).toBe(code);
        expect(result.response).toContain(`(${code})`);

        // Reset the mock for the next iteration
        global.fetch.mockReset();
      }
    });

    // Tests for error handling with error analysis failure
    it("should handle error analysis failures in validation errors", async () => {
      // Mock response with unexpected validation error format
      const mockResponse = createMockResponse(422, "Unprocessable Entity", {
        errors: "Unexpected format", // Not in expected format
      });
      global.fetch.mockResolvedValueOnce(mockResponse);

      // Just spy on console.error without throwing an exception
      // This will still trigger the error handling path
      console.error.mockClear();

      const result = await executeApiCall(
        "POST",
        "/api/users",
        "https://example.com",
        { incomplete: "data" },
        ""
      );

      // Should fall back to generic message
      expect(result.status).toBe(422);
      expect(result.response).toContain("I couldn't process your request");
    });

    // Test detection of common required fields
    it("should detect common required fields in error messages", async () => {
      const mockResponse = createMockResponse(422, "Unprocessable Entity", {
        error: "The email field is required.",
      });
      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await executeApiCall(
        "POST",
        "/api/users",
        "https://example.com",
        { name: "Test" },
        ""
      );

      expect(result.status).toBe(422);
      expect(result.response).toContain("email");
    });

    // Test getResourceTypeFromEndpoint with various endpoints
    it("should extract resource types from different endpoint formats", async () => {
      // Test with plural endpoint
      const mockResponse1 = createMockResponse(422, "Unprocessable Entity", {
        detail: [{ loc: ["body", "name"], msg: "field required" }],
      });
      global.fetch.mockResolvedValueOnce(mockResponse1);

      let result = await executeApiCall("POST", "/api/users", "https://example.com", {}, "");

      expect(result.response).toContain("create a user");

      // Test with singular endpoint
      global.fetch.mockReset();
      const mockResponse2 = createMockResponse(422, "Unprocessable Entity", {
        detail: [{ loc: ["body", "title"], msg: "field required" }],
      });
      global.fetch.mockResolvedValueOnce(mockResponse2);

      result = await executeApiCall("POST", "/api/article/new", "https://example.com", {}, "");

      expect(result.response).toContain("create a new");

      // Test with complex path
      global.fetch.mockReset();
      const mockResponse3 = createMockResponse(422, "Unprocessable Entity", {
        detail: [{ loc: ["body", "description"], msg: "field required" }],
      });
      global.fetch.mockResolvedValueOnce(mockResponse3);

      result = await executeApiCall(
        "POST",
        "/api/v1/products/categories/items",
        "https://example.com",
        {},
        ""
      );

      expect(result.response).toContain("create a item");
    });

    // Test the special response format with both missing and invalid fields
    it("should format validation error messages with both missing and invalid fields", async () => {
      const mockResponse = createMockResponse(422, "Unprocessable Entity", {
        detail: [
          { loc: ["body", "name"], msg: "field required" },
          { loc: ["body", "email"], msg: "invalid email format" },
        ],
      });
      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await executeApiCall("POST", "/api/register", "https://example.com", {}, "");

      expect(result.status).toBe(422);
      expect(result.response).toContain("required fields");
      expect(result.response).toContain("name");
      expect(result.response).toContain("issues with these fields");
      expect(result.response).toContain("email");
    });

    // Test with empty payload (no query parameters)
    it("should handle GET request with empty payload", async () => {
      const mockResponse = createMockResponse(200, "OK", { success: true });
      global.fetch.mockResolvedValueOnce(mockResponse);

      await executeApiCall("GET", "/api/test", "https://example.com", {}, "");

      // URL should not contain query string
      expect(global.fetch).toHaveBeenCalledWith("https://example.com/api/test", expect.any(Object));
    });

    // Test with empty response body
    it("should handle empty response body", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({
          "content-type": "application/json",
        }),
        text: vi.fn().mockResolvedValue(""),
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await executeApiCall("GET", "/api/empty", "https://example.com", {}, "");

      expect(result.status).toBe(200);
      expect(result.response).toBeNull();
    });

    // Test validation error with invalid detail format
    it("should handle validation errors with invalid detail format", async () => {
      const mockResponse = createMockResponse(422, "Unprocessable Entity", {
        detail: [
          null, // Invalid error object
          { /* Missing loc field */ msg: "Some error" },
          { loc: "not-an-array", msg: "Invalid format" }, // loc is not an array
        ],
      });
      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await executeApiCall(
        "POST",
        "/api/invalid-format",
        "https://example.com",
        {},
        ""
      );

      expect(result.status).toBe(422);
      // Should fall back to generic message as no valid fields could be extracted
      expect(result.response).toContain("I couldn't process your request");
    });

    // Test all HTTP status code branches
    it("should handle all HTTP error status codes", async () => {
      // Test remaining status codes
      const additionalCodes = [418, 425, 500];

      for (const code of additionalCodes) {
        const mockResponse = createMockResponse(code, "Error", "");
        global.fetch.mockResolvedValueOnce(mockResponse);

        const result = await executeApiCall("GET", "/api/test", "https://example.com", {}, "");

        expect(result.status).toBe(code);
        if (code === 500) {
          expect(result.response).toContain("Internal Server Error");
        } else {
          expect(result.response).toContain(`(${code})`);
        }

        // Reset the mock for the next iteration
        global.fetch.mockReset();
      }
    });

    // Test with empty query string after filtering null/undefined values
    it("should handle GET request with all null/undefined query parameters", async () => {
      const mockResponse = createMockResponse(200, "OK", { success: true });
      global.fetch.mockResolvedValueOnce(mockResponse);

      await executeApiCall(
        "GET",
        "/api/test",
        "https://example.com",
        { filter: null, search: undefined },
        ""
      );

      // Should not add query parameters since all are null/undefined
      expect(global.fetch).toHaveBeenCalledWith("https://example.com/api/test", expect.any(Object));
    });

    // Test handling of error in parseResponseBody
    it("should handle errors during response parsing", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({
          "content-type": "application/json",
        }),
        text: vi.fn().mockRejectedValue(new Error("Failed to read response body")),
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await executeApiCall(
        "GET",
        "/api/error-reading",
        "https://example.com",
        {},
        ""
      );

      // When parseResponseBody throws, it becomes a 500 error
      expect(result.status).toBe(500);
      expect(result.response).toContain("Error executing API call");
      expect(result.response).toContain("Response could not be processed");
    });

    // Test validation errors with different object structures
    it("should handle validation errors with various object structures", async () => {
      const mockResponse = createMockResponse(422, "Unprocessable Entity", {
        errors: {
          // Complex nested structure that doesn't match standard patterns
          user: {
            validation: {
              fields: {
                email: "Invalid format",
                password: "Too short",
              },
            },
          },
        },
      });
      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await executeApiCall("POST", "/api/users", "https://example.com", {}, "");

      expect(result.status).toBe(422);
      // The error handling will use the fallback generic message
      expect(result.response).toContain("I couldn't process your request");
    });

    // Test internal server error (500) specifically
    it("should handle internal server error (500) with specific message", async () => {
      const mockResponse = createMockResponse(500, "Internal Server Error", "");
      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await executeApiCall(
        "GET",
        "/api/server-error",
        "https://example.com",
        {},
        ""
      );

      expect(result.status).toBe(500);
      expect(result.response).toContain("Internal Server Error (500)");
      expect(result.response).toContain("not your fault");
    });

    // Test specifically for errors inside validation error analysis
    it("should fall back to generic error message when validation error analysis fails", async () => {
      // Reset our console.error mock to allow it to be called without throwing
      console.error.mockClear();

      // This response has a detail field but it's not in a format that can be processed
      const mockResponse = createMockResponse(422, "Unprocessable Entity", {
        detail: {}, // Empty object instead of array or string
      });
      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await executeApiCall(
        "POST",
        "/api/unparseable-validation",
        "https://example.com",
        {},
        ""
      );

      // Should trigger the catch block in handleValidationError and use generic message
      expect(result.status).toBe(422);
      expect(result.response).toContain("I couldn't process your request");
    });

    // Add a simple passing test
    it("should have the correct functions", () => {
      expect(typeof executeApiCall).toBe("function");
    });

    // Test specific error message formatting
    it("should handle validation errors with invalid but non-empty detail format", async () => {
      // This format triggers a different branch in extractValidationErrors
      const mockResponse = createMockResponse(422, "Unprocessable Entity", {
        detail: "This is a string instead of an array", // Not an array but a string
      });
      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await executeApiCall("POST", "/api/edge-case", "https://example.com", {}, "");

      expect(result.status).toBe(422);
      expect(result.response).toContain("I couldn't process your request");
    });

    // Test non-standard error code that falls to the default case
    it("should handle non-standard error code with default message", async () => {
      // A non-standard code that doesn't have a specific message handler
      const mockResponse = createMockResponse(499, "Client Closed Request", "");
      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await executeApiCall("GET", "/api/weird-error", "https://example.com", {}, "");

      expect(result.status).toBe(499);
      expect(result.response).toContain("Error (499)");
    });

    // Test specifically for 422 error code branch in getHumanFriendlyErrorMessage
    it("should provide specific error message for 422 status code", async () => {
      // Create a mock response with 422 status but no detail field
      // This causes it to skip validation error handling and use default message
      const mockResponse = createMockResponse(422, "Unprocessable Entity", null);
      global.fetch.mockResolvedValueOnce(mockResponse);

      // Set up a specific scenario where handleValidationError is bypassed
      // and we fall through to getHumanFriendlyErrorMessage
      const result = await executeApiCall(
        "POST",
        "/api/no-validation-details",
        "https://example.com",
        {},
        ""
      );

      expect(result.status).toBe(422);
      expect(result.response).toContain("Unprocessable Entity (422)");
      expect(result.response).toContain("validation fails");
    });
  });
});
