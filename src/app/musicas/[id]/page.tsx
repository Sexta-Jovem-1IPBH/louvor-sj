import Link from "next/link";
import { notFound } from "next/navigation";
import { MusicaTabs } from "@/components/MusicaTabs";
import { getMusicaComSecoes } from "@/lib/musicas";

export default async function MusicaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dados = await getMusicaComSecoes(id);

  if (!dados) notFound();

  const { musica, secoes, midias } = dados;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <Link href="/" className="w-fit text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
        ← Repertório
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {musica.titulo}
        </h1>
        {musica.tom_original && (
          <p className="text-sm text-zinc-400">Tom original: {musica.tom_original}</p>
        )}
      </div>
      <MusicaTabs musica={musica} secoes={secoes} midias={midias} />
    </main>
  );
}
