import { getDriveClient } from "../../src/lib/google/client.ts";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import JSZip from "jszip";

const PASTA_SLIDES = "1ae2pC573LtGy06cqkdBiEAdKzET6nG1Y";
const MIME_GOOGLE_SLIDES = "application/vnd.google-apps.presentation";
const MIME_PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const APLICAR = process.argv.includes("--aplicar");
const MAX_SLIDES_MUSICA = 25; // acima disso provavelmente é apresentação de culto inteiro, não uma música
const CACHE = new URL("./out-contagem-slides.json", import.meta.url);

const drive = getDriveClient();

async function contarSlides(arquivo) {
  try {
    let buffer;
    if (arquivo.mimeType === MIME_GOOGLE_SLIDES) {
      const res = await drive.files.export({ fileId: arquivo.id, mimeType: MIME_PPTX }, { responseType: "arraybuffer" });
      buffer = Buffer.from(res.data);
    } else if (arquivo.mimeType === MIME_PPTX) {
      const res = await drive.files.get({ fileId: arquivo.id, alt: "media" }, { responseType: "arraybuffer" });
      buffer = Buffer.from(res.data);
    } else {
      return null;
    }
    const zip = await JSZip.loadAsync(buffer);
    return Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).length;
  } catch {
    return null;
  }
}

function semPrefixo(nome) {
  return nome.replace(/^(Cópia de )+/i, "");
}

function chaveGrupo(nome) {
  return semPrefixo(nome)
    .replace(/\.(pptx?|ppt)$/i, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

const arquivos = [];
let pageToken;
do {
  const res = await drive.files.list({
    q: `'${PASTA_SLIDES}' in parents and trashed = false`,
    fields: "nextPageToken, files(id, name, size, mimeType, modifiedTime)",
    pageSize: 1000,
    pageToken,
  });
  arquivos.push(...(res.data.files ?? []));
  pageToken = res.data.nextPageToken ?? undefined;
} while (pageToken);

const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
const faltando = arquivos.filter((a) => !(a.id in cache));
console.log(`Arquivos na pasta: ${arquivos.length}. Contando slides de ${faltando.length} (resto veio do cache)...`);
for (const a of faltando) {
  cache[a.id] = await contarSlides(a);
  process.stdout.write(".");
}
writeFileSync(CACHE, JSON.stringify(cache, null, 2), "utf8");
for (const a of arquivos) a.numSlides = cache[a.id];
console.log("\n");

const grupos = new Map();
for (const a of arquivos) {
  const chave = chaveGrupo(a.name);
  if (!grupos.has(chave)) grupos.set(chave, []);
  grupos.get(chave).push(a);
}

const planos = [];

for (const [chave, lista] of grupos) {
  const ehSemTitulo = /apresentacao sem titulo/.test(chave);

  // candidatos a "a música de verdade": decks de tamanho plausível, com título
  const candidatos = ehSemTitulo ? [] : lista.filter((a) => a.numSlides !== null && a.numSlides <= MAX_SLIDES_MUSICA);

  candidatos.sort((a, b) => {
    if (b.numSlides !== a.numSlides) return b.numSlides - a.numSlides;
    const prefA = /^Cópia de /i.test(a.name) ? 1 : 0;
    const prefB = /^Cópia de /i.test(b.name) ? 1 : 0;
    if (prefA !== prefB) return prefA - prefB;
    return Number(b.size ?? 0) - Number(a.size ?? 0);
  });

  const mantido = candidatos[0];

  for (const a of lista) {
    const limpo = semPrefixo(a.name);
    let novoNome;
    if (a === mantido) {
      novoNome = limpo;
    } else if (ehSemTitulo || a.numSlides === null || a.numSlides > MAX_SLIDES_MUSICA) {
      novoNome = `ZZ REVISAR - ${limpo} (${a.numSlides ?? "?"} slides)`;
    } else {
      novoNome = `ZZ DUPLICADO - ${limpo}`;
    }
    if (novoNome !== a.name) planos.push({ id: a.id, de: a.name, para: novoNome });
  }
}

const renomeiaLimpo = planos.filter((p) => !/^ZZ /.test(p.para));
const marcaDuplicado = planos.filter((p) => /^ZZ DUPLICADO/.test(p.para));
const marcaRevisar = planos.filter((p) => /^ZZ REVISAR/.test(p.para));

console.log(`Renomear para nome limpo: ${renomeiaLimpo.length}`);
console.log(`Marcar como ZZ DUPLICADO: ${marcaDuplicado.length}`);
console.log(`Marcar como ZZ REVISAR: ${marcaRevisar.length}`);

console.log("\n--- ZZ REVISAR ---");
marcaRevisar.forEach((p) => console.log(`   ${p.de}  ->  ${p.para}`));

if (!APLICAR) {
  console.log("\n(modo prévia — rode com --aplicar para renomear de verdade)");
} else {
  console.log("\nAplicando...");
  let n = 0;
  for (const p of planos) {
    await drive.files.update({ fileId: p.id, requestBody: { name: p.para } });
    n++;
    if (n % 20 === 0) process.stdout.write(` ${n}`);
    else process.stdout.write(".");
  }
  console.log(`\nConcluído: ${planos.length} arquivos renomeados.`);
}
