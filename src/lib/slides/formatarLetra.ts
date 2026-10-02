import { ehLinhaDeAcordes } from "../cifras/acordes.ts";

/**
 * Deixa a letra no padrão dos slides da equipe: linhas de tamanho parecido, sem
 * vírgula e com a primeira letra maiúscula.
 *
 * O problema que isso resolve: numa cifra colada as quebras de linha seguem o
 * desenho dos acordes, não as frases cantadas. "Oh dá-me falar cada dia, com
 * salmos hinos de" / "amor" são uma frase só, partida porque o acorde seguinte
 * ficava em cima de "amor".
 */

/** Palavras que não terminam frase: se a linha acaba numa delas, a de baixo é continuação. */
const CONECTORES = new Set([
  "de", "da", "do", "das", "dos", "e", "ou", "com", "sem", "que", "em", "a", "o", "as", "os",
  "para", "pra", "por", "no", "na", "nos", "nas", "ao", "aos", "à", "às", "um", "uma", "uns",
  "umas", "meu", "minha", "seu", "sua", "teu", "tua", "nosso", "nossa", "se", "mas", "como",
]);

/** Acima disso a linha é quebrada em duas de tamanho parecido. */
const LIMITE_DA_LINHA = 34;

function ultimaPalavra(linha: string): string {
  return (
    linha
      .toLowerCase()
      .replace(/[^\p{L}\s]/gu, "")
      .trim()
      .split(/\s+/)
      .pop() ?? ""
  );
}

function maiusculaInicial(linha: string): string {
  return linha.charAt(0).toLocaleUpperCase("pt-BR") + linha.slice(1);
}

/**
 * Quebra a linha em partes de tamanho parecido. A vírgula tem preferência como
 * ponto de corte: ela marca onde a frase respira. "Enche-me Espírito, mais que
 * cheio quero estar" quebrado no meio sai ruim; quebrado na vírgula, sai certo.
 * As vírgulas são removidas depois, já cumprido esse papel.
 */
function quebrarEquilibrado(linha: string): string[] {
  if (linha.length <= LIMITE_DA_LINHA) return [linha];

  const meio = linha.length / 2;

  const cortesPorVirgula = [...linha.matchAll(/,\s+/g)].map((m) => ({
    fim: m.index,
    inicio: m.index + m[0].length,
  }));

  const cortes = cortesPorVirgula.length
    ? cortesPorVirgula
    : [...linha.matchAll(/\s+/g)].map((m) => ({ fim: m.index, inicio: m.index + m[0].length }));

  if (!cortes.length) return [linha];

  const melhor = cortes.reduce((a, b) =>
    Math.abs(a.fim - meio) <= Math.abs(b.fim - meio) ? a : b,
  );

  return [
    ...quebrarEquilibrado(linha.slice(0, melhor.fim).trim()),
    ...quebrarEquilibrado(linha.slice(melhor.inicio).trim()),
  ];
}

export function formatarParaSlide(texto: string): string {
  const linhas = texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    // acorde que escapou para a letra (acontece com cifra colada) não vai para o slide
    .filter((l) => !ehLinhaDeAcordes(l));

  // junta as continuações: linha que termina em conector puxa a de baixo
  const frases: string[] = [];
  for (const linha of linhas) {
    const anterior = frases[frases.length - 1];
    if (anterior && CONECTORES.has(ultimaPalavra(anterior))) {
      frases[frases.length - 1] = `${anterior} ${linha}`;
    } else {
      frases.push(linha);
    }
  }

  return frases
    .map((frase) => frase.replace(/\s+/g, " ").trim())
    .flatMap(quebrarEquilibrado)
    .map((linha) => maiusculaInicial(linha.replace(/,/g, "").trim()))
    .join("\n");
}
