"use client";

import { useState, useEffect } from "react";
import { parseOpenAPIDocument } from "@/lib/openapiParser";
import { useApiDocStore } from "@/lib/stores/useApiDocStore";
import { resetApiCache } from "@/lib/intentResolver";
import toast from "react-hot-toast";
import Button from "./Button";

interface UploadBoxProps {
  onWelcome?: (msg: string) => void;
  onConfigSaved?: () => void;
}

export default function UploadBox({ onWelcome, onConfigSaved }: UploadBoxProps) {
  const [loading, setLoading] = useState(false);
  const setEndpoints = useApiDocStore((s) => s.setEndpoints);
  const setBaseUrl = useApiDocStore((s) => s.setBaseUrl);
  const baseUrl = useApiDocStore((s) => s.baseUrl);
  const apiKey = useApiDocStore((s) => s.apiKey);
  const setApiKey = useApiDocStore((s) => s.setApiKey);
  const docUrl = useApiDocStore((s) => s.docUrl);
  const setDocUrl = useApiDocStore((s) => s.setDocUrl);
  const [inputUrl, setInputUrl] = useState("");
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    if (docUrl && !inputUrl) {
      setInputUrl(docUrl);
    }
  }, [docUrl, inputUrl]);

  // Function to extract base URL from the JSON URL
  const extractBaseUrl = (url: string): string => {
    try {
      // Create a URL object to safely parse the input
      const parsedUrl = new URL(url);
      
      // Get the pathname
      const pathname = parsedUrl.pathname;
      
      // Find the last occurrence of '/' and remove everything after it
      const lastSlashIndex = pathname.lastIndexOf('/');
      
      // Create the base URL using the origin and pathname up to the last directory
      const newBaseUrl = parsedUrl.origin + 
        (lastSlashIndex > 0 ? pathname.substring(0, lastSlashIndex) : '');
      
      return newBaseUrl;
    } catch (error) {
      // Return empty string if URL is invalid
      return '';
    }
  };

  // Handler for onBlur event of the URL input
  const handleUrlBlur = () => {
    // Only set base URL if the current one is empty and we have a valid input URL
    if (!baseUrl && inputUrl) {
      const newBaseUrl = extractBaseUrl(inputUrl);
      if (newBaseUrl) {
        setBaseUrl(newBaseUrl);
      }
    }
  };

  async function handleParsedDoc(text: string) {
    // Reset API cache first to ensure we don't use outdated endpoints
    resetApiCache();

    const parsed = await parseOpenAPIDocument(text);
    if (parsed.endpoints.length === 0) {
      toast.error("No endpoints found.");
      return;
    }

    setEndpoints(parsed.endpoints);
    
    if (parsed.baseUrl && !baseUrl) {
      setBaseUrl(parsed.baseUrl);
    }
    
    toast.success(`✅ Success! ${parsed.endpoints.length} endpoints loaded.`);
    if (onConfigSaved) {
      onConfigSaved();
    }

    const res = await fetch("/api/resolve-intent-groq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "start", endpoints: parsed.endpoints }),
    });

    const data = await res.json();
    if (data.message && onWelcome) {
      onWelcome(data.message);
    }
  }

  async function handleURLSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inputUrl.trim()) return;
    
    setDocUrl(inputUrl);
    
    setLoading(true);
    try {
      const res = await fetch(inputUrl);
      const json = await res.json();
      await handleParsedDoc(JSON.stringify(json));
      setIsConfigured(true);
    } catch {
      toast.error("Error loading the URL.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border p-4 rounded-xl bg-white shadow space-y-4 relative">
      {loading && (
        <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center rounded-xl z-10">
          <div className="w-12 h-12 border-4 border-gray-300 border-t-black rounded-full animate-spin" />
        </div>
      )}
      {!isConfigured && <>
      <h2 className="font-semibold text-lg">🔧 OpenAPI docs</h2>

      <form onSubmit={handleURLSubmit} className="flex gap-2 flex-col">
        <input
          type="text"
          className="border rounded p-2 w-full"
          placeholder="Paste a Swagger/OpenAPI URL here (e.g. https://petstore3.swagger.io/api/v3/openapi.json)"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          onBlur={handleUrlBlur}
        />

      <div className="flex gap-2 ">
        <input
          className="border rounded p-2 w-full"
          type="text"
          placeholder="Paste your Base URL here"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <input
          className="border rounded p-2 w-full"
          type="password"
          placeholder="Paste your Bearer Token here (optional)"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
      </div>
      <div className="flex gap-2 mt-4">
        <Button   
          type="submit"
          disabled={loading || !baseUrl || !inputUrl}
          
          className="w-full"
        >
          Save
        </Button>
      </div></form></>}

      {isConfigured && 
        <Button   
          onClick={() => setIsConfigured(false)}
          className="w-full"
        >
          Configuration ⚙️
        </Button>
      }
    </div>
  );
}
