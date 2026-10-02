"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { ESCOPO_DRIVE } from "@/lib/supabase/escopos";

export function BotaoLogin() {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUsuario(data.user);
      setCarregando(false);
    });
    const { data: inscricao } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      setUsuario(sessao?.user ?? null);
    });
    return () => inscricao.subscription.unsubscribe();
  }, []);

  async function entrar() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback`,
        scopes: ESCOPO_DRIVE,
        // necessários para o Google devolver um token que o servidor possa renovar
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
  }

  async function sair() {
    const supabase = createClient();
    await supabase.auth.signOut();
    location.reload();
  }

  if (carregando) return <span className="text-sm text-zinc-400">…</span>;

  if (!usuario) {
    return (
      <button
        onClick={entrar}
        className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Entrar com Google
      </button>
    );
  }

  const nome = (usuario.user_metadata?.name as string | undefined) ?? usuario.email ?? "";

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-zinc-500">{nome.split(" ")[0]}</span>
      <button onClick={sair} className="text-zinc-400 underline hover:text-zinc-700 dark:hover:text-zinc-200">
        sair
      </button>
    </div>
  );
}
