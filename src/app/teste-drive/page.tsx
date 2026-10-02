"use client";

// Página de diagnóstico, temporária: responde se o escopo drive.file consegue
// criar arquivo dentro de uma pasta que já existe, passando só o ID dela.
// Se não conseguir, o caminho é o Google Picker (ver CLAUDE.md).

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ESCOPO_DRIVE } from "@/lib/supabase/escopos";

const PASTA_SLIDES = "1ae2pC573LtGy06cqkdBiEAdKzET6nG1Y";

export default function TesteDrive() {
  const [token, setToken] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<string[]>([]);
  const [rodando, setRodando] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data }) => setToken(data.session?.provider_token ?? null));
  }, []);

  function log(texto: string) {
    setLinhas((anteriores) => [...anteriores, texto]);
  }

  async function entrar() {
    await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback?next=/teste-drive`,
        scopes: ESCOPO_DRIVE,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
  }

  async function testar() {
    if (!token) return;
    setRodando(true);
    setLinhas([]);

    const metadados = {
      name: "_teste-claude-pode-apagar.txt",
      parents: [PASTA_SLIDES],
      mimeType: "text/plain",
    };

    try {
      log("Criando arquivo dentro da pasta Slides…");
      const resposta = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name,parents", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(metadados),
      });
      const corpo = await resposta.json();

      if (!resposta.ok) {
        log(`FALHOU (${resposta.status}): ${corpo.error?.message ?? "erro desconhecido"}`);
        log("→ Conclusão: vai ser necessário o Google Picker para a pessoa escolher a pasta uma vez.");
        return;
      }

      log(`SUCESSO: arquivo criado (id ${corpo.id}).`);
      log(`Pasta de destino confirmada: ${JSON.stringify(corpo.parents)}`);
      log("→ Conclusão: dá para criar direto pelo ID da pasta, sem Picker.");

      log("Apagando o arquivo de teste…");
      const apagar = await fetch(`https://www.googleapis.com/drive/v3/files/${corpo.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      log(apagar.ok ? "Arquivo de teste apagado." : `Não consegui apagar (${apagar.status}) — apague à mão.`);
    } catch (erro) {
      log(`Erro inesperado: ${erro instanceof Error ? erro.message : String(erro)}`);
    } finally {
      setRodando(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-8">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        Diagnóstico: criação de arquivo no Drive
      </h1>
      <p className="text-sm text-zinc-500">
        Testa se o app consegue criar um arquivo dentro da pasta de Slides usando o seu login do
        Google. O arquivo criado é apagado em seguida.
      </p>

      {!token ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-zinc-500">
            Preciso de um login recente para ter o token do Google em mãos.
          </p>
          <button
            onClick={entrar}
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Entrar com Google
          </button>
        </div>
      ) : (
        <button
          onClick={testar}
          disabled={rodando}
          className="w-fit rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {rodando ? "Testando…" : "Rodar teste"}
        </button>
      )}

      {linhas.length > 0 && (
        <pre className="whitespace-pre-wrap rounded-lg bg-zinc-100 p-4 font-mono text-sm text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
          {linhas.join("\n")}
        </pre>
      )}
    </main>
  );
}
