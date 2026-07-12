"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";

type AuthFormProps = {
  mode: "login" | "signup";
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setInfo("");
    setSubmitting(true);

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        needsConfirmation?: boolean;
      };

      if (!response.ok) {
        setError(payload.error ?? "操作失敗");
        setSubmitting(false);
        return;
      }

      if (payload.needsConfirmation) {
        setInfo(payload.message ?? "請至 email 確認後再登入");
        setSubmitting(false);
        return;
      }

      // Keep the overlay up during navigation: isPending stays true until the
      // destination route's server components resolve and the view commits.
      // Deliberately do NOT reset submitting on success so the overlay never
      // flashes back to the login form before the home page takes over.
      startTransition(() => {
        router.replace("/");
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "網路錯誤，請稍後再試";
      setError(message);
      setSubmitting(false);
    }
  }

  const busy = submitting || isPending;
  const overlayLabel = mode === "login" ? "登入成功，正在為您載入首頁…" : "註冊成功，正在為您載入首頁…";

  return (
    <>
      {busy ? (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white/85 backdrop-blur-sm dark:bg-zinc-950/85">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{overlayLabel}</p>
        </div>
      ) : null}
      <form onSubmit={onSubmit} className="flex w-full max-w-md flex-col gap-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          密碼
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>
      {info ? <p className="text-sm text-emerald-700">{info}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {busy ? "處理中…" : mode === "login" ? "登入" : "註冊"}
      </button>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {mode === "login" ? "還沒有帳號？" : "已有帳號？"}
        <Link
          href={mode === "login" ? "/signup" : "/login"}
          className="ml-1 font-medium text-zinc-900 underline dark:text-zinc-100"
        >
          {mode === "login" ? "註冊" : "登入"}
        </Link>
      </p>
      </form>
    </>
  );
}
