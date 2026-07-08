declare module "sanitize-html" {
  type SanitizeHtmlOptions = Record<string, unknown>;

  interface SanitizeHtml {
    (html: string, options?: SanitizeHtmlOptions): string;
    defaults: {
      allowedTags: string[];
      allowedAttributes: Record<string, string[]>;
    };
  }

  const sanitizeHtml: SanitizeHtml;
  export default sanitizeHtml;
}

