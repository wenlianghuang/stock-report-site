import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col justify-center px-6 py-10">
      <h1 className="text-2xl font-semibold">登入</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        登入後可選擇台股代號並產生籌碼分析報告
      </p>
      <div className="mt-8">
        <AuthForm mode="login" />
      </div>
    </div>
  );
}
