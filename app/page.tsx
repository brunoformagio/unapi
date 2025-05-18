"use client";
import ChatWindow from "@/components/ChatWindow";
import GitHubButton from "react-github-btn";

export default function Home() {
  return (
    <main className="min-h-screen text-gray-500 flex flex-col items-center justify-start py-12 px-4">
      <div className="max-w-3xl w-full space-y-6">
        <h1 className="text-3xl font-bold text-center">Unapi — API Copilot</h1>
        <p className="text-center text-gray-600">
          Upload your API documentation and chat with an assistant that understands and executes API
          calls for you.
        </p>
        <ChatWindow />
        <footer className="text-center text-xs text-gray-400">
          <GitHubButton
            href="https://github.com/brunoformagio"
            data-color-scheme="no-preference: dark; light: dark; dark: dark;"
            data-size="large"
            aria-label="Follow @brunoformagio on GitHub"
          >
            Follow @brunoformagio
          </GitHubButton>
        </footer>
      </div>
    </main>
  );
}
