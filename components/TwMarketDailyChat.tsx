"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  intent?: string;
  source?: string;
  sourcesUsed?: string[];
  streaming?: boolean;
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

type SseHandlers = {
  onMeta?: (data: Record<string, unknown>) => void;
  onToken?: (text: string) => void;
  onDone?: (data: Record<string, unknown>) => void;
  onError?: (message: string) => void;
};

async function consumeSse(
  response: Response,
  handlers: SseHandlers,
): Promise<void> {
  if (!response.body) {
    throw new Error("串流回應沒有 body");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Process complete SSE frames as soon as each blank line arrives.
    while (true) {
      const sep = buffer.indexOf("\n\n");
      const sepCr = buffer.indexOf("\r\n\r\n");
      let idx = -1;
      let sepLen = 2;
      if (sepCr !== -1 && (sep === -1 || sepCr < sep)) {
        idx = sepCr;
        sepLen = 4;
      } else if (sep !== -1) {
        idx = sep;
        sepLen = 2;
      }
      if (idx === -1) break;

      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + sepLen);
      let eventName = "message";
      let dataLine = "";

      for (const rawLine of frame.split(/\r?\n/)) {
        if (!rawLine) continue;
        if (rawLine.startsWith("event:")) {
          eventName = rawLine.slice(6).trim();
          continue;
        }
        if (rawLine.startsWith("data:")) {
          dataLine = rawLine.slice(5).trim();
        }
      }
      if (!dataLine) continue;

      let data: Record<string, unknown>;
      try {
        data = JSON.parse(dataLine) as Record<string, unknown>;
      } catch {
        continue;
      }
      if (eventName === "meta") {
        handlers.onMeta?.(data);
      } else if (eventName === "token") {
        const text = typeof data.text === "string" ? data.text : "";
        if (text) handlers.onToken?.(text);
      } else if (eventName === "done") {
        handlers.onDone?.(data);
      } else if (eventName === "error") {
        const err =
          typeof data.error === "string" ? data.error : "串流對話失敗";
        handlers.onError?.(err);
      }
    }
  }
}

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
    const assistantId = `a-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      userMsg,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        streaming: true,
      },
    ]);
    setInput("");

    try {
      const history = [...messages, userMsg]
        .slice(-6)
        .map((item) => ({ role: item.role, content: item.content }));
      // Primary path is SSE on /chat (also aliased at /chat/stream).
      const response = await fetch(`/api/market-daily/${recordId}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ message: text, history }),
      });

      if (!response.ok) {
        let detail = "";
        try {
          const payload = (await response.json()) as { error?: string };
          detail = payload.error || "";
        } catch {
          detail = await response.text();
        }
        throw new Error(detail || "對話失敗");
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/event-stream")) {
        throw new Error(
          "伺服器未回傳串流（text/event-stream）。請確認 Next 與 Agent 已重啟到最新版。",
        );
      }

      let sawError: string | null = null;
      await consumeSse(response, {
        onMeta: (data) => {
          flushSync(() => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId
                  ? {
                      ...msg,
                      intent:
                        typeof data.intent === "string"
                          ? data.intent
                          : msg.intent,
                      source:
                        typeof data.source === "string"
                          ? data.source
                          : msg.source,
                      sourcesUsed: Array.isArray(data.sources_used)
                        ? (data.sources_used as string[])
                        : msg.sourcesUsed,
                    }
                  : msg,
              ),
            );
          });
        },
        onToken: (piece) => {
          flushSync(() => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId
                  ? {
                      ...msg,
                      content: `${msg.content}${piece}`,
                      streaming: true,
                    }
                  : msg,
              ),
            );
          });
        },
        onDone: (data) => {
          const reply =
            typeof data.reply === "string" ? data.reply : undefined;
          flushSync(() => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId
                  ? {
                      ...msg,
                      content: reply ?? msg.content,
                      intent:
                        typeof data.intent === "string"
                          ? data.intent
                          : msg.intent,
                      source:
                        typeof data.source === "string"
                          ? data.source
                          : msg.source,
                      sourcesUsed: Array.isArray(data.sources_used)
                        ? (data.sources_used as string[])
                        : msg.sourcesUsed,
                      streaming: false,
                    }
                  : msg,
              ),
            );
          });
        },
        onError: (messageText) => {
          sawError = messageText;
        },
      });

      if (sawError) {
        setMessages((prev) => {
          const current = prev.find((msg) => msg.id === assistantId);
          if (current?.content) {
            return prev.map((msg) =>
              msg.id === assistantId ? { ...msg, streaming: false } : msg,
            );
          }
          return prev.filter((msg) => msg.id !== assistantId);
        });
        throw new Error(sawError);
      }

      setMessages((prev) => {
        const current = prev.find((msg) => msg.id === assistantId);
        if (current && !current.content.trim()) {
          return prev.filter((msg) => msg.id !== assistantId);
        }
        return prev.map((msg) =>
          msg.id === assistantId ? { ...msg, streaming: false } : msg,
        );
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "對話失敗");
      setMessages((prev) => {
        const current = prev.find((msg) => msg.id === assistantId);
        if (current && !current.content.trim()) {
          return prev.filter((msg) => msg.id !== assistantId);
        }
        return prev.map((msg) =>
          msg.id === assistantId ? { ...msg, streaming: false } : msg,
        );
      });
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
            常見事實題走 brief 模板；長尾 LLM 回覆會串流顯示。重整後對話清空。
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
                {msg.content || (msg.streaming ? "…" : "")}
                {msg.streaming ? (
                  <span className="ml-0.5 inline-block animate-pulse">▍</span>
                ) : null}
                {msg.role === "assistant" && msg.intent && !msg.streaming ? (
                  <p className="mt-2 text-[10px] uppercase tracking-wide text-zinc-400">
                    {msg.intent}
                    {msg.source ? ` · ${msg.source}` : ""}
                    {msg.sourcesUsed?.length
                      ? ` · ${msg.sourcesUsed.join("+")}`
                      : ""}
                  </p>
                ) : null}
              </div>
            </div>
          ))
        )}
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
          {sending ? "回覆中…" : "送出"}
        </button>
      </form>
    </section>
  );
}
