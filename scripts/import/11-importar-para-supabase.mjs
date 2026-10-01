// Monta as músicas a partir das três fontes (Repertório SJ, documento de cifras, slides)
// e grava no Supabase. Rode com --aplicar para gravar de verdade.
//
// Alinhamento letra x acordes: as duas fontes são independentes e têm quantidades
// diferentes de blocos, então as seções entram pareadas por índice ("Parte 1, Parte 2…"),
// como previsto no CLAUDE.md — a rotulagem correta fica para depois, na interface.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const APLICAR = process.argv.includes("--aplicar");

const titulosRepertorio = JSON.parse(readFileSync(new URL("./out-titulos-repertorio.json", import.meta.url), "utf8"));
const cifras = JSON.parse(readFileSync(new URL("./out-cifras-musicas.json", import.meta.url), "utf8"));
const slides = JSON.parse(readFileSync(new URL("./out-slides.json", import.meta.url), "utf8"));
const casamento = JSON.parse(readFileSync(new URL("./out-casamento.json", import.meta.url), "utf8"));

function normalizar(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// índices auxiliares
const slidesPorArquivo = new Map(slides.map((s) => [s.arquivo, s]));
const cifraPorTitulo = new Map(cifras.map((c) => [normalizar(c.titulo), c]));

// 1) monta a lista final de músicas
const musicas = new Map(); // chave normalizada -> { titulo, slideArquivo }

for (const t of titulosRepertorio) {
  musicas.set(normalizar(t), { titulo: t, slideArquivo: null });
}

for (const c of casamento.casados) {
  const chave = normalizar(c.casouCom);
  const m = musicas.get(chave);
  if (m) m.slideArquivo = c.arquivo;
}

for (const n of casamento.novas) {
  const titulo = n.arquivo.replace(/\.pptx?$/i, "").trim();
  const chave = normalizar(titulo);
  if (musicas.has(chave)) {
    musicas.get(chave).slideArquivo ??= n.arquivo;
  } else {
    musicas.set(chave, { titulo, slideArquivo: n.arquivo, nova: true });
  }
}

// 2) monta as seções de cada música
const registros = [];
for (const [chave, m] of musicas) {
  const blocosLetra = [];
  let slidesDriveId = null;

  if (m.slideArquivo) {
    const s = slidesPorArquivo.get(m.slideArquivo);
    if (s) {
      slidesDriveId = s.driveId;
      // o primeiro slide é o de título; os demais são blocos de letra
      for (const bloco of s.slides.slice(1)) {
        const texto = bloco.join("\n").trim();
        if (texto) blocosLetra.push(texto);
      }
    }
  }

  const partesAcordes = cifraPorTitulo.get(chave)?.partes ?? [];

  const total = Math.max(blocosLetra.length, partesAcordes.length);
  const secoes = [];
  for (let i = 0; i < total; i++) {
    secoes.push({
      ordem: i + 1,
      tipo: `Parte ${i + 1}`,
      letra: blocosLetra[i] ?? null,
      acordes: partesAcordes[i] ?? null,
      letra_cifrada: null,
    });
  }

  registros.push({
    titulo: m.titulo,
    titulo_normalizado: chave,
    slides_drive_id: slidesDriveId,
    slides_origem: slidesDriveId ? "manual" : null,
    nova: !!m.nova,
    secoes,
  });
}

registros.sort((a, b) => a.titulo_normalizado.localeCompare(b.titulo_normalizado, "pt-BR"));

const comLetra = registros.filter((r) => r.secoes.some((s) => s.letra));
const comAcordes = registros.filter((r) => r.secoes.some((s) => s.acordes));
const comSlides = registros.filter((r) => r.slides_drive_id);

console.log(`Músicas a importar: ${registros.length}`);
console.log(`   com letra:   ${comLetra.length}`);
console.log(`   com acordes: ${comAcordes.length}`);
console.log(`   com slides:  ${comSlides.length}`);
console.log(`   novas (vieram só dos slides): ${registros.filter((r) => r.nova).length}`);
console.log(`Total de seções: ${registros.reduce((acc, r) => acc + r.secoes.length, 0)}`);

if (!APLICAR) {
  console.log("\nExemplo (primeira música com letra e acordes):");
  const exemplo = registros.find((r) => r.secoes.some((s) => s.letra) && r.secoes.some((s) => s.acordes));
  console.log(JSON.stringify({ ...exemplo, secoes: exemplo.secoes.slice(0, 3) }, null, 2));
  console.log("\n(modo prévia — rode com --aplicar para gravar no Supabase)");
  process.exit(0);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

console.log("\nGravando no Supabase...");
let n = 0;
for (const r of registros) {
  const { data: musica, error: erroMusica } = await supabase
    .from("musicas")
    .insert({
      titulo: r.titulo,
      titulo_normalizado: r.titulo_normalizado,
      slides_drive_id: r.slides_drive_id,
      slides_origem: r.slides_origem,
    })
    .select("id")
    .single();

  if (erroMusica) {
    console.log(`\nERRO ao inserir "${r.titulo}": ${erroMusica.message}`);
    continue;
  }

  if (r.secoes.length) {
    const { error: erroSecoes } = await supabase
      .from("secoes")
      .insert(r.secoes.map((s) => ({ ...s, musica_id: musica.id })));
    if (erroSecoes) console.log(`\nERRO nas seções de "${r.titulo}": ${erroSecoes.message}`);
  }

  n++;
  if (n % 25 === 0) process.stdout.write(` ${n}`);
  else process.stdout.write(".");
}
console.log(`\nConcluído: ${n} músicas importadas.`);
