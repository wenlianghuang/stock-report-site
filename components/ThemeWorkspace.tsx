"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConceptNewsDashboard } from "@/components/ConceptNewsDashboard";
import { TwConceptBoard } from "@/components/TwConceptBoard";
import { TwTriageBoard } from "@/components/TwTriageBoard";
import type { ConceptGroup } from "@/lib/agent-client";
import { readThemeNav, type ThemeLens, type ThemeScope } from "@/lib/theme-nav";

type HoldingChip = { stockId: string };

function choiceClass(active: boolean): string {
  return active
    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
    : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900";
}

function preferredTheme(themes: ConceptGroup[], holdingIds: Set<string>): string {
  let best: { themeId: string; count: number } | null = null;
  for (const theme of themes) {
    const count = theme.members.filter((member) => holdingIds.has(member.stockId)).length;
    if (count > 0 && (best == null || count > best.count)) {
      best = { themeId: theme.themeId, count };
    }
  }
  return best?.themeId ?? themes[0]?.themeId ?? "";
}

export function ThemeWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lens, scope } = readThemeNav({
    view: searchParams.get("view"),
    lens: searchParams.get("lens"),
    scope: searchParams.get("scope"),
  });
  const urlTheme = searchParams.get("theme") ?? "";

  const [themes, setThemes] = useState<ConceptGroup[]>([]);
  const [holdings, setHoldings] = useState<HoldingChip[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [themePick, setThemePick] = useState(0);
  const [seen, setSeen] = useState<ThemeLens[]>(() => [lens]);
  const openLenses = seen.includes(lens) ? seen : [...seen, lens];
  if (openLenses !== seen) {
    setSeen(openLenses);
  }
  const lensBeforeScope = useRef<ThemeLens>(scope === "theme" ? lens : "news");

  useEffect(() => {
    if (scope === "theme") {
      lensBeforeScope.current = lens;
    }
  }, [scope, lens]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCatalogLoading(true);
      setCatalogError("");
      try {
        const [themeResponse, holdingResponse] = await Promise.all([
          fetch("/api/concept-groups"),
          fetch("/api/holdings/list"),
        ]);
        const themePayload = (await themeResponse.json()) as {
          themes?: ConceptGroup[];
          error?: string;
        };
        const holdingPayload = (await holdingResponse.json()) as {
          holdings?: HoldingChip[];
          error?: string;
        };
        if (!themeResponse.ok) {
          throw new Error(themePayload.error || "無法載入題材");
        }
        if (!holdingResponse.ok) {
          throw new Error(holdingPayload.error || "無法載入持股");
        }
        if (cancelled) return;
        setThemes(themePayload.themes ?? []);
        setHoldings(holdingPayload.holdings ?? []);
      } catch (error) {
        if (!cancelled) {
          setCatalogError(error instanceof Error ? error.message : "無法載入題材");
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (scope !== "theme" || catalogLoading || catalogError) return;
    if (searchParams.get("theme")) return;
    const id = preferredTheme(themes, new Set(holdings.map((item) => item.stockId)));
    if (!id) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "theme");
    params.set("lens", lens);
    params.set("scope", "theme");
    params.set("theme", id);
    router.replace(`/?${params.toString()}`);
  }, [scope, catalogLoading, catalogError, themes, holdings, searchParams, lens, router]);

  function writeNav(nextScope: ThemeScope, nextLens: ThemeLens, themeId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "theme");
    params.set("scope", nextScope);
    params.set("lens", nextLens);
    if (themeId) params.set("theme", themeId);
    router.replace(`/?${params.toString()}`);
  }

  function selectScope(next: ThemeScope) {
    const nextLens = next === "theme" ? lensBeforeScope.current : "changes";
    writeNav(next, nextLens, urlTheme);
  }

  function selectTheme(id: string) {
    setThemePick((value) => value + 1);
    writeNav("theme", lens, id);
  }

  const holdingIds = new Set(holdings.map((item) => item.stockId));
  const showBody = scope !== "theme" || urlTheme !== "";

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          新聞、同儕和今日變化共用同一個題材。持股和自訂代號只走今日變化。
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-zinc-500">範圍</span>
          <button
            type="button"
            onClick={() => selectScope("theme")}
            disabled={!catalogLoading && themes.length === 0}
            className={`rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50 ${choiceClass(scope === "theme")}`}
          >
            主題池
          </button>
          <button
            type="button"
            onClick={() => selectScope("holdings")}
            disabled={scope !== "holdings" && holdings.length === 0}
            className={`rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50 ${choiceClass(scope === "holdings")}`}
          >
            我的持股（{holdings.length}）
          </button>
          <button
            type="button"
            onClick={() => selectScope("custom")}
            className={`rounded-lg border px-3 py-1.5 text-sm ${choiceClass(scope === "custom")}`}
          >
            自訂代號
          </button>
        </div>

        {scope === "theme" ? (
          catalogLoading ? (
            <p className="text-sm text-zinc-500">載入題材…</p>
          ) : catalogError ? (
            <p className="text-sm text-red-600">{catalogError}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {themes.map((theme) => {
                const held = theme.members.some((member) => holdingIds.has(member.stockId));
                return (
                  <button
                    key={theme.themeId}
                    type="button"
                    onClick={() => selectTheme(theme.themeId)}
                    className={`rounded-lg border px-3 py-1.5 text-sm ${choiceClass(urlTheme === theme.themeId)}`}
                  >
                    {theme.label}
                    <span className="ml-1.5 text-xs opacity-70">{theme.members.length}</span>
                    {held ? <span className="ml-1.5 text-xs opacity-70">持股</span> : null}
                  </button>
                );
              })}
            </div>
          )
        ) : null}
      </div>

      {showBody && openLenses.includes("news") && urlTheme ? (
        <div hidden={!(lens === "news" && scope === "theme")}>
          <ConceptNewsDashboard key={urlTheme} themeId={urlTheme} embedded />
        </div>
      ) : null}
      {showBody && openLenses.includes("peers") && urlTheme ? (
        <div hidden={!(lens === "peers" && scope === "theme")}>
          <TwConceptBoard themeId={urlTheme} themePick={themePick} embedded />
        </div>
      ) : null}
      {showBody && openLenses.includes("changes") ? (
        <div hidden={lens !== "changes"}>
          <TwTriageBoard embedded source={scope} themeId={urlTheme || undefined} />
        </div>
      ) : null}
    </div>
  );
}
