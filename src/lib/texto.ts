/** Forma normalizada do título, usada para busca e para comparar nomes parecidos. */
export function normalizarTitulo(titulo: string): string {
  return titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function levenshtein(a: string, b: string): number {
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let anterior = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const atual = [i];
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      atual[j] = Math.min(anterior[j] + 1, atual[j - 1] + 1, anterior[j - 1] + custo);
    }
    anterior = atual;
  }
  return anterior[b.length];
}

/** 0 a 1. Combina distância de edição com sobreposição de palavras e "um contém o outro". */
export function similaridade(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const porEdicao = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
  const contido = a.includes(b) || b.includes(a) ? 0.9 : 0;

  const pa = new Set(a.split(" "));
  const pb = new Set(b.split(" "));
  const comuns = [...pa].filter((p) => pb.has(p)).length;
  const porPalavra = (comuns / Math.max(pa.size, pb.size)) * 0.95;

  return Math.max(porEdicao, contido, porPalavra);
}
