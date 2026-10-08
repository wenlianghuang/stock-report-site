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
  reportId: string;
  stockId: string;
  stockName?: string | null;
  tradeDate?: string | null;
  disabled?: boolean;
};

const SUGGESTIONS = [
  "今天外資與主力動向？",
  "什麼是借券賣出？與融券差在哪？",
  "目前籌碼多空型態與背離現象？",
  "現在可以進場買進嗎？",
  "我的部位被套牢該如何應對？",
  "均線排列與關鍵支撐壓力在哪？",
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

function renderSourceBadge(source?: string) {
  if (!source) return null;
  if (source === "facts") {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-500/30">
        報告數字
      </span>
    );
  }
  if (source === "glossary") {
    return (
      <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 ring-1 ring-sky-600/20 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-500/30">
        名詞說明
      </span>
    );
  }
  if (source === "template" || source === "position_template") {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-500/30">
        持股判斷
      </span>
    );
  }
  if (source === "inference") {
    return (
      <span className="inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-700 ring-1 ring-orange-600/20 dark:bg-orange-950/40 dark:text-orange-300 dark:ring-orange-500/30">
        依現況說明
      </span>
    );
  }
  if (source === "out_of_scope") {
    return (
      <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 ring-1 ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-500/30">
        報告沒有這項
      </span>
    );
  }
  if (source === "fundamentals") {
    return (
      <span className="inline-flex items-center rounded-full bg-lime-50 px-2 py-0.5 text-[10px] font-medium text-lime-800 ring-1 ring-lime-600/20 dark:bg-lime-950/40 dark:text-lime-300 dark:ring-lime-500/30">
        基本面
      </span>
    );
  }
  if (source === "reading") {
    return (
      <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 ring-1 ring-indigo-600/20 dark:bg-indigo-950/40 dark:text-indigo-300 dark:ring-indigo-500/30">
        怎麼解讀
      </span>
    );
  }
  if (source === "news") {
    return (
      <span className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-700 ring-1 ring-teal-600/20 dark:bg-teal-950/40 dark:text-teal-300 dark:ring-teal-500/30">
        報告新聞
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-700 ring-1 ring-purple-600/20 dark:bg-purple-950/40 dark:text-purple-300 dark:ring-purple-500/30">
      口語整理
    </span>
  );
}

export function StockReportChat({
  reportId,
  stockId,
  stockName,
  tradeDate,
  disabled,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages([]);
    setInput("");
    setError(null);
  }, [reportId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function send(query: string) {
    const trimmed = query.trim();
    if (!trimmed || sending || disabled) return;

    setError(null);
    setInput("");
    const userMsgId = `u-${Date.now()}`;
    const assistantId = `a-${Date.now()}`;

    const nextHistory = messages
      .filter((m) => m.content.trim())
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: trimmed },
      { id: assistantId, role: "assistant", content: "", streaming: true },
    ]);
    setSending(true);

    let sawError: string | null = null;
    try {
      const response = await fetch(`/api/reports/${reportId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: nextHistory,
        }),
      });

      if (!response.ok) {
        let detail = "";
        try {
          const errData = (await response.json()) as { error?: string; detail?: string };
          detail = errData.error || errData.detail || "";
        } catch {
          detail = await response.text();
        }
        throw new Error(detail || `連線錯誤 (${response.status})`);
      }

      await consumeSse(response, {
        onMeta: (data) => {
          flushSync(() => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId
                  ? {
                      ...msg,
                      intent: typeof data.intent === "string" ? data.intent : msg.intent,
                      source: typeof data.source === "string" ? data.source : msg.source,
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
          const reply = typeof data.reply === "string" ? data.reply : undefined;
          flushSync(() => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId
                  ? {
                      ...msg,
                      content: reply ?? msg.content,
                      intent: typeof data.intent === "string" ? data.intent : msg.intent,
                      source: typeof data.source === "string" ? data.source : msg.source,
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

  const label = stockName ? `${stockName}（${stockId}）` : stockId;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 border-b border-zinc-200 pb-3 dark:border-zinc-800">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          針對 {label} 深度報告連續提問
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          用這份報告的籌碼數字跟你聊：先講重點，再補關鍵依據。不會亂編數字，也不會直接叫你買賣。
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            disabled={sending || disabled}
            onClick={() => void send(q)}
            className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {q}
          </button>
        ))}
      </div>

      <div className="flex min-h-[260px] max-h-[460px] flex-col space-y-3 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
        {messages.length === 0 ? (
          <div className="m-auto flex max-w-md flex-col items-center justify-center text-center text-xs text-zinc-500 dark:text-zinc-400">
            <span className="mb-2 text-2xl">💬</span>
            <p className="font-medium text-zinc-700 dark:text-zinc-300">
              想問什麼都可以，像平常聊天那樣打就好。
            </p>
            <p className="mt-1">
              例如「外資怎麼了」「會不會繼續賣」「我持股怎麼辦」。上方也有幾個常見問題可點。
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-xs ${
                  msg.role === "user"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "border border-zinc-200 bg-white text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                }`}
              >
                {msg.content || (msg.streaming ? "思考中…" : "")}
                {msg.streaming ? (
                  <span className="ml-1 inline-block animate-pulse text-zinc-500">▍</span>
                ) : null}

                {msg.role === "assistant" && !msg.streaming ? (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-2 text-[11px] text-zinc-400 dark:border-zinc-800">
                    {renderSourceBadge(msg.source)}
                    {tradeDate ? <span>基準日：{tradeDate}</span> : null}
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
          ⚠️ {error}
        </p>
      ) : null}

      <form
        className="flex gap-2"
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
          placeholder={`對 ${label} 提問（例如：主力買超多少、什麼是借券賣出、該不該進場…）`}
          className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm outline-none transition-colors focus:border-zinc-900 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400"
        />
        <button
          type="submit"
          disabled={sending || disabled || !input.trim()}
          className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {sending ? "回覆中…" : "送出"}
        </button>
      </form>
    </section>
  );
}
