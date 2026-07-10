import type { ChipFacts } from "@/lib/types";
import {
  CHIP_REGIME_LABEL,
  INSTITUTIONAL_LABEL,
  MA20_SLOPE_LABEL,
  MA_ALIGNMENT_LABEL,
  MA_STACK_LABEL,
  RS_LABEL,
  VOLUME_ANOMALY_LABEL,
  type BadgeTone,
  toneForChipRegime,
  toneForInstitutional,
  toneForMa20Slope,
  toneForMaStack,
  toneForRs,
  toneForVolume,
} from "@/lib/chart-labels";

type BadgeItem = {
  label: string;
  tone: BadgeTone;
};

const TONE_CLASS: Record<BadgeTone, string> = {
  bullish:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  bearish:
    "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300",
  neutral:
    "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
  info: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300",
};

function pushBadge(
  badges: BadgeItem[],
  label: string | undefined,
  tone: BadgeTone,
) {
  if (!label || label.endsWith("資料不足")) {
    return;
  }
  badges.push({ label, tone });
}

export function buildFactsBadges(facts: ChipFacts): BadgeItem[] {
  const badges: BadgeItem[] = [];

  pushBadge(
    badges,
    facts.ma_stack ? MA_STACK_LABEL[facts.ma_stack] : undefined,
    toneForMaStack(facts.ma_stack),
  );
  pushBadge(
    badges,
    facts.ma20_slope ? MA20_SLOPE_LABEL[facts.ma20_slope] : undefined,
    toneForMa20Slope(facts.ma20_slope),
  );
  pushBadge(
    badges,
    facts.chip_regime ? CHIP_REGIME_LABEL[facts.chip_regime] : undefined,
    toneForChipRegime(facts.chip_regime),
  );
  pushBadge(
    badges,
    facts.rs_period ? RS_LABEL[facts.rs_period] : undefined,
    toneForRs(facts.rs_period),
  );
  pushBadge(
    badges,
    facts.institutional_consensus
      ? INSTITUTIONAL_LABEL[facts.institutional_consensus]
      : undefined,
    toneForInstitutional(facts.institutional_consensus),
  );
  pushBadge(
    badges,
    facts.volume_anomaly ? VOLUME_ANOMALY_LABEL[facts.volume_anomaly] : undefined,
    toneForVolume(facts.volume_anomaly),
  );
  pushBadge(
    badges,
    facts.ma_alignment ? MA_ALIGNMENT_LABEL[facts.ma_alignment] : undefined,
    "neutral",
  );

  return badges;
}

type FactsBadgesProps = {
  facts: ChipFacts;
};

export function FactsBadges({ facts }: FactsBadgesProps) {
  const badges = buildFactsBadges(facts);

  if (badges.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((badge) => (
        <span
          key={badge.label}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${TONE_CLASS[badge.tone]}`}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}
