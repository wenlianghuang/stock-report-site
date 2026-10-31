import { describe, expect, it } from "vitest";
import { canonicalThemeSearch, readThemeNav } from "./theme-nav";

describe("readThemeNav", () => {
  it("keeps news, peers, and changes on one theme", () => {
    expect(readThemeNav({ view: "theme", lens: "peers", scope: "theme" })).toEqual({
      lens: "peers",
      scope: "theme",
    });
  });

  it("opens the old triage tab on holdings changes", () => {
    expect(readThemeNav({ view: "triage", lens: null, scope: null })).toEqual({
      lens: "changes",
      scope: "holdings",
    });
  });

  it("drops news and peers when the scope is not one theme", () => {
    expect(readThemeNav({ view: "theme", lens: "news", scope: "custom" })).toEqual({
      lens: "changes",
      scope: "custom",
    });
  });
});

describe("canonicalThemeSearch", () => {
  it("rewrites the old group tab and keeps the theme id", () => {
    const next = canonicalThemeSearch(new URLSearchParams("view=groups&theme=pcb"));
    expect(next?.get("view")).toBe("theme");
    expect(next?.get("lens")).toBe("peers");
    expect(next?.get("scope")).toBe("theme");
    expect(next?.get("theme")).toBe("pcb");
  });

  it("rewrites the old news tab", () => {
    const next = canonicalThemeSearch(new URLSearchParams("view=concept-news"));
    expect(next?.get("lens")).toBe("news");
    expect(next?.get("scope")).toBe("theme");
  });

  it("forces changes when holdings is paired with news", () => {
    const next = canonicalThemeSearch(
      new URLSearchParams("view=theme&scope=holdings&lens=news&theme=pcb"),
    );
    expect(next?.get("lens")).toBe("changes");
    expect(next?.get("theme")).toBe("pcb");
  });

  it("leaves a canonical theme URL alone", () => {
    expect(
      canonicalThemeSearch(new URLSearchParams("view=theme&lens=news&scope=theme&theme=panel")),
    ).toBeNull();
  });
});
