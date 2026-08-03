import { AuthForm } from "@/components/AuthForm";
import { TaiexChart } from "@/components/TaiexChart";
import { TxFuturesChart } from "@/components/TxFuturesChart";
import { getTaiexDailyCached, type TaiexSnapshot } from "@/lib/taiex";
import { getTxFuturesDailyCached, type TxFuturesSnapshot } from "@/lib/tx-futures";

export const dynamic = "force-dynamic";

async function loadTaiexSnapshot(): Promise<{
  snapshot: TaiexSnapshot | null;
  error: string | null;
}> {
  try {
    const snapshot = await getTaiexDailyCached();
    return { snapshot, error: null };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "無法取得加權指數資料";
    return { snapshot: null, error: message };
  }
}

async function loadTxSnapshot(): Promise<{
  snapshot: TxFuturesSnapshot | null;
  error: string | null;
}> {
  try {
    const snapshot = await getTxFuturesDailyCached();
    return { snapshot, error: null };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "無法取得台指期資料";
    return { snapshot: null, error: message };
  }
}

export default async function LoginPage() {
  const [taiex, tx] = await Promise.all([
    loadTaiexSnapshot(),
    loadTxSnapshot(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8 lg:py-12">
      <header className="mb-8">
        <p className="text-sm font-medium tracking-wide text-zinc-500">
          投資研究
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          登入
        </h1>
      </header>

      <div className="grid flex-1 items-start gap-10 md:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.75fr)] md:gap-12">
        <section
          aria-label="大盤日 K"
          className="min-w-0 border-t border-zinc-200 pt-6 dark:border-zinc-800 md:border-t-0 md:border-r md:pr-10 md:pt-0"
        >
          <div className="flex flex-col gap-10">
            <TaiexChart snapshot={taiex.snapshot} error={taiex.error} />
            <TxFuturesChart snapshot={tx.snapshot} error={tx.error} />
          </div>
          <p className="mt-4 max-w-prose text-xs leading-relaxed text-zinc-500">
            加權為現貨加權指數日 K；台指期為日盤近月連續契約。非交易日顯示最近一個有行情的交易日（例如週一早上仍見上週五）。
            資料來源為 Yahoo / 期交所公開行情，不消耗 FinMind 額度。
          </p>
        </section>

        <section className="min-w-0 md:sticky md:top-10">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            登入後可選擇台股代號並產生籌碼分析報告
          </p>
          <div className="mt-6">
            <AuthForm mode="login" />
          </div>
        </section>
      </div>
    </div>
  );
}
