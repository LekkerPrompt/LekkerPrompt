"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function EmailSignInForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!email.trim()) {
      setMessage("Enter your email");
      return;
    }
    try {
      setSubmitting(true);
      const res = await signIn("email", { email, callbackUrl: "/chat", redirect: false });
      if (res?.error) {
        setMessage("Failed to send magic link. Please try again.");
      } else {
        setMessage("Check your inbox for a sign-in link.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3">
      <input
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
      />
      <button
        type="submit"
        disabled={submitting}
        className="block w-full rounded-lg bg-white/10 px-6 py-3 text-center font-semibold text-white transition hover:bg-white/15 disabled:opacity-60"
      >
        {submitting ? "Sending…" : "Send magic link"}
      </button>
      {message && <p className="text-center text-sm text-white/80">{message}</p>}
    </form>
  );
}


