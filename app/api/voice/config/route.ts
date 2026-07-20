import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { resolveVoiceEngine } from "@/lib/voice-config";

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const engine = resolveVoiceEngine();
  return NextResponse.json({
    engine,
    label: engine === "whisper" ? "Whisper（伺服器）" : "瀏覽器語音辨識",
  });
}
