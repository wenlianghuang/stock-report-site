"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type AuthFormProps = {
  mode: "login" | "signup";
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

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
        return;
      }

      if (payload.needsConfirmation) {
        setInfo(payload.message ?? "請至 email 確認後再登入");
        return;
      }

      router.replace("/");
    } catch (error) {
      const message = error instanceof Error ? error.message : "網路錯誤，請稍後再試";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
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
        disabled={loading}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {loading ? "處理中…" : mode === "login" ? "登入" : "註冊"}
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
  );
}
