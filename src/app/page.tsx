import { RepertorioList } from "@/components/RepertorioList";
import { getMusicasComStatus } from "@/lib/musicas";

export default async function Home() {
  const musicas = await getMusicasComStatus();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        Repertório
      </h1>
      <RepertorioList musicas={musicas} />
    </main>
  );
}
