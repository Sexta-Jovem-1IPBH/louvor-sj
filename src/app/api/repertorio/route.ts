import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reescreverRepertorioSJ } from "@/lib/google/repertorio";

/**
 * Reescreve o documento "Repertório SJ" no Drive com a lista do banco (regra 4).
 * Roda no servidor com a conta de serviço, que consegue editar documentos que já
 * existem — diferente de criar arquivos, que ela não pode.
 */
export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ erro: "é preciso estar logado" }, { status: 401 });
  }

  const { data, error } = await supabase.from("musicas").select("titulo").order("titulo_normalizado");
  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  try {
    await reescreverRepertorioSJ(data.map((m) => m.titulo));
    return NextResponse.json({ ok: true, titulos: data.length });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "falha ao reescrever o documento";
    return NextResponse.json({ erro: mensagem }, { status: 500 });
  }
}
