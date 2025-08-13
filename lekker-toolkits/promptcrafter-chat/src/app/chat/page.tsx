import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import ChatClient from "@/app/chat/_components/ChatClient";

export default async function ChatPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  return (
    <main className="flex min-h-svh w-full flex-col bg-gray-950 text-gray-100">
      <ChatClient user={session.user} />
    </main>
  );
}


