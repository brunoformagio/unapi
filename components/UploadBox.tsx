"use client";

import { useState } from "react";
import { parseOpenAPIDocument } from "@/lib/openapiParser";
import { useApiDocStore } from "@/lib/stores/useApiDocStore";
import toast from "react-hot-toast";

interface UploadBoxProps {
  onWelcome?: (msg: string) => void;
}

export default function UploadBox({ onWelcome }: UploadBoxProps) {
  const [loading, setLoading] = useState(false);
  const setEndpoints = useApiDocStore((s) => s.setEndpoints);
  const setBaseUrl = useApiDocStore((s) => s.setBaseUrl);
  const [inputUrl, setInputUrl] = useState("");

  async function handleParsedDoc(text: string) {
    const parsed = await parseOpenAPIDocument(text);
    if (parsed.endpoints.length === 0) {
      toast.error("Nenhum endpoint encontrado.");
      return;
    }

    setEndpoints(parsed.endpoints);
    setBaseUrl(parsed.baseUrl || "");
    toast.success(`✅ Sucesso! ${parsed.endpoints.length} endpoints lidos.`);

    const res = await fetch("/api/resolve-intent-groq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "iniciar", endpoints: parsed.endpoints }),
    });

    const data = await res.json();
    if (data.message && onWelcome) {
      onWelcome(data.message);
    }
  }

  async function handleFile(file: File) {
    setLoading(true);
    try {
      const text = await file.text();
      await handleParsedDoc(text);
    } catch {
      toast.error("Erro ao ler o arquivo.");
    } finally {
      setLoading(false);
    }
  }

  async function handleURLSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inputUrl.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(inputUrl);
      const json = await res.json();
      await handleParsedDoc(JSON.stringify(json));
      setInputUrl("");
    } catch {
      toast.error("Erro ao carregar a URL.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border p-4 rounded-xl bg-white shadow space-y-4">
      <h2 className="font-semibold text-lg">1️⃣ Envie sua documentação OpenAPI</h2>

      <input
        type="file"
        accept=".json,.yaml,.yml"
        disabled={loading}
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      <form onSubmit={handleURLSubmit} className="flex gap-2">
        <input
          type="text"
          className="border rounded p-2 w-full"
          placeholder="Ou cole a URL de um Swagger JSON ex: https://.../openapi.json"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-black text-white px-4 rounded"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
