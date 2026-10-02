import Link from "next/link";
import { BotaoLogin } from "@/components/BotaoLogin";
import { RepertorioList } from "@/components/RepertorioList";
import { getMusicasComStatus } from "@/lib/musicas";

export default async function Home() {
  const musicas = await getMusicasComStatus();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Repertório
        </h1>
        <div className="flex items-center gap-3">
          <Link
            href="/adicionar"
            className="rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            + Música
          </Link>
          <BotaoLogin />
        </div>
      </div>
      <RepertorioList musicas={musicas} />
    </main>
  );
}
