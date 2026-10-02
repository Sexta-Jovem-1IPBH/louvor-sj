import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDriveClient } from "@/lib/google/client";
import { letraDasSecoes, montarApresentacao } from "@/lib/slides/gerar";

const MIME_PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

/**
 * Refaz o .pptx de uma música e substitui o conteúdo do arquivo no Drive (regra 5).
 * Substituir conteúdo funciona com a conta de serviço — o que ela não pode é criar
 * arquivo novo, por não ter cota de armazenamento.
 */
export async function POST(_requisicao: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "é preciso estar logado" }, { status: 401 });

  const { data: musica, error } = await supabase
    .from("musicas")
    .select("id, titulo, slides_drive_id, slides_origem")
    .eq("id", id)
    .single();
  if (error || !musica) return NextResponse.json({ erro: "música não encontrada" }, { status: 404 });

  if (!musica.slides_drive_id) {
    return NextResponse.json({ erro: "essa música ainda não tem slide" }, { status: 400 });
  }
  if (musica.slides_origem !== "gerado") {
    return NextResponse.json(
      { erro: "slide feito à mão nunca é sobrescrito (regra 5)" },
      { status: 409 },
    );
  }

  const { data: secoes } = await supabase
    .from("secoes")
    .select("letra, acordes")
    .eq("musica_id", id)
    .order("ordem");

  const letra = letraDasSecoes(secoes ?? []);

  if (!letra.trim()) {
    return NextResponse.json({ erro: "a música está sem letra" }, { status: 400 });
  }

  try {
    const pptx = montarApresentacao(musica.titulo, letra);
    const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;

    await getDriveClient().files.update({
      fileId: musica.slides_drive_id,
      media: { mimeType: MIME_PPTX, body: Readable.from(buffer) },
    });

    return NextResponse.json({ ok: true });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "falha ao refazer os slides";
    return NextResponse.json({ erro: mensagem }, { status: 500 });
  }
}
