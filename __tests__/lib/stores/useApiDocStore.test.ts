import type { ParsedEndpoint } from "@/lib/openapiParser";
import { useApiDocStore } from "@/lib/stores/useApiDocStore";
import { afterEach, describe, expect, it } from "vitest";

describe("useApiDocStore", () => {
  // Save initial state to restore after each test
  const initialState = useApiDocStore.getState();

  // Reset the store state after each test for isolation
  afterEach(() => {
    useApiDocStore.setState(initialState, true);
  });

  describe("initial state", () => {
    it("should have empty initial values", () => {
      const state = useApiDocStore.getState();

      expect(state.endpoints).toEqual([]);
      expect(state.apiKey).toBe("");
      expect(state.baseUrl).toBe("");
      expect(state.docUrl).toBe("");
    });
  });

  describe("setEndpoints", () => {
    it("should update endpoints state", () => {
      const mockEndpoints: ParsedEndpoint[] = [
        { method: "GET", path: "/test", summary: "Test endpoint" },
        { method: "POST", path: "/users", summary: "Create user" },
      ];

      useApiDocStore.getState().setEndpoints(mockEndpoints);

      const updatedState = useApiDocStore.getState();
      expect(updatedState.endpoints).toEqual(mockEndpoints);
      expect(updatedState.endpoints).toHaveLength(2);
      expect(updatedState.endpoints[0].method).toBe("GET");
      expect(updatedState.endpoints[1].path).toBe("/users");
    });

    it("should replace existing endpoints", () => {
      // First set some endpoints
      const initialEndpoints: ParsedEndpoint[] = [
        { method: "GET", path: "/test", summary: "Test endpoint" },
      ];

      useApiDocStore.getState().setEndpoints(initialEndpoints);

      // Then replace them
      const newEndpoints: ParsedEndpoint[] = [
        { method: "PUT", path: "/different", summary: "Different endpoint" },
      ];

      useApiDocStore.getState().setEndpoints(newEndpoints);

      const updatedState = useApiDocStore.getState();
      expect(updatedState.endpoints).toEqual(newEndpoints);
      expect(updatedState.endpoints[0].method).toBe("PUT");
    });

    it("should handle empty array", () => {
      // First set some endpoints
      const initialEndpoints: ParsedEndpoint[] = [
        { method: "GET", path: "/test", summary: "Test endpoint" },
      ];

      useApiDocStore.getState().setEndpoints(initialEndpoints);

      // Then clear them
      useApiDocStore.getState().setEndpoints([]);

      const updatedState = useApiDocStore.getState();
      expect(updatedState.endpoints).toEqual([]);
      expect(updatedState.endpoints).toHaveLength(0);
    });
  });

  describe("setApiKey", () => {
    it("should update apiKey state", () => {
      const testKey = "test-api-key-12345";

      useApiDocStore.getState().setApiKey(testKey);

      const updatedState = useApiDocStore.getState();
      expect(updatedState.apiKey).toBe(testKey);
    });

    it("should replace existing apiKey", () => {
      // First set a key
      useApiDocStore.getState().setApiKey("initial-key");

      // Then replace it
      useApiDocStore.getState().setApiKey("updated-key");

      const updatedState = useApiDocStore.getState();
      expect(updatedState.apiKey).toBe("updated-key");
    });

    it("should handle empty string", () => {
      // First set a key
      useApiDocStore.getState().setApiKey("some-key");

      // Then clear it
      useApiDocStore.getState().setApiKey("");

      const updatedState = useApiDocStore.getState();
      expect(updatedState.apiKey).toBe("");
    });
  });

  describe("setBaseUrl", () => {
    it("should update baseUrl state", () => {
      const testUrl = "https://api.example.com";

      useApiDocStore.getState().setBaseUrl(testUrl);

      const updatedState = useApiDocStore.getState();
      expect(updatedState.baseUrl).toBe(testUrl);
    });

    it("should replace existing baseUrl", () => {
      // First set a URL
      useApiDocStore.getState().setBaseUrl("https://old-api.example.com");

      // Then replace it
      useApiDocStore.getState().setBaseUrl("https://new-api.example.com");

      const updatedState = useApiDocStore.getState();
      expect(updatedState.baseUrl).toBe("https://new-api.example.com");
    });

    it("should handle empty string", () => {
      // First set a URL
      useApiDocStore.getState().setBaseUrl("https://api.example.com");

      // Then clear it
      useApiDocStore.getState().setBaseUrl("");

      const updatedState = useApiDocStore.getState();
      expect(updatedState.baseUrl).toBe("");
    });
  });

  describe("setDocUrl", () => {
    it("should update docUrl state", () => {
      const testUrl = "https://api.example.com/swagger.json";

      useApiDocStore.getState().setDocUrl(testUrl);

      const updatedState = useApiDocStore.getState();
      expect(updatedState.docUrl).toBe(testUrl);
    });

    it("should replace existing docUrl", () => {
      // First set a URL
      useApiDocStore.getState().setDocUrl("https://old-api.example.com/swagger.json");

      // Then replace it
      useApiDocStore.getState().setDocUrl("https://new-api.example.com/swagger.json");

      const updatedState = useApiDocStore.getState();
      expect(updatedState.docUrl).toBe("https://new-api.example.com/swagger.json");
    });

    it("should handle empty string", () => {
      // First set a URL
      useApiDocStore.getState().setDocUrl("https://api.example.com/swagger.json");

      // Then clear it
      useApiDocStore.getState().setDocUrl("");

      const updatedState = useApiDocStore.getState();
      expect(updatedState.docUrl).toBe("");
    });
  });

  describe("store integration", () => {
    it("should maintain separate state properties", () => {
      // Update all properties
      useApiDocStore.getState().setEndpoints([{ method: "GET", path: "/test", summary: "Test" }]);
      useApiDocStore.getState().setApiKey("test-key");
      useApiDocStore.getState().setBaseUrl("https://api.example.com");
      useApiDocStore.getState().setDocUrl("https://api.example.com/swagger.json");

      // Check that all properties were updated correctly
      const state = useApiDocStore.getState();
      expect(state.endpoints).toHaveLength(1);
      expect(state.apiKey).toBe("test-key");
      expect(state.baseUrl).toBe("https://api.example.com");
      expect(state.docUrl).toBe("https://api.example.com/swagger.json");

      // Update just one property and verify others remain unchanged
      useApiDocStore.getState().setApiKey("updated-key");

      const updatedState = useApiDocStore.getState();
      expect(updatedState.endpoints).toHaveLength(1);
      expect(updatedState.apiKey).toBe("updated-key");
      expect(updatedState.baseUrl).toBe("https://api.example.com");
      expect(updatedState.docUrl).toBe("https://api.example.com/swagger.json");
    });
  });
});
