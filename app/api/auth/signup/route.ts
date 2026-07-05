import { NextResponse } from "next/server";
import { createUser } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";

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
    const passwordHash = await hashPassword(password);
    const user = await createUser(email, passwordHash);
    await createSession(user.id);
    return NextResponse.json({ user: { id: user.id, email: user.email } });
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_EXISTS") {
      return NextResponse.json({ error: "此 email 已註冊" }, { status: 409 });
    }
    return NextResponse.json({ error: "註冊失敗" }, { status: 500 });
  }
}
