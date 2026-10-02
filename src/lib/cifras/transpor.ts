const SUSTENIDOS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const BEMOIS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

const NOTA = /^[A-G][#b]?/;
const BAIXO = /\/([A-G][#b]?)$/;

function indiceDaNota(nota: string): number {
  const i = SUSTENIDOS.indexOf(nota);
  return i !== -1 ? i : BEMOIS.indexOf(nota);
}

function transporNota(nota: string, semitons: number): string {
  const i = indiceDaNota(nota);
  if (i === -1) return nota;
  const destino = (((i + semitons) % 12) + 12) % 12;
  // mantém o estilo do original: quem escreveu bemol continua lendo bemol
  return nota.includes("b") ? BEMOIS[destino] : SUSTENIDOS[destino];
}

/** Transpõe um acorde isolado, ex.: "Bm7/A" -> "C#m7/B". Devolve o texto original se não for acorde. */
export function transporAcorde(acorde: string, semitons: number): string {
  const raiz = acorde.match(NOTA)?.[0];
  if (!raiz) return acorde;

  const baixo = acorde.match(BAIXO)?.[1];
  const miolo = acorde.slice(raiz.length, baixo ? acorde.length - baixo.length - 1 : undefined);

  const novaRaiz = transporNota(raiz, semitons);
  const novoBaixo = baixo ? `/${transporNota(baixo, semitons)}` : "";
  return `${novaRaiz}${miolo}${novoBaixo}`;
}

/** Transpõe uma linha de cifra, preservando espaçamento, parênteses e marcadores como "(x2)". */
export function transporLinha(linha: string, semitons: number): string {
  if (semitons === 0) return linha;
  return linha.replace(/[^\s]+/g, (token) => {
    const abre = token.match(/^[(\[]+/)?.[0] ?? "";
    const fecha = token.match(/[)\],]+$/)?.[0] ?? "";
    const nucleo = token.slice(abre.length, token.length - fecha.length);
    if (!NOTA.test(nucleo)) return token;
    return `${abre}${transporAcorde(nucleo, semitons)}${fecha}`;
  });
}

/** Transpõe cifra ampla em ChordPro, ex.: "[A]Meu Jesus" -> "[B]Meu Jesus". */
export function transporChordPro(texto: string, semitons: number): string {
  if (semitons === 0) return texto;
  return texto.replace(/\[([^\]]+)\]/g, (_, acorde) => `[${transporAcorde(acorde, semitons)}]`);
}

/** Nome do tom resultante, para mostrar na interface. */
export function transporTom(tom: string | null, semitons: number): string | null {
  if (!tom) return null;
  return transporAcorde(tom, semitons);
}
