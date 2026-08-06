import { requireUser } from "@/lib/auth";
import { chatMarketDailyStream } from "@/lib/agent-client";
import {
  findMarketDailyById,
  listHoldingsForUser,
} from "@/lib/db";
import type { MarketDailyChatHistoryItem } from "@/lib/types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) {
    return Response.json({ error: "未登入" }, { status: 401 });
  }

  const { id } = await context.params;
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

  try {
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

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const messageText =
      error instanceof Error ? error.message : "無法完成對話";
    return Response.json({ error: messageText }, { status: 502 });
  }
}
