"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { ESCOPO_DRIVE } from "@/lib/supabase/escopos";
import { parsearCifra, type SecaoParseada } from "@/lib/cifras/parser";
import { dividirEmBlocos, gerarSlides, letraDasSecoes } from "@/lib/slides/gerar";
import { enviarArquivo, PASTA_SLIDES, ErroDrive } from "@/lib/google/driveNavegador";
import { normalizarTitulo, similaridade } from "@/lib/texto";

const LIMIAR_PARECIDO = 0.72;

export default function AdicionarMusica() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<User | null>(null);
  const [titulos, setTitulos] = useState<{ id: string; titulo: string; norm: string }[]>([]);

  const [titulo, setTitulo] = useState("");
  const [letra, setLetra] = useState("");
  const [cifra, setCifra] = useState("");

  const [salvando, setSalvando] = useState(false);
  const [progresso, setProgresso] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUsuario(data.user));
    supabase
      .from("musicas")
      .select("id, titulo, titulo_normalizado")
      .then(({ data }) =>
        setTitulos((data ?? []).map((m) => ({ id: m.id, titulo: m.titulo, norm: m.titulo_normalizado }))),
      );
  }, []);

  const parecidas = useMemo(() => {
    const norm = normalizarTitulo(titulo);
    if (norm.length < 3) return [];
    return titulos
      .map((m) => ({ ...m, score: similaridade(norm, m.norm) }))
      .filter((m) => m.score >= LIMIAR_PARECIDO)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }, [titulo, titulos]);

  const secoes: SecaoParseada[] = useMemo(() => {
    if (cifra.trim()) return parsearCifra(cifra);
    return letra
      .split(/\n\s*\n/)
      .map((bloco) => bloco.trim())
      .filter(Boolean)
      .map((bloco, i) => ({ tipo: `Parte ${i + 1}`, acordes: "", letra: bloco, letraCifrada: "" }));
  }, [cifra, letra]);

  const letraFinal = useMemo(
    () => letraDasSecoes(secoes.map((s) => ({ letra: s.letra || null, acordes: s.acordes || null }))),
    [secoes],
  );

  const blocosDeSlide = useMemo(() => (letraFinal ? dividirEmBlocos(letraFinal) : []), [letraFinal]);

  function registrar(texto: string) {
    setProgresso((anteriores) => [...anteriores, texto]);
  }

  async function entrar() {
    await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback?next=/adicionar`,
        scopes: ESCOPO_DRIVE,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
  }

  async function salvar() {
    setErro(null);
    setProgresso([]);
    setSalvando(true);

    const supabase = createClient();

    try {
      registrar("Cadastrando a música…");
      const { data: musica, error: erroMusica } = await supabase
        .from("musicas")
        .insert({
          titulo: titulo.trim(),
          titulo_normalizado: normalizarTitulo(titulo),
          criado_por: usuario?.id ?? null,
        })
        .select("id")
        .single();
      if (erroMusica) throw new Error(`não consegui cadastrar: ${erroMusica.message}`);

      if (secoes.length) {
        const { error: erroSecoes } = await supabase.from("secoes").insert(
          secoes.map((s, i) => ({
            musica_id: musica.id,
            ordem: i + 1,
            tipo: s.tipo,
            acordes: s.acordes || null,
            letra: s.letra || null,
            letra_cifrada: s.letraCifrada || null,
          })),
        );
        if (erroSecoes) throw new Error(`música salva, mas as seções falharam: ${erroSecoes.message}`);
      }
      registrar(`Música cadastrada com ${secoes.length} seção(ões).`);

      // slides: criados com o token do Google de quem está logado
      if (letraFinal) {
        const { data: sessao } = await supabase.auth.getSession();
        const token = sessao.session?.provider_token;
        if (!token) {
          registrar("Sem token do Google agora — a música fica marcada como 'sem slides'.");
        } else {
          try {
            registrar("Gerando os slides…");
            const arquivo = await gerarSlides(titulo.trim(), letraFinal);
            const driveId = await enviarArquivo({
              token,
              nome: `${titulo.trim()}.pptx`,
              conteudo: arquivo,
              mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
              pastaId: PASTA_SLIDES,
            });
            await supabase
              .from("musicas")
              .update({ slides_drive_id: driveId, slides_origem: "gerado" })
              .eq("id", musica.id);
            registrar("Slides criados na pasta do Drive.");
          } catch (e) {
            const motivo = e instanceof ErroDrive ? e.message : String(e);
            registrar(`Não consegui criar os slides (${motivo}). A música fica marcada como 'sem slides'.`);
          }
        }
      }

      registrar("Atualizando o documento Repertório SJ…");
      const resposta = await fetch("/api/repertorio", { method: "POST" });
      registrar(resposta.ok ? "Repertório SJ atualizado." : "Não consegui atualizar o Repertório SJ.");

      router.push(`/musicas/${musica.id}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setSalvando(false);
    }
  }

  const campo =
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

  if (!usuario) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-start gap-4 px-4 py-8">
        <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-600">
          ← Repertório
        </Link>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Adicionar música</h1>
        <p className="text-zinc-500">É preciso entrar com o Google para adicionar música.</p>
        <button
          onClick={entrar}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Entrar com Google
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-8">
      <Link href="/" className="w-fit text-sm text-zinc-400 hover:text-zinc-600">
        ← Repertório
      </Link>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Adicionar música</h1>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Nome da música</span>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={campo} />
      </label>

      {parecidas.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            Já existe algo parecido no repertório:
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {parecidas.map((m) => (
              <li key={m.id}>
                <Link href={`/musicas/${m.id}`} className="text-amber-800 underline dark:text-amber-300">
                  {m.titulo}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Letra <span className="font-normal text-zinc-400">— estrofes separadas por linha em branco</span>
        </span>
        <textarea value={letra} onChange={(e) => setLetra(e.target.value)} rows={8} className={campo} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Cifra <span className="font-normal text-zinc-400">— opcional, acordes acima da letra</span>
        </span>
        <textarea
          value={cifra}
          onChange={(e) => setCifra(e.target.value)}
          rows={8}
          className={`${campo} font-mono text-sm`}
        />
        <span className="text-xs text-zinc-400">
          Se preencher a cifra, ela vira a fonte da letra e das duas versões de cifra.
        </span>
      </label>

      {secoes.length > 0 && (
        <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Prévia — {secoes.length} seção(ões), {blocosDeSlide.length + 1} slides
          </h2>
          {secoes.map((s, i) => (
            <div key={i} className="text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{s.tipo}</p>
              {s.acordes && <pre className="font-mono text-zinc-600 dark:text-zinc-400">{s.acordes}</pre>}
              {s.letra && (
                <p className="whitespace-pre-line text-zinc-800 dark:text-zinc-200">{s.letra}</p>
              )}
            </div>
          ))}
        </section>
      )}

      {progresso.length > 0 && (
        <pre className="whitespace-pre-wrap rounded-lg bg-zinc-100 p-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {progresso.join("\n")}
        </pre>
      )}

      {erro && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">
          {erro}
        </p>
      )}

      <button
        onClick={salvar}
        disabled={salvando || !titulo.trim() || secoes.length === 0}
        className="w-fit rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {salvando ? "Salvando…" : "Adicionar ao repertório"}
      </button>
    </main>
  );
}
