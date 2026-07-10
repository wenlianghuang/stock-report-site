"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

const IDLE_MS = 10 * 60 * 1000;
const PUBLIC_PATHS = ["/login", "/signup"];

const ACTIVITY_EVENTS = [
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "click",
] as const;

export function IdleLogout() {
  const pathname = usePathname();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loggingOutRef = useRef(false);

  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  const logout = useCallback(async () => {
    if (loggingOutRef.current) {
      return;
    }
    loggingOutRef.current = true;
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Still redirect so the user is not left on a protected page.
    }
    window.location.href = "/login";
  }, []);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      void logout();
    }, IDLE_MS);
  }, [logout]);

  useEffect(() => {
    if (isPublic) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    resetTimer();

    const onActivity = () => {
      resetTimer();
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity);
      }
    };
  }, [isPublic, resetTimer]);

  return null;
}
