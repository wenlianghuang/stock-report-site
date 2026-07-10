import { FactsBadges } from "@/components/FactsBadges";
import { StockPriceChart } from "@/components/StockPriceChart";
import { RSI_ZONE_LABEL } from "@/lib/chart-labels";
import { buildChartPoints } from "@/lib/chart-utils";
import type { ChipFacts, HistoryDay } from "@/lib/types";

type ReportChartsPanelProps = {
  facts: ChipFacts;
  history: HistoryDay[];
  avgCost?: number;
};

export function ReportChartsPanel({
  facts,
  history,
  avgCost,
}: ReportChartsPanelProps) {
  const lastPoint = buildChartPoints(history).at(-1);

  return (
    <div className="flex flex-col gap-6">
      <FactsBadges facts={facts} />
      <StockPriceChart history={history} avgCost={avgCost} />
      {lastPoint ? (
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-zinc-500">收盤</dt>
            <dd className="font-medium">{lastPoint.close.toFixed(2)}</dd>
          </div>
          {lastPoint.ma5 != null ? (
            <div>
              <dt className="text-zinc-500">MA5</dt>
              <dd className="font-medium">{lastPoint.ma5.toFixed(2)}</dd>
            </div>
          ) : null}
          {lastPoint.ma10 != null ? (
            <div>
              <dt className="text-zinc-500">MA10</dt>
              <dd className="font-medium">{lastPoint.ma10.toFixed(2)}</dd>
            </div>
          ) : null}
          {lastPoint.ma20 != null ? (
            <div>
              <dt className="text-zinc-500">MA20</dt>
              <dd className="font-medium">{lastPoint.ma20.toFixed(2)}</dd>
            </div>
          ) : null}
          {facts.rsi_14 != null && facts.rsi_zone && facts.rsi_zone !== "unknown" ? (
            <div>
              <dt className="text-zinc-500">RSI14</dt>
              <dd className="font-medium">
                {facts.rsi_14.toFixed(1)}
                <span className="ml-1 text-xs font-normal text-zinc-500">
                  {RSI_ZONE_LABEL[facts.rsi_zone] ?? facts.rsi_zone}
                </span>
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </div>
  );
}
