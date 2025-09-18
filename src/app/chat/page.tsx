import { auth } from "@/server/auth";
import ChatClient from "@/app/chat/_components/ChatClient";
import ModelConfigGate from "../../components/ModelConfigGate";
import { DataDirectoryModal } from "@/components/DataDirectoryPicker";

export default async function ChatPage() {
  const session = await auth();

  return (
    <main className="flex w-[100vw] bg-surface-0 text-light h-full">
      <ModelConfigGate>
        <div className="flex h-full w-full">
          <ChatClient user={session?.user as any} />
          <DataDirectoryModal />
        </div>
      </ModelConfigGate>
    </main>
  );
}


