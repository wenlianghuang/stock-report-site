"use client";

import { useEffect, useRef, useState } from "react";
import type { MarketDailyChatResult } from "@/lib/types";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  intent?: string;
  source?: string;
};

type Props = {
  recordId: string;
  disabled?: boolean;
};

const SUGGESTIONS = [
  "今天外資怎麼做？",
  "明天開盤偏誤？",
  "明天是否進場？",
];

export function TwMarketDailyChat({ recordId, disabled }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages([]);
    setInput("");
    setError(null);
  }, [recordId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || sending || disabled) return;

    setError(null);
    setSending(true);
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    try {
      const history = [...messages, userMsg]
        .slice(-6)
        .map((item) => ({ role: item.role, content: item.content }));
      const response = await fetch(`/api/market-daily/${recordId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const payload = (await response.json()) as {
        chat?: MarketDailyChatResult;
        error?: string;
      };
      if (!response.ok || !payload.chat) {
        throw new Error(payload.error || "對話失敗");
      }
      const chat = payload.chat;
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: chat.reply,
          intent: chat.intent,
          source: chat.source,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "對話失敗");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">針對本份 brief 提問</h3>
          <p className="mt-1 text-xs text-zinc-500">
            只依當日 facts／summary／markdown 回答；重整頁面後對話會清空。不做外網搜尋。
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            disabled={sending || disabled}
            onClick={() => void send(q)}
            className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {q}
          </button>
        ))}
      </div>

      <div className="mt-4 max-h-72 space-y-3 overflow-y-auto rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950/50">
        {messages.length === 0 ? (
          <p className="text-xs text-zinc-500">
            例如：外資淨額、開盤偏誤、儀表板條件。問「明天是否進場」會改答結構偏誤，不會給買賣指令。
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[90%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-white text-zinc-800 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-700"
                }`}
              >
                {msg.content}
                {msg.role === "assistant" && msg.intent ? (
                  <p className="mt-2 text-[10px] uppercase tracking-wide text-zinc-400">
                    {msg.intent}
                    {msg.source ? ` · ${msg.source}` : ""}
                  </p>
                ) : null}
              </div>
            </div>
          ))
        )}
        {sending ? (
          <p className="text-xs text-zinc-500">回覆中…</p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {error ? (
        <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error}</p>
      ) : null}

      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={sending || disabled}
          placeholder="針對這份 brief 提問…"
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <button
          type="submit"
          disabled={sending || disabled || !input.trim()}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          送出
        </button>
      </form>
    </section>
  );
}
