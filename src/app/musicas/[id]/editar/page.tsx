import Link from "next/link";
import { notFound } from "next/navigation";
import { EditorMusica } from "@/components/EditorMusica";
import { getMusicaComSecoes } from "@/lib/musicas";

export default async function EditarMusica({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dados = await getMusicaComSecoes(id);
  if (!dados) notFound();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-8">
      <Link href={`/musicas/${id}`} className="w-fit text-sm text-zinc-400 hover:text-zinc-600">
        ← {dados.musica.titulo}
      </Link>
      <EditorMusica musica={dados.musica} secoesIniciais={dados.secoes} />
    </main>
  );
}
