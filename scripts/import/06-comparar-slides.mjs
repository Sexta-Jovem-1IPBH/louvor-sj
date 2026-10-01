import { readFileSync, writeFileSync } from "node:fs";

const titulosRepertorio = JSON.parse(readFileSync(new URL("./out-titulos-repertorio.json", import.meta.url), "utf8"));
const slides = JSON.parse(readFileSync(new URL("./out-slides.json", import.meta.url), "utf8"));

function normalizar(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\.pptx?$/i, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const repNorm = titulosRepertorio.map((t) => ({ original: t, norm: normalizar(t) }));
const slidesNorm = slides.map((s) => ({
  arquivo: s.arquivo,
  norm: normalizar(s.arquivo),
  tituloNoSlide: s.slides[0]?.[0] ?? "",
  numSlides: s.slides.length,
}));

const repUsados = new Set();
const batidos = [];

for (const s of slidesNorm) {
  const j = repNorm.findIndex((r, idx) => !repUsados.has(idx) && r.norm === s.norm);
  if (j !== -1) {
    batidos.push({ repertorio: repNorm[j].original, arquivo: s.arquivo });
    repUsados.add(j);
    s.casou = true;
  }
}

const slidesSemMatch = slidesNorm.filter((s) => !s.casou);

console.log(`Slides que bateram com o repertório: ${batidos.length} de ${slides.length}`);
console.log(`\nSlides SEM correspondência no Repertório SJ — ${slidesSemMatch.length}:`);
slidesSemMatch.forEach((s) =>
  console.log(`  - arquivo: "${s.arquivo}" | título dentro do slide: "${s.tituloNoSlide}"`),
);

writeFileSync(
  new URL("./out-comparacao-slides.json", import.meta.url),
  JSON.stringify({ batidos, slidesSemMatch }, null, 2),
  "utf8",
);
