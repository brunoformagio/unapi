"use client";

import { useState, useEffect, useRef } from "react";
import { useApiDocStore } from "@/lib/stores/useApiDocStore";
import { executeApiCall } from "@/lib/apiExecutor";
import UploadBox from "./UploadBox";
import Button from "./Button";
import { motion } from "framer-motion";

export default function ChatWindow() {
  const apiKey = useApiDocStore((state) => state.apiKey);
  const baseUrl = useApiDocStore((state) => state.baseUrl);
  const endpoints = useApiDocStore((state) => state.endpoints);
  const [input, setInput] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Check if configuration is set
  const isConfigured = Boolean(endpoints && endpoints.length > 0 && baseUrl);

  // Auto-scroll to the bottom when logs change
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
    useEffect(() => {
    if (chatContainerRef.current) {
      // Use requestAnimationFrame to ensure DOM updates are complete before scrolling
      requestAnimationFrame(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      });
    }
  }, [logs]);

  const handleSend = async () => {
    if (!input.trim()) return;
    setLogs((prev) => [...prev, `🧑‍💻: ${input}`]);
    setInput(""); // Clear input after sending

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
      setLogs((prev) => [...prev, `❌ ${result.error}`]);
      return;
    }

    setLogs((prev) => [
      ...prev,
      `Calling [${result.method}] ${result.endpoint} with:\n${JSON.stringify(result.payload, null, 2)}`,
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
      "📤 Request sent.",
      `📥 Response [${response.status} ${response.statusText}]:\n${body}`,
    ]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const isUserMessage = (message: string) => message.startsWith("🧑‍💻:");
  const isSystemMessage = (message: string) => 
    message.startsWith("📤") || 
    message.startsWith("📥") ||
    !message.includes(":"); // For welcome messages

  return (
    <>
      <UploadBox 
        onWelcome={(msg) => setLogs((prev) => [...prev, msg])} 
        onConfigSaved={clearLogs} 
      />

      <div 
        className={`border p-4 rounded-xl bg-white shadow mt-4 ${!isConfigured ? "opacity-50" : ""}`}
      >
        <h2 className="font-semibold mb-2">💬 Chat with Assistant</h2>

        <div 
          ref={chatContainerRef}
          className="h-64 overflow-y-auto bg-gray-50 p-3 flex flex-col rounded text-sm mb-2 whitespace-pre-wrap space-y-2"
        >
          {logs.map((log, i) => (
            <motion.div
              // biome-ignore lint/suspicious/noArrayIndexKey: temporary key usage
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`max-w-[85%] inline-flex ${isUserMessage(log) ? "ml-auto" : isSystemMessage(log) ? "mr-auto  text-gray-500 " : "mr-auto"}`}
            >
              {isUserMessage(log) ? (
                <div className="bg-blue-500 text-white p-2 px-3 rounded-2xl ">
                  {log.replace("🧑‍💻: ", "")}
                </div>
              ) : isSystemMessage(log) ? (
                <div className="bg-gray-200 p-2 px-3 rounded-2xl ">
                {log.replace("📤: ", "")}
                </div>
              ) : (
                <div className="bg-blue-100 p-2 px-3 rounded-2xl  ">
                  <span className="font-bold">AI:</span> {log.startsWith("") ? log.replace("🤖: ", "") : log}
                </div>
              )}
            </motion.div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            className="border rounded p-2 w-full"
            type="text"
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!isConfigured}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button 
            onClick={handleSend}
            aria-label="Send message"
            disabled={!isConfigured}
          >
            Send
          </Button>
        </div>
      </div>
    </>
  );
}
