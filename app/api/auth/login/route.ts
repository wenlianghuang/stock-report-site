import { NextResponse } from "next/server";
import { mapAuthError, requireUser } from "@/lib/auth";
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

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json(
        { error: mapAuthError(error.message) },
        { status: 401 },
      );
    }

    if (!data.user) {
      return NextResponse.json({ error: "登入失敗" }, { status: 401 });
    }

    return NextResponse.json({
      user: { id: data.user.id, email: data.user.email ?? email },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "登入失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({ user });
}
