export type ThemeLens = "news" | "peers" | "changes";
export type ThemeScope = "theme" | "holdings" | "custom";

export function parseThemeLens(raw: string | null): ThemeLens {
  if (raw === "peers" || raw === "changes") return raw;
  return "news";
}

export function parseThemeScope(raw: string | null): ThemeScope {
  if (raw === "holdings" || raw === "custom") return raw;
  return "theme";
}

/** Old tab URLs and the current theme query, resolved to one lens and one scope. */
export function readThemeNav(input: {
  view: string | null;
  lens: string | null;
  scope: string | null;
}): { lens: ThemeLens; scope: ThemeScope } {
  let lens = parseThemeLens(input.lens);
  let scope = parseThemeScope(input.scope);
  if (input.view === "triage") {
    lens = input.lens ? parseThemeLens(input.lens) : "changes";
    scope = input.scope ? parseThemeScope(input.scope) : "holdings";
  } else if (input.view === "groups") {
    lens = "peers";
    scope = "theme";
  } else if (input.view === "concept-news") {
    lens = "news";
    scope = "theme";
  }
  if (scope !== "theme") {
    lens = "changes";
  }
  return { lens, scope };
}

/**
 * Returns a replacement query when the address bar still uses a legacy view
 * or a lens that does not apply to the current scope. Null means leave it.
 */
export function canonicalThemeSearch(current: URLSearchParams): URLSearchParams | null {
  const view = current.get("view");
  const lensRaw = current.get("lens");
  const scopeRaw = current.get("scope");
  if (
    view !== "triage" &&
    view !== "groups" &&
    view !== "concept-news" &&
    view !== "theme"
  ) {
    return null;
  }

  const nav = readThemeNav({ view, lens: lensRaw, scope: scopeRaw });
  const lensInvalid = Boolean(lensRaw) && lensRaw !== "news" && lensRaw !== "peers" && lensRaw !== "changes";
  const legacy = view === "triage" || view === "groups" || view === "concept-news";
  const scopeForcesChanges = (scopeRaw === "holdings" || scopeRaw === "custom") && lensRaw !== "changes";
  if (!legacy && !lensInvalid && !scopeForcesChanges) {
    return null;
  }

  const next = new URLSearchParams(current);
  next.set("view", "theme");
  next.set("lens", nav.lens);
  next.set("scope", nav.scope);
  return next;
}
