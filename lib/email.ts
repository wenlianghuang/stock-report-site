import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { convert } from "html-to-text";
import nodemailer from "nodemailer";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

function inlineEmailStyles(html: string): string {
  return html
    .replaceAll(
      "<h1>",
      '<h1 style="margin:0 0 16px;font-size:20px;line-height:1.4;font-weight:650;color:#111827;">',
    )
    .replaceAll(
      "<h2>",
      '<h2 style="margin:20px 0 8px;font-size:16px;line-height:1.4;font-weight:650;color:#111827;">',
    )
    .replaceAll(
      "<h3>",
      '<h3 style="margin:16px 0 8px;font-size:15px;line-height:1.4;font-weight:650;color:#111827;">',
    )
    .replaceAll("<p>", '<p style="margin:0 0 12px;">')
    .replaceAll(
      "<ul>",
      '<ul style="margin:0 0 12px;padding-left:20px;">',
    )
    .replaceAll("<li>", '<li style="margin:0 0 6px;">');
}

export function markdownToEmailHtml(
  markdown: string,
  disclaimer = "免責聲明：本信件內容為資訊整理與 AI 摘要，非投資建議。",
): string {
  const rawHtml = marked.parse(markdown, { gfm: true }) as string;
  const styled = inlineEmailStyles(rawHtml);
  const safe = sanitizeHtml(styled, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "h1",
      "h2",
      "h3",
      "img",
    ]),
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title"],
      "*": ["style"],
    },
    allowedSchemes: ["http", "https", "mailto"],
  });

  return `
  <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.6; color: #111827;">
    <div style="max-width: 720px; margin: 0 auto; padding: 20px;">
      ${safe}
      <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
      <div style="font-size: 12px; color: #6B7280;">
        ${disclaimer}
      </div>
    </div>
  </div>
  `.trim();
}

export function htmlToPlainText(html: string): string {
  return convert(html, {
    wordwrap: 120,
    selectors: [{ selector: "a", options: { hideLinkHrefIfSameAsText: true } }],
  }).trim();
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const smtpUser = requireEnv("SMTP_USER");
  const smtpPass = requireEnv("SMTP_PASS");
  const from = process.env.EMAIL_FROM?.trim() || smtpUser;
  const text = htmlToPlainText(input.html);

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || "465"),
    secure: String(process.env.SMTP_SECURE || "true") === "true",
    auth: { user: smtpUser, pass: smtpPass },
  });

  await transport.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text,
  });
}

