import { auth } from "@/server/auth";
import ChatClient from "@/app/chat/_components/ChatClient";
import ModelConfigGate from "../../components/ModelConfigGate";
import DatabaseSetupGate from "../../components/DatabaseSetupGate";
import { DbLocationModalWrapper } from "@/components/DataDirectoryPicker";

export default async function ChatPage() {
  const session = await auth();

  return (
    <main className="flex min-h-svh w-full flex-col bg-gray-950 text-gray-100">
      <DatabaseSetupGate>
        <ModelConfigGate>
          <div className="flex flex-col flex-1">
            <ChatClient user={session?.user} />
            <DbLocationModalWrapper />
          </div>
        </ModelConfigGate>
      </DatabaseSetupGate>
    </main>
  );
}


