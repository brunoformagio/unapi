// lib/stores/useApiDocStore.ts
import { create } from "zustand";
import type { ParsedEndpoint } from "../openapiParser";

type ApiDocStore = {
  endpoints: ParsedEndpoint[];
  apiKey: string;
  baseUrl: string;
  docUrl: string;
  setEndpoints: (endpoints: ParsedEndpoint[]) => void;
  setApiKey: (key: string) => void;
  setBaseUrl: (url: string) => void;
  setDocUrl: (url: string) => void;
};

export const useApiDocStore = create<ApiDocStore>((set) => ({
  endpoints: [],
  apiKey: "",
  baseUrl: "",
  docUrl: "",
  setEndpoints: (endpoints) => set({ endpoints }),
  setApiKey: (key) => set({ apiKey: key }),
  setBaseUrl: (url) => set({ baseUrl: url }),
  setDocUrl: (url) => set({ docUrl: url }),
}));
