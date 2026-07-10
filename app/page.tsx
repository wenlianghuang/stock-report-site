import { Suspense } from "react";
import { redirect } from "next/navigation";
import { HomeShell } from "@/components/HomeShell";
import { requireUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await requireUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-zinc-500">
          載入中…
        </div>
      }
    >
      <HomeShell />
    </Suspense>
  );
}
