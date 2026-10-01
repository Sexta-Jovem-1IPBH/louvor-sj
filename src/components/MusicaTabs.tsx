"use client";

import { useState } from "react";
import type { Musica, Secao, Midia } from "@/lib/types";

type Aba = "letra" | "slides" | "resumida" | "ampla" | "midias";

const ABAS: { id: Aba; label: string }[] = [
  { id: "letra", label: "Letra" },
  { id: "slides", label: "Slides" },
  { id: "resumida", label: "Cifra resumida" },
  { id: "ampla", label: "Cifra ampla" },
  { id: "midias", label: "Mídias" },
];

export function MusicaTabs({
  musica,
  secoes,
  midias,
}: {
  musica: Musica;
  secoes: Secao[];
  midias: Midia[];
}) {
  const [aba, setAba] = useState<Aba>("letra");

  const cifraClubUrl = `https://www.cifraclub.com.br/?q=${encodeURIComponent(musica.titulo)}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800">
        {ABAS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setAba(tab.id)}
            className={
              "shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors " +
              (aba === tab.id
                ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300")
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {aba === "letra" && (
        <div className="flex flex-col gap-6">
          {secoes.length === 0 && <p className="text-zinc-400">Letra ainda não cadastrada.</p>}
          {secoes.map((secao) => (
            <div key={secao.id}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                {secao.tipo}
              </p>
              <p className="whitespace-pre-line text-zinc-900 dark:text-zinc-100">
                {secao.letra}
              </p>
            </div>
          ))}
        </div>
      )}

      {aba === "slides" && (
        <div className="flex flex-col gap-3">
          {musica.slides_drive_id ? (
            <iframe
              src={`https://drive.google.com/file/d/${musica.slides_drive_id}/preview`}
              className="aspect-video w-full rounded-lg border border-zinc-200 dark:border-zinc-800"
              allow="fullscreen"
              allowFullScreen
            />
          ) : (
            <p className="text-zinc-400">Slides ainda não gerados para esta música.</p>
          )}
        </div>
      )}

      {aba === "resumida" && (
        <div className="flex flex-col gap-4">
          {secoes.every((s) => !s.acordes?.trim()) && (
            <p className="text-zinc-400">Cifra resumida ainda não cadastrada.</p>
          )}
          {secoes
            .filter((s) => s.acordes?.trim())
            .map((secao) => (
              <div key={secao.id}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  {secao.tipo}
                </p>
                <pre className="whitespace-pre-wrap font-mono text-sm text-zinc-900 dark:text-zinc-100">
                  {secao.acordes}
                </pre>
              </div>
            ))}
          <a
            href={cifraClubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-fit rounded-full bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            Buscar no Cifra Club ↗
          </a>
        </div>
      )}

      {aba === "ampla" && (
        <div className="flex flex-col gap-4">
          {secoes.every((s) => !s.letra_cifrada?.trim()) && (
            <p className="text-zinc-400">Cifra ampla ainda não cadastrada.</p>
          )}
          {secoes
            .filter((s) => s.letra_cifrada?.trim())
            .map((secao) => (
              <div key={secao.id}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  {secao.tipo}
                </p>
                <pre className="whitespace-pre-wrap font-mono text-sm text-zinc-900 dark:text-zinc-100">
                  {secao.letra_cifrada}
                </pre>
              </div>
            ))}
        </div>
      )}

      {aba === "midias" && (
        <div className="flex flex-col gap-2">
          {midias.length === 0 && <p className="text-zinc-400">Nenhuma mídia enviada ainda.</p>}
          {midias.map((midia) => (
            <div
              key={midia.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
            >
              <span>{midia.tipo ?? "mídia"} — {midia.voz_instrumento ?? "—"}</span>
              <a
                href={`https://drive.google.com/file/d/${midia.drive_file_id}/view`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-500 underline hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                abrir
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
