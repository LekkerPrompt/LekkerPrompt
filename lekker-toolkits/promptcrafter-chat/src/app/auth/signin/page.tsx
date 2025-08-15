import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import EmailSignInForm from "./EmailSignInForm";
import DiscordSignInButton from "./DiscordSignInButton";

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/chat");

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-950 to-black p-6 text-white">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
        <h1 className="mb-2 text-center text-3xl font-extrabold">AI Powered PromptCrafter</h1>
        <p className="mb-8 text-center text-white/80">
          Sign in to build and enhance prompts
          <br/>
          <i>Created by</i> <a href="https://sammyhamwi.ai" target="_blank" className="text-blue-400 underline"><i><u>sammyhamwi.ai</u></i></a>
        </p>
        <DiscordSignInButton />
        <div className="relative mt-8">
          <div className="mb-3 text-center text-sm text-white/70">Or sign in with email</div>
          <EmailSignInForm />
        </div>
      </div>
    </main>
  );
}


