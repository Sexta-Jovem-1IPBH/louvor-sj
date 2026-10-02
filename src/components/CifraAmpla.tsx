import { transporAcorde } from "@/lib/cifras/transpor";

/**
 * Desenha ChordPro ("[G]Enche-me Es[D/F#]pírito") como se lê numa cifra de verdade:
 * o acorde fica acima da sílaba onde ele entra. Mostrar o texto cru com os colchetes
 * é ilegível para quem está tocando.
 */

interface Pedaco {
  acorde: string | null;
  texto: string;
}

export function quebrarChordPro(linha: string): Pedaco[] {
  const pedacos: Pedaco[] = [];
  const regex = /\[([^\]]+)\]/g;

  let ultimoFim = 0;
  let acordePendente: string | null = null;

  for (const m of linha.matchAll(regex)) {
    const texto = linha.slice(ultimoFim, m.index);
    if (texto || acordePendente) pedacos.push({ acorde: acordePendente, texto });
    acordePendente = m[1];
    ultimoFim = m.index + m[0].length;
  }

  const resto = linha.slice(ultimoFim);
  if (resto || acordePendente) pedacos.push({ acorde: acordePendente, texto: resto });

  return pedacos;
}

export function CifraAmpla({ texto, semitons = 0 }: { texto: string; semitons?: number }) {
  return (
    <div className="overflow-x-auto font-mono text-sm leading-tight">
      {texto.split("\n").map((linha, i) => {
        const pedacos = quebrarChordPro(linha);
        const temAcorde = pedacos.some((p) => p.acorde);

        if (!temAcorde) {
          return (
            <p key={i} className="whitespace-pre text-zinc-900 dark:text-zinc-100">
              {linha || " "}
            </p>
          );
        }

        return (
          <p key={i} className="whitespace-pre">
            {pedacos.map((pedaco, j) => (
              <span key={j} className="inline-block align-bottom">
                <span className="block font-semibold text-emerald-700 dark:text-emerald-400">
                  {pedaco.acorde ? transporAcorde(pedaco.acorde, semitons) : " "}
                </span>
                <span className="block text-zinc-900 dark:text-zinc-100">
                  {pedaco.texto || " "}
                </span>
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
