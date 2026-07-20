export type VoiceEngine = "whisper" | "browser";

const DEFAULT_DEV_STT_URL = "http://127.0.0.1:8787";

function configuredSttUrl(): string {
  const raw = process.env.STT_API_URL?.trim();
  if (raw) return raw;
  if (process.env.NODE_ENV === "development") return DEFAULT_DEV_STT_URL;
  return "";
}

function isLocalUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "127.0.0.1" || host === "localhost" || host === "::1";
  } catch {
    return url.includes("127.0.0.1") || url.includes("localhost");
  }
}

/** Which STT backend the site should use. */
export function resolveVoiceEngine(): VoiceEngine {
  const url = configuredSttUrl();
  if (!url) return "browser";
  if (isLocalUrl(url) && process.env.NODE_ENV !== "development") {
    return "browser";
  }
  return "whisper";
}

/** Upstream whisper.cpp URL (empty when using browser engine). */
export function whisperSttUrl(): string {
  if (resolveVoiceEngine() !== "whisper") return "";
  return configuredSttUrl();
}
