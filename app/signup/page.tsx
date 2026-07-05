import { AuthForm } from "@/components/AuthForm";

export default function SignupPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col justify-center px-6 py-10">
      <h1 className="text-2xl font-semibold">註冊</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        建立帳號以使用台股籌碼報告服務
      </p>
      <div className="mt-8">
        <AuthForm mode="signup" />
      </div>
    </div>
  );
}
