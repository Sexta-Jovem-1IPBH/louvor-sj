"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BadgeStatus } from "@/components/BadgeStatus";
import type { MusicaComStatus } from "@/lib/types";

type Filtro = "todas" | "sem-slides" | "sem-cifra";

export function RepertorioList({ musicas }: { musicas: MusicaComStatus[] }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");

  const musicasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return musicas
      .filter((m) => (termo ? m.titulo.toLowerCase().includes(termo) : true))
      .filter((m) => {
        if (filtro === "sem-slides") return !m.temSlides;
        if (filtro === "sem-cifra") return !m.temResumida;
        return true;
      });
  }, [musicas, busca, filtro]);

  return (
    <div className="flex w-full flex-col gap-4">
      <input
        type="search"
        placeholder="Buscar música..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />

      <div className="flex gap-2 text-sm">
        {(
          [
            ["todas", "Todas"],
            ["sem-slides", "Sem slides"],
            ["sem-cifra", "Sem cifra"],
          ] as [Filtro, string][]
        ).map(([valor, label]) => (
          <button
            key={valor}
            onClick={() => setFiltro(valor)}
            className={
              "rounded-full px-3 py-1 font-medium transition-colors " +
              (filtro === valor
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700")
            }
          >
            {label}
          </button>
        ))}
      </div>

      <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
        {musicasFiltradas.map((musica) => (
          <li key={musica.id}>
            <Link
              href={`/musicas/${musica.id}`}
              className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {musica.titulo}
              </span>
              <span className="flex flex-wrap gap-1.5">
                <BadgeStatus ativo={musica.temLetra} label="Letra" />
                <BadgeStatus ativo={musica.temSlides} label="Slides" />
                <BadgeStatus ativo={musica.temResumida} label="Resumida" />
                <BadgeStatus ativo={musica.temAmpla} label="Ampla" />
                <BadgeStatus ativo={musica.numMidias > 0} label={`${musica.numMidias} mídia(s)`} />
              </span>
            </Link>
          </li>
        ))}

        {musicasFiltradas.length === 0 && (
          <li className="py-6 text-center text-zinc-400">Nenhuma música encontrada.</li>
        )}
      </ul>
    </div>
  );
}
