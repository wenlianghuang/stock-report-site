import { FactsBadges } from "@/components/FactsBadges";
import { StockPriceChart } from "@/components/StockPriceChart";
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
  return (
    <div className="flex flex-col gap-6">
      <FactsBadges facts={facts} />
      <StockPriceChart history={history} avgCost={avgCost} />
    </div>
  );
}
