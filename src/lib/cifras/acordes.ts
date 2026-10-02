/**
 * Vocabulário de acordes usado para decidir se uma linha é cifra ou letra.
 * Foi montado contra o documento real "(Todas as cifras).docx" da igreja, então
 * cobre a notação brasileira que aparece lá: 7M, A4, º, °, ø, além do padrão.
 * Mexer aqui afeta tanto a importação quanto o parser de cifra colada.
 */

const QUALIDADE = "(?:maj7|maj|dim7|dim|aug|sus2|sus4|sus|add9|add11|add13|add2|add4|m7|m9|m|º|°|ø)?";
const EXTENSAO = "(?:7M|9M|11M|13M|2|4|5|6|7|9|11|13)?";
const NOTA = `[A-G](?:#|b)?${QUALIDADE}${EXTENSAO}`;

export const ACORDE = new RegExp(`^${NOTA}(?:\\/${NOTA})?$`);

/** Duas notas grudadas ("GA"), artefato de exportação do .docx que vale aceitar. */
const DUAS_NOTAS_GRUDADAS = /^[A-G]{2}$/;

const PALAVRAS_SECAO =
  "(?:intro|introdu[çc][ãa]o|verso|estrofe|refr[ãa]o|pr[ée][\\s-]?refr[ãa]o|ponte|bridge|solo|interl[úu]dio|final|coda|parte|pre[\\s-]?chorus|chorus)";

/**
 * Rótulo de seção, com o que vier depois dele capturado à parte.
 * Cobre tanto "Refrão" sozinho quanto "Intro: D A Bm G", que é como a maioria
 * das cifras da internet vem escrita.
 */
export const ROTULO_SECAO = new RegExp(`^\\s*(${PALAVRAS_SECAO}\\s*\\d*)\\s*:?\\s*(.*)$`, "i");

export function limparToken(token: string): string {
  return token.replace(/^[(\[,]+/, "").replace(/[)\],]+$/, "");
}

/** Marcadores que não são acorde mas também não invalidam a linha: "x2", "4", "(x4)". */
export function ehMarcador(token: string): boolean {
  return token === "" || /^x\d*$/i.test(token) || /^\d+$/.test(token);
}

export function ehAcorde(token: string): boolean {
  return ACORDE.test(token) || DUAS_NOTAS_GRUDADAS.test(token);
}

/** Verdadeiro quando todos os tokens da linha são acordes (ou marcadores). */
export function ehLinhaDeAcordes(linha: string): boolean {
  const tokens = linha
    .trim()
    .split(/\s+/)
    .map(limparToken)
    .filter((t) => !ehMarcador(t));
  if (tokens.length === 0) return false;
  return tokens.every(ehAcorde);
}

/** Acordes de uma linha, na ordem, já sem parênteses e marcadores. */
export function acordesDaLinha(linha: string): string[] {
  return linha
    .trim()
    .split(/\s+/)
    .map(limparToken)
    .filter((t) => !ehMarcador(t) && ehAcorde(t));
}

/** Posição (coluna) de cada acorde na linha, para alinhar com a letra embaixo. */
export function acordesComPosicao(linha: string): { acorde: string; coluna: number }[] {
  const encontrados: { acorde: string; coluna: number }[] = [];
  for (const m of linha.matchAll(/\S+/g)) {
    const token = limparToken(m[0]);
    if (ehMarcador(token) || !ehAcorde(token)) continue;
    encontrados.push({ acorde: token, coluna: m.index ?? 0 });
  }
  return encontrados;
}
