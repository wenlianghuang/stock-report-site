export function UsStockPlaceholder() {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center dark:border-zinc-700 dark:bg-zinc-950">
      <div className="mb-4 rounded-full bg-amber-50 px-4 py-1.5 text-sm font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
        施工中
      </div>
      <h2 className="text-xl font-semibold">美股專區</h2>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        美股科技新聞日報與個股分析功能正在建置中，完成後會在此提供 Nasdaq /
        費半相關內容與報告。
      </p>
    </div>
  );
}
