"use client";

export function TwPortfolioDashboard() {
  return (
    <div className="flex w-full flex-col gap-8">
      <div>
        <h2 className="text-xl font-semibold">選股組合建議</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          綜合市場與籌碼訊號，產生跨個股的投資組合建議。
        </p>
      </div>

      <section className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-950">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          功能建置中
        </p>
        <p className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">
          選股組合建議即將推出，敬請期待。
        </p>
      </section>
    </div>
  );
}
