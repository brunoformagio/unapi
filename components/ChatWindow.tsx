"use client";

import { useState } from "react";
import { useApiDocStore } from "@/lib/stores/useApiDocStore";
import { executeApiCall } from "@/lib/apiExecutor";
import UploadBox from "./UploadBox";

export default function ChatWindow() {
  const apiKey = useApiDocStore((state) => state.apiKey);
  const setApiKey = useApiDocStore((state) => state.setApiKey);
  const baseUrl = useApiDocStore((state) => state.baseUrl);
  const setBaseUrl = useApiDocStore((state) => state.setBaseUrl);
  const endpoints = useApiDocStore((state) => state.endpoints);
  const [input, setInput] = useState("");
  const [logs, setLogs] = useState<string[]>([]);

  const handleSend = async () => {
    if (!input.trim()) return;
    setLogs((prev) => [...prev, `🧑‍💻: ${input}`]);

    const res = await fetch("/api/resolve-intent-groq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: input, endpoints }),
    });

    const result = await res.json();

    if (result.message) {
      setLogs((prev) => [...prev, result.message]);
      return;
    }

    if (result.error) {
      setLogs((prev) => [...prev, `🤖: ❌ ${result.error}`]);
      return;
    }

    setLogs((prev) => [
      ...prev,
      `🤖: Chamando [${result.method}] ${result.endpoint} com:\n${JSON.stringify(result.payload, null, 2)}`,
    ]);

    const response = await executeApiCall(
      result.method,
      result.endpoint,
      baseUrl,
      result.payload,
      apiKey
    );

    const isTextResponse = typeof response.response === "string";
    const body = isTextResponse
      ? response.response
      : JSON.stringify(response.response, null, 2);

    setLogs((prev) => [
      ...prev,
      "📤 Requisição enviada.",
      `📥 Resposta [${response.status} ${response.statusText}]:\n${body}`,
    ]);

    setInput("");
  };

  return (
    <>
      <UploadBox onWelcome={(msg) => setLogs((prev) => [...prev, msg])} />

      <div className="border p-4 rounded-xl bg-white shadow mt-4">
        <h2 className="font-semibold mb-2">Chat com Assistente</h2>

        <div className="h-64 overflow-y-auto bg-gray-100 p-2 rounded text-sm mb-2 whitespace-pre-wrap">
          {logs.map((log, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
            <p key={i}>{log}</p>
          ))}
        </div>

        <div className="flex gap-2 mb-2">
          <input
            className="border rounded p-2 w-full"
            type="text"
            placeholder="Cole sua Base URL aqui"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
        </div>

        <div className="flex gap-2 mb-2">
          <input
            className="border rounded p-2 w-full"
            type="password"
            placeholder="Cole sua API Key aqui"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <input
            className="border rounded p-2 w-full"
            type="text"
            placeholder="Digite sua mensagem..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="button"
            onClick={handleSend}
            className="bg-black text-white px-4 rounded"
          >
            Enviar
          </button>
        </div>
      </div>
    </>
  );
}
