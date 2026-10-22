import ChatInterface from "@/components/chat/ChatInterface";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col h-screen overflow-hidden">
      <ChatInterface />
    </main>
  );
}
