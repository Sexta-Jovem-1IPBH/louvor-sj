import { createClient } from "@/lib/supabase/server";
import type { Musica, MusicaComStatus, Secao, Midia } from "@/lib/types";

export async function getMusicasComStatus(): Promise<MusicaComStatus[]> {
  const supabase = await createClient();

  const [{ data: musicas }, { data: secoes }, { data: midias }] = await Promise.all([
    supabase.from("musicas").select("*").order("titulo_normalizado"),
    supabase.from("secoes").select("musica_id, acordes, letra, letra_cifrada"),
    supabase.from("midias").select("musica_id"),
  ]);

  const secoesPorMusica = new Map<string, Pick<Secao, "acordes" | "letra" | "letra_cifrada">[]>();
  for (const secao of secoes ?? []) {
    const lista = secoesPorMusica.get(secao.musica_id) ?? [];
    lista.push(secao);
    secoesPorMusica.set(secao.musica_id, lista);
  }

  const midiasPorMusica = new Map<string, number>();
  for (const midia of (midias ?? []) as Pick<Midia, "musica_id">[]) {
    midiasPorMusica.set(midia.musica_id, (midiasPorMusica.get(midia.musica_id) ?? 0) + 1);
  }

  return ((musicas ?? []) as Musica[]).map((musica) => {
    const secoesDaMusica = secoesPorMusica.get(musica.id) ?? [];
    return {
      ...musica,
      temLetra: secoesDaMusica.some((s) => !!s.letra?.trim()),
      temSlides: !!musica.slides_drive_id,
      temResumida: secoesDaMusica.some((s) => !!s.acordes?.trim()),
      temAmpla: secoesDaMusica.some((s) => !!s.letra_cifrada?.trim()),
      numMidias: midiasPorMusica.get(musica.id) ?? 0,
    };
  });
}

export async function getMusicaComSecoes(id: string) {
  const supabase = await createClient();

  const [{ data: musica }, { data: secoes }, { data: midias }] = await Promise.all([
    supabase.from("musicas").select("*").eq("id", id).single(),
    supabase.from("secoes").select("*").eq("musica_id", id).order("ordem"),
    supabase.from("midias").select("*").eq("musica_id", id).order("criado_em", { ascending: false }),
  ]);

  if (!musica) return null;

  return {
    musica: musica as Musica,
    secoes: (secoes ?? []) as Secao[],
    midias: (midias ?? []) as Midia[],
  };
}
