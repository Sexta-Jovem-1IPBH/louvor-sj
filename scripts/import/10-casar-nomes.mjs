import { readFileSync, writeFileSync } from "node:fs";

const titulosRepertorio = JSON.parse(readFileSync(new URL("./out-titulos-repertorio.json", import.meta.url), "utf8"));
const slides = JSON.parse(readFileSync(new URL("./out-slides.json", import.meta.url), "utf8"));

const LIMIAR_ALTO = 0.86;
const LIMIAR_MEDIO = 0.6;

// Divergências de nome conhecidas (documentadas no CLAUDE.md), que a semelhança não pega
// chave = nome já normalizado (a normalização remove "Hino <número>" e parênteses)
const APELIDOS = new Map([["hino da mocidade", "Mocidade presbiteriana (Hino)"]]);

// Arquivos que não são uma música própria (conteúdo repetido de outra)
const NAO_SAO_MUSICAS = new Set(["SJ.pptx"]);

function normalizar(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\.(pptx?|ppt)$/i, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\bhino\s*\d+\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let anterior = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const atual = [i];
    for (let j = 1; j <= n; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      atual[j] = Math.min(anterior[j] + 1, atual[j - 1] + 1, anterior[j - 1] + custo);
    }
    anterior = atual;
  }
  return anterior[n];
}

function similaridade(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const maior = Math.max(a.length, b.length);
  const porEdicao = 1 - levenshtein(a, b) / maior;

  // bônus: um título contido no outro (ex.: "o nosso general" em "o nosso general e cristo")
  const contido = a.includes(b) || b.includes(a) ? 0.9 : 0;

  // sobreposição de palavras
  const pa = new Set(a.split(" "));
  const pb = new Set(b.split(" "));
  const comuns = [...pa].filter((p) => pb.has(p)).length;
  const porPalavra = comuns / Math.max(pa.size, pb.size);

  return Math.max(porEdicao, contido, porPalavra * 0.95);
}

const repertorio = titulosRepertorio.map((t) => ({ original: t, norm: normalizar(t) }));
const usados = new Set();

const candidatos = slides.map((s) => {
  const tituloInterno = s.slides[0]?.join(" ") ?? "";
  return {
    arquivo: s.arquivo,
    driveId: s.driveId,
    tituloInterno,
    normArquivo: normalizar(s.arquivo),
    normInterno: normalizar(tituloInterno),
    numSlides: s.slides.length,
  };
});

// 0ª passada: apelidos conhecidos
for (const c of candidatos) {
  const alvo = APELIDOS.get(c.normArquivo) ?? APELIDOS.get(c.normInterno);
  if (!alvo) continue;
  const i = repertorio.findIndex((r) => r.original === alvo);
  if (i !== -1 && !usados.has(i)) {
    c.casouCom = repertorio[i].original;
    c.score = 1;
    c.via = "apelido conhecido (CLAUDE.md)";
    usados.add(i);
  }
}

// 1ª passada: match exato pelo nome do arquivo (mais confiável)
for (const c of candidatos) {
  const i = repertorio.findIndex((r, idx) => !usados.has(idx) && r.norm === c.normArquivo);
  if (i !== -1) {
    c.casouCom = repertorio[i].original;
    c.score = 1;
    c.via = "nome do arquivo (exato)";
    usados.add(i);
  }
}

// 2ª passada: match exato pelo título dentro do slide
for (const c of candidatos.filter((x) => !x.casouCom)) {
  const i = repertorio.findIndex((r, idx) => !usados.has(idx) && r.norm === c.normInterno);
  if (i !== -1) {
    c.casouCom = repertorio[i].original;
    c.score = 1;
    c.via = "título dentro do slide (exato)";
    usados.add(i);
  }
}

// 3ª passada: similaridade, melhor par primeiro
const pendentes = candidatos.filter((x) => !x.casouCom);
const pares = [];
for (const c of pendentes) {
  for (let i = 0; i < repertorio.length; i++) {
    if (usados.has(i)) continue;
    const s1 = similaridade(c.normArquivo, repertorio[i].norm);
    const s2 = similaridade(c.normInterno, repertorio[i].norm);
    const score = Math.max(s1, s2);
    if (score >= LIMIAR_MEDIO) {
      pares.push({ c, idx: i, score, via: s1 >= s2 ? "nome do arquivo" : "título dentro do slide" });
    }
  }
}
pares.sort((a, b) => b.score - a.score);
for (const p of pares) {
  if (p.c.casouCom || usados.has(p.idx)) continue;
  p.c.casouCom = repertorio[p.idx].original;
  p.c.score = p.score;
  p.c.via = `semelhança por ${p.via}`;
  usados.add(p.idx);
}

// classificação final
const ignorados = candidatos.filter((c) => NAO_SAO_MUSICAS.has(c.arquivo));
const uteis = candidatos.filter((c) => !NAO_SAO_MUSICAS.has(c.arquivo));

const casados = uteis.filter((c) => c.casouCom && c.score >= LIMIAR_ALTO);
const recusados = uteis.filter((c) => c.casouCom && c.score < LIMIAR_ALTO); // semelhança fraca: tratar como música nova
const semMatch = uteis.filter((c) => !c.casouCom);
const novas = [...recusados, ...semMatch];

// devolve ao repertório os títulos que tinham sido consumidos por um match fraco
for (const c of recusados) {
  const i = repertorio.findIndex((r) => r.original === c.casouCom);
  if (i !== -1) usados.delete(i);
  c.matchRecusado = c.casouCom;
  delete c.casouCom;
}
const repertorioSemSlide = repertorio.filter((_, i) => !usados.has(i));

console.log(`Slides casados com o repertório: ${casados.length}`);
console.log(`Músicas novas (slide existe, não está no repertório): ${novas.length}`);
console.log(`Arquivos ignorados (não são música própria): ${ignorados.length}`);
console.log(`Músicas do repertório que seguem sem slide: ${repertorioSemSlide.length}`);

console.log("\n--- SEMELHANÇA FRACA, RECUSADA (viram música nova) ---");
recusados.forEach((c) =>
  console.log(`  "${c.arquivo}" ~ "${c.matchRecusado}" (${(c.score * 100).toFixed(0)}%) -> tratado como música nova`),
);

console.log("\n--- MÚSICAS NOVAS A ENTRAR NO REPERTÓRIO ---");
novas.forEach((c) => console.log(`  ${c.arquivo.replace(/\.pptx?$/i, "")} (${c.numSlides} slides)`));

console.log("\n--- REPERTÓRIO SEM SLIDE ---");
repertorioSemSlide.forEach((r) => console.log(`  ${r.original}`));

writeFileSync(
  new URL("./out-casamento.json", import.meta.url),
  JSON.stringify({ casados, novas, ignorados, repertorioSemSlide }, null, 2),
  "utf8",
);
console.log("\nSalvo em out-casamento.json");
