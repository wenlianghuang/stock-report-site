import { NextResponse } from "next/server";
import { mapAuthError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string;
    password?: string;
  };

  const email = body.email?.trim() ?? "";
  const password = body.password ?? "";

  if (!email || !password) {
    return NextResponse.json({ error: "請填寫 email 與密碼" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "密碼至少 8 個字元" }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      return NextResponse.json(
        { error: mapAuthError(error.message) },
        { status: 400 },
      );
    }

    if (!data.user) {
      return NextResponse.json({ error: "註冊失敗" }, { status: 500 });
    }

    if (!data.session) {
      return NextResponse.json({
        user: { id: data.user.id, email: data.user.email ?? email },
        message: "註冊成功，請至 email 確認後再登入（若已關閉 email 確認則可直接登入）",
        needsConfirmation: true,
      });
    }

    return NextResponse.json({
      user: { id: data.user.id, email: data.user.email ?? email },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "註冊失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
