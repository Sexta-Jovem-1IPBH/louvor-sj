"use client";

import { useState } from "react";
import type { Musica, Secao, Midia } from "@/lib/types";
import { transporLinha, transporTom } from "@/lib/cifras/transpor";
import { secoesUnicas } from "@/lib/cifras/parser";
import { CifraAmpla } from "@/components/CifraAmpla";

type Aba = "letra" | "slides" | "resumida" | "ampla" | "midias";

const ABAS: { id: Aba; label: string }[] = [
  { id: "letra", label: "Letra" },
  { id: "slides", label: "Slides" },
  { id: "resumida", label: "Cifra resumida" },
  { id: "ampla", label: "Cifra ampla" },
  { id: "midias", label: "Mídias" },
];

function ControleTranspor({
  semitons,
  setSemitons,
  tom,
}: {
  semitons: number;
  setSemitons: (n: number) => void;
  tom: string | null;
}) {
  const botao =
    "flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-lg font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700";

  return (
    <div className="flex items-center gap-3 border-b border-zinc-200 pb-3 dark:border-zinc-800">
      <span className="text-sm text-zinc-500">Tom</span>
      <button onClick={() => setSemitons(semitons - 1)} className={botao} aria-label="Abaixar meio tom">
        −
      </button>
      <span className="min-w-14 text-center text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {tom ?? (semitons === 0 ? "original" : `${semitons > 0 ? "+" : ""}${semitons}`)}
      </span>
      <button onClick={() => setSemitons(semitons + 1)} className={botao} aria-label="Subir meio tom">
        +
      </button>
      {semitons !== 0 && (
        <button
          onClick={() => setSemitons(0)}
          className="text-sm text-zinc-500 underline hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          voltar ao original
        </button>
      )}
    </div>
  );
}

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
  const [semitons, setSemitons] = useState(0);

  const cifraClubUrl = `https://www.cifraclub.com.br/?q=${encodeURIComponent(musica.titulo)}`;
  const tomTransposto = transporTom(musica.tom_original, semitons);
  // decisão do Arthur: cada parte aparece uma vez só, aqui e nos slides.
  // O banco segue guardando a sequência como foi colada.
  const secoesCifra = secoesUnicas(secoes);

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
          {secoesCifra.length === 0 && <p className="text-zinc-400">Letra ainda não cadastrada.</p>}
          {secoesCifra.map((secao) => (
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
          <ControleTranspor
            semitons={semitons}
            setSemitons={setSemitons}
            tom={tomTransposto}
          />
          {secoesCifra.every((s) => !s.acordes?.trim()) && (
            <p className="text-zinc-400">Cifra resumida ainda não cadastrada.</p>
          )}
          {secoesCifra
            .filter((s) => s.acordes?.trim())
            .map((secao) => (
              <div key={secao.id}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  {secao.tipo}
                </p>
                <pre className="whitespace-pre-wrap font-mono text-sm text-zinc-900 dark:text-zinc-100">
                  {transporLinha(secao.acordes!, semitons)}
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
          <ControleTranspor
            semitons={semitons}
            setSemitons={setSemitons}
            tom={tomTransposto}
          />
          {secoesCifra.every((s) => !s.letra_cifrada?.trim()) && (
            <p className="text-zinc-400">Cifra ampla ainda não cadastrada.</p>
          )}
          {secoesCifra
            .filter((s) => s.letra_cifrada?.trim())
            .map((secao) => (
              <div key={secao.id}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  {secao.tipo}
                </p>
                <CifraAmpla texto={secao.letra_cifrada!} semitons={semitons} />
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
