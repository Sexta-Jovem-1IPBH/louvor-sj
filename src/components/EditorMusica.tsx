"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { ESCOPO_DRIVE } from "@/lib/supabase/escopos";
import type { Musica, Secao } from "@/lib/types";

const TIPOS_SUGERIDOS = ["Intro", "Estrofe 1", "Estrofe 2", "Estrofe 3", "Refrão", "Ponte", "Final"];

export function EditorMusica({
  musica,
  secoesIniciais,
}: {
  musica: Musica;
  secoesIniciais: Secao[];
}) {
  const router = useRouter();
  const [usuario, setUsuario] = useState<User | null>(null);
  const [titulo, setTitulo] = useState(musica.titulo);
  const [tom, setTom] = useState(musica.tom_original ?? "");
  const [secoes, setSecoes] = useState(secoesIniciais);
  const [salvando, setSalvando] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setUsuario(data.user));
  }, []);

  function alterar(id: string, campo: keyof Secao, valor: string) {
    setSecoes((atuais) =>
      atuais.map((s) => (s.id === id ? { ...s, [campo]: valor || null } : s)),
    );
  }

  async function entrar() {
    await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback?next=/musicas/${musica.id}/editar`,
        scopes: ESCOPO_DRIVE,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
  }

  async function salvar() {
    if (!usuario) return;
    setSalvando(true);
    setRecado(null);
    const supabase = createClient();

    try {
      const letraMudou = secoes.some(
        (s) => s.letra !== secoesIniciais.find((o) => o.id === s.id)?.letra,
      );

      if (titulo !== musica.titulo || (tom || null) !== musica.tom_original) {
        const { error } = await supabase
          .from("musicas")
          .update({ titulo: titulo.trim(), tom_original: tom.trim() || null })
          .eq("id", musica.id);
        if (error) throw new Error(error.message);
        await registrarHistorico(supabase, usuario.id, "musicas", musica.id, musica, {
          ...musica,
          titulo: titulo.trim(),
          tom_original: tom.trim() || null,
        });
      }

      for (const secao of secoes) {
        const antes = secoesIniciais.find((o) => o.id === secao.id);
        if (!antes) continue;
        const mudou =
          antes.tipo !== secao.tipo ||
          antes.acordes !== secao.acordes ||
          antes.letra !== secao.letra ||
          antes.letra_cifrada !== secao.letra_cifrada;
        if (!mudou) continue;

        const { error } = await supabase
          .from("secoes")
          .update({
            tipo: secao.tipo,
            acordes: secao.acordes,
            letra: secao.letra,
            letra_cifrada: secao.letra_cifrada,
          })
          .eq("id", secao.id);
        if (error) throw new Error(error.message);
        await registrarHistorico(supabase, usuario.id, "secoes", secao.id, antes, secao);
      }

      // regra 5: slide gerado pelo app é refeito quando a letra muda; o feito à mão, nunca
      if (letraMudou && musica.slides_origem === "gerado" && musica.slides_drive_id) {
        setRecado("Letra alterada — refazendo os slides…");
        const resposta = await fetch(`/api/musicas/${musica.id}/slides`, { method: "POST" });
        if (!resposta.ok) {
          const corpo = await resposta.json().catch(() => ({}));
          setRecado(`Salvo, mas não consegui refazer os slides: ${corpo.erro ?? resposta.status}`);
          setSalvando(false);
          return;
        }
      }

      if (titulo !== musica.titulo) await fetch("/api/repertorio", { method: "POST" });

      router.push(`/musicas/${musica.id}`);
      router.refresh();
    } catch (e) {
      setRecado(e instanceof Error ? e.message : String(e));
      setSalvando(false);
    }
  }

  const campo =
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

  if (!usuario) {
    return (
      <div className="flex flex-col items-start gap-3">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Editar</h1>
        <p className="text-zinc-500">É preciso entrar com o Google para editar.</p>
        <button
          onClick={entrar}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Entrar com Google
        </button>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Editar música</h1>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Título</span>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={campo} />
        </label>
        <label className="flex w-full flex-col gap-1 sm:w-32">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Tom</span>
          <input
            value={tom}
            onChange={(e) => setTom(e.target.value)}
            placeholder="ex.: G"
            className={campo}
          />
        </label>
      </div>

      <datalist id="tipos-secao">
        {TIPOS_SUGERIDOS.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      {secoes.map((secao, i) => (
        <section
          key={secao.id}
          className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">{i + 1}</span>
            <input
              value={secao.tipo}
              list="tipos-secao"
              onChange={(e) => alterar(secao.id, "tipo", e.target.value)}
              className={`${campo} font-medium`}
            />
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Acordes (cifra resumida)</span>
            <input
              value={secao.acordes ?? ""}
              onChange={(e) => alterar(secao.id, "acordes", e.target.value)}
              className={`${campo} font-mono`}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Letra</span>
            <textarea
              value={secao.letra ?? ""}
              onChange={(e) => alterar(secao.id, "letra", e.target.value)}
              rows={4}
              className={campo}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Cifra ampla (ChordPro)</span>
            <textarea
              value={secao.letra_cifrada ?? ""}
              onChange={(e) => alterar(secao.id, "letra_cifrada", e.target.value)}
              rows={3}
              className={`${campo} font-mono`}
            />
          </label>
        </section>
      ))}

      <p className="text-xs text-zinc-400">
        Seções não podem ser excluídas (o repertório só cresce, regra do projeto). Para tirar uma
        seção da tela, apague o conteúdo dela.
      </p>

      {recado && (
        <p className="rounded-lg bg-zinc-100 p-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {recado}
        </p>
      )}

      <button
        onClick={salvar}
        disabled={salvando}
        className="w-fit rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {salvando ? "Salvando…" : "Salvar alterações"}
      </button>
    </>
  );
}

/** Regra 2: toda alteração fica registrada, com antes e depois, para permitir desfazer. */
async function registrarHistorico(
  supabase: ReturnType<typeof createClient>,
  usuarioId: string,
  tabela: string,
  registroId: string,
  antes: unknown,
  depois: unknown,
) {
  await supabase.from("historico_alteracoes").insert({
    tabela,
    registro_id: registroId,
    antes,
    depois,
    usuario: usuarioId,
  });
}
