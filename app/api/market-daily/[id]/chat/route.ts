import { requireUser } from "@/lib/auth";
import { chatMarketDailyStream } from "@/lib/agent-client";
import {
  findMarketDailyById,
  listHoldingsForUser,
} from "@/lib/db";
import type { MarketDailyChatHistoryItem } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function buildStreamResponse(request: Request, id: string) {
  const user = await requireUser();
  if (!user) {
    return Response.json({ error: "未登入" }, { status: 401 });
  }

  const record = await findMarketDailyById(id);
  if (!record || record.userId !== user.id) {
    return Response.json({ error: "找不到市場日報紀錄" }, { status: 404 });
  }

  if (record.status !== "done") {
    return Response.json(
      { error: "日報尚未完成，無法對話" },
      { status: 409 },
    );
  }

  const hasArtifacts = Boolean(
    record.factsJson || record.summaryJson || record.markdown,
  );
  if (!hasArtifacts) {
    return Response.json(
      { error: "此日報缺少可對話的 artifacts" },
      { status: 422 },
    );
  }

  let body: {
    message?: string;
    history?: MarketDailyChatHistoryItem[];
  };
  try {
    body = (await request.json()) as {
      message?: string;
      history?: MarketDailyChatHistoryItem[];
    };
  } catch {
    return Response.json({ error: "無效的 JSON" }, { status: 400 });
  }

  const message = body.message?.trim() ?? "";
  if (!message) {
    return Response.json({ error: "請輸入問題" }, { status: 400 });
  }
  if (message.length > 2000) {
    return Response.json({ error: "問題過長" }, { status: 400 });
  }

  const history = (body.history ?? [])
    .filter(
      (item) =>
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string" &&
        item.content.trim().length > 0,
    )
    .slice(-6)
    .map((item) => ({
      role: item.role,
      content: item.content.trim().slice(0, 1500),
    }));

  const holdingRecords = await listHoldingsForUser(user.id, { limit: 20 });
  const hasHoldings = holdingRecords.length > 0;
  const holdings = holdingRecords.map((item) => ({
    stock_id: item.stockId,
    share_count: item.shareCount,
    avg_cost: item.avgCost,
    uses_margin: item.usesMargin,
    cash_share_count: item.cashShareCount ?? null,
    cash_avg_cost: item.cashAvgCost ?? null,
    margin_share_count: item.marginShareCount ?? null,
    margin_avg_cost: item.marginAvgCost ?? null,
  }));

  const upstream = await chatMarketDailyStream({
    message,
    tradeDate: record.tradeDate,
    facts: record.factsJson as Record<string, unknown> | undefined,
    summary: record.summaryJson as Record<string, unknown> | undefined,
    markdown: record.markdown,
    hasHoldings,
    holdings,
    history,
  });

  if (!upstream.ok || !upstream.body) {
    let detail = "";
    try {
      const data = (await upstream.json()) as { detail?: string; error?: string };
      detail = data.detail || data.error || "";
    } catch {
      detail = await upstream.text();
    }
    return Response.json(
      { error: detail || `Agent stream error ${upstream.status}` },
      { status: 502 },
    );
  }

  // Explicitly pump chunks so Next/proxy does not buffer the full SSE body.
  const reader = upstream.body.getReader();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      controller.enqueue(value);
    },
    cancel(reason) {
      void reader.cancel(reason);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    return await buildStreamResponse(request, id);
  } catch (error) {
    const messageText =
      error instanceof Error ? error.message : "無法完成對話";
    return Response.json({ error: messageText }, { status: 502 });
  }
}
