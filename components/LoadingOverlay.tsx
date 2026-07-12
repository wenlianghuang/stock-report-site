"use client";

type LoadingOverlayProps = {
  label: string;
};

export function LoadingOverlay({ label }: LoadingOverlayProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white/85 backdrop-blur-sm dark:bg-zinc-950/85"
    >
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{label}</p>
    </div>
  );
}
