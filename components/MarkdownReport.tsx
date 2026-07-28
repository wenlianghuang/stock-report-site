"use client";

import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const BASE_RATE_HEADING_PREFIX = "### 歷史命中率";
const SCENARIO_RANK_RE = /^(主線|次線|尾線)/;

type SplitResult = {
  before: string;
  baseRateTitle: string | null;
  baseRateBody: string;
  after: string;
};

// The deterministic base-rate block is the last chip section emitted before the
// "---" separator that precedes the LLM analysis. Pull it out so it can render
// inside a collapsed <details>, since react-markdown does not process our known
// heading into a collapsible on its own.
function splitBaseRate(markdown: string): SplitResult {
  const start = markdown.indexOf(BASE_RATE_HEADING_PREFIX);
  if (start === -1) {
    return { before: markdown, baseRateTitle: null, baseRateBody: "", after: "" };
  }

  const before = markdown.slice(0, start);
  const rest = markdown.slice(start);

  const separator = rest.match(/\n-{3,}\s*\n/);
  const blockEnd =
    separator && separator.index !== undefined ? separator.index : rest.length;
  const block = rest.slice(0, blockEnd);
  const after = rest.slice(blockEnd);

  const newlineIdx = block.indexOf("\n");
  const headingLine = (newlineIdx === -1 ? block : block.slice(0, newlineIdx)).trim();
  const baseRateTitle = headingLine.replace(/^#{1,6}\s*/, "") || "歷史命中率";
  const baseRateBody = (newlineIdx === -1 ? "" : block.slice(newlineIdx + 1)).trim();

  return { before: before.trim(), baseRateTitle, baseRateBody, after: after.trim() };
}

function extractText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (typeof node === "object" && "props" in node) {
    const props = node.props as { children?: ReactNode };
    return extractText(props.children);
  }
  return "";
}

function isScenarioRankTitle(text: string): boolean {
  return SCENARIO_RANK_RE.test(text.trim());
}

const markdownComponents = {
  strong: ({ children }: { children?: ReactNode }) => {
    const text = extractText(children);
    if (isScenarioRankTitle(text)) {
      return <strong className="scenario-rank-title">{children}</strong>;
    }
    return <strong>{children}</strong>;
  },
  li: ({ children }: { children?: ReactNode }) => {
    const text = extractText(children);
    if (isScenarioRankTitle(text)) {
      return <li className="scenario-rank-item">{children}</li>;
    }
    return <li>{children}</li>;
  },
  h3: ({ children }: { children?: ReactNode }) => {
    const text = extractText(children);
    if (isScenarioRankTitle(text)) {
      return <h3 className="scenario-rank-heading">{children}</h3>;
    }
    return <h3>{children}</h3>;
  },
  h4: ({ children }: { children?: ReactNode }) => {
    const text = extractText(children);
    if (isScenarioRankTitle(text)) {
      return <h4 className="scenario-rank-heading">{children}</h4>;
    }
    return <h4>{children}</h4>;
  },
  p: ({ children }: { children?: ReactNode }) => {
    const text = extractText(children);
    if (isScenarioRankTitle(text)) {
      return <p className="scenario-rank-heading">{children}</p>;
    }
    return <p>{children}</p>;
  },
};

function ReportMarkdown({ source }: { source: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {source}
    </ReactMarkdown>
  );
}

export function MarkdownReport({ markdown }: { markdown: string }) {
  const { before, baseRateTitle, baseRateBody, after } = splitBaseRate(markdown);

  return (
    <article className="report-markdown max-w-none">
      {before ? <ReportMarkdown source={before} /> : null}

      {baseRateTitle ? (
        <details className="my-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-zinc-900 marker:text-zinc-400 dark:text-zinc-100">
            {baseRateTitle}
            <span className="ml-2 text-xs font-normal text-zinc-500">
              （點擊展開）
            </span>
          </summary>
          <div className="px-4 pb-4">
            <ReportMarkdown source={baseRateBody} />
          </div>
        </details>
      ) : null}

      {after ? <ReportMarkdown source={after} /> : null}
    </article>
  );
}
