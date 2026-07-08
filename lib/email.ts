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

export function markdownToEmailHtml(markdown: string): string {
  const rawHtml = marked.parse(markdown, { gfm: true }) as string;
  const safe = sanitizeHtml(rawHtml, {
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

  // Minimal inline-ish wrapper for email clients.
  return `
  <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.6; color: #111827;">
    <div style="max-width: 720px; margin: 0 auto; padding: 20px;">
      ${safe}
      <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
      <div style="font-size: 12px; color: #6B7280;">
        免責聲明：本信件內容為資訊整理與 AI 摘要，非投資建議。
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

