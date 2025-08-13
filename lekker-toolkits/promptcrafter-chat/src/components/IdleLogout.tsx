"use client";

import { useEffect, useRef } from "react";

interface IdleLogoutProps {
  /** Inactivity threshold in milliseconds (default 30 minutes) */
  timeoutMs?: number;
}

export default function IdleLogout({ timeoutMs = 30 * 60 * 1000 }: IdleLogoutProps) {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const reset = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        // Trigger NextAuth signout route
        window.location.href = "/api/auth/signout";
      }, timeoutMs);
    };

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;
    events.forEach((ev) => window.addEventListener(ev, reset, { passive: true }));
    reset();
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      events.forEach((ev) => window.removeEventListener(ev, reset));
    };
  }, [timeoutMs]);

  return null;
}


