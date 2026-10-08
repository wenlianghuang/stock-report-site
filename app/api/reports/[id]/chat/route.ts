import { requireUser } from "@/lib/auth";
import {
  chatStockReportStream,
  type StockReportChatHistoryItem,
} from "@/lib/agent-client";
import { findReportById, listHoldingsForUser } from "@/lib/db";

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

  const report = await findReportById(id);
  if (!report || report.userId !== user.id) {
    return Response.json({ error: "找不到報告" }, { status: 404 });
  }

  const hasArtifacts = Boolean(
    report.factsJson || report.summaryJson || report.markdown,
  );
  if (!hasArtifacts) {
    return Response.json(
      { error: "此報告缺少可對話的籌碼與分析數據" },
      { status: 422 },
    );
  }

  let body: {
    message?: string;
    history?: StockReportChatHistoryItem[];
  };
  try {
    body = (await request.json()) as {
      message?: string;
      history?: StockReportChatHistoryItem[];
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

  // Prefer this report's own holding snapshot when present (chat is stock-scoped).
  if (
    report.isHolding &&
    report.shareCount != null &&
    report.avgCost != null &&
    !holdings.some((item) => item.stock_id === report.stockId)
  ) {
    holdings.unshift({
      stock_id: report.stockId,
      share_count: report.shareCount,
      avg_cost: report.avgCost,
      uses_margin: Boolean(report.usesMargin),
      cash_share_count: report.cashShareCount ?? null,
      cash_avg_cost: report.cashAvgCost ?? null,
      margin_share_count: report.marginShareCount ?? null,
      margin_avg_cost: report.marginAvgCost ?? null,
    });
  }

  const upstream = await chatStockReportStream({
    stockId: report.stockId,
    message,
    tradeDate: report.tradeDate,
    facts: report.factsJson as Record<string, unknown> | undefined,
    summary: report.summaryJson as Record<string, unknown> | undefined,
    markdown: report.markdown,
    positionMarkdown: report.positionMarkdown ?? null,
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

  // Pipe upstream SSE chunk-by-chunk (do not buffer the whole reply).
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

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { id } = await context.params;
  return buildStreamResponse(request, id);
}
