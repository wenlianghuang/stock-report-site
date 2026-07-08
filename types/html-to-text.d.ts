declare module "html-to-text" {
  export type HtmlToTextOptions = Record<string, unknown>;
  export function convert(html: string, options?: HtmlToTextOptions): string;
}

