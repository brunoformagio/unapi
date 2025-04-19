// app/page.tsx
import UploadBox from "@/components/UploadBox";
import ChatWindow from "@/components/ChatWindow";

export default function Home() {
  return (
    <main className="min-h-screen text-gray-500 flex flex-col items-center justify-start py-12 px-4">
      <div className="max-w-3xl w-full space-y-6">
        <h1 className="text-3xl font-bold text-center">🤖 Unapi — API Copilot</h1>
        <p className="text-center text-gray-600">
          Envie a documentação da sua API e converse com um assistente que entende e executa as chamadas pra você.
        </p>

        
        <ChatWindow />

        <footer className="text-center text-xs text-gray-400 pt-10">
          Unapi MVP – feito com café ☕️ e IA ⚙️
        </footer>
      </div>
    </main>
  );
}
