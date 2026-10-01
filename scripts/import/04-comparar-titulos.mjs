import { readFileSync, writeFileSync } from "node:fs";

const titulosRepertorio = JSON.parse(readFileSync(new URL("./out-titulos-repertorio.json", import.meta.url), "utf8"));
const musicasCifras = JSON.parse(readFileSync(new URL("./out-cifras-musicas.json", import.meta.url), "utf8"));

function normalizar(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "") // remove referências bíblicas entre parênteses
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const repNorm = titulosRepertorio.map((t) => ({ original: t, norm: normalizar(t) }));
const cifNorm = musicasCifras.map((m) => ({ original: m.titulo, norm: normalizar(m.titulo), partes: m.partes.length }));

const repUsados = new Set();
const cifUsados = new Set();
const batidos = [];

// 1) match exato
for (let i = 0; i < cifNorm.length; i++) {
  const j = repNorm.findIndex((r, idx) => !repUsados.has(idx) && r.norm === cifNorm[i].norm);
  if (j !== -1) {
    batidos.push({ repertorio: repNorm[j].original, cifras: cifNorm[i].original, partes: cifNorm[i].partes });
    repUsados.add(j);
    cifUsados.add(i);
  }
}

const repSemMatch = repNorm.filter((_, idx) => !repUsados.has(idx));
const cifSemMatch = cifNorm.filter((_, idx) => !cifUsados.has(idx));

console.log(`Bateram exato (normalizado): ${batidos.length}`);
console.log(`\nSó no Repertório SJ (sem cifra) — ${repSemMatch.length}:`);
repSemMatch.forEach((r) => console.log(`  - ${r.original}`));
console.log(`\nSó no doc de Cifras (não está no Repertório) — ${cifSemMatch.length}:`);
cifSemMatch.forEach((c) => console.log(`  - ${c.original} (${c.partes} parte(s))`));

writeFileSync(
  new URL("./out-comparacao-titulos.json", import.meta.url),
  JSON.stringify({ batidos, repSemMatch, cifSemMatch }, null, 2),
  "utf8",
);
