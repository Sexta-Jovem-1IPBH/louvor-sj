import { getDriveClient } from "../../src/lib/google/client.ts";
import { writeFileSync } from "node:fs";
import JSZip from "jszip";

const PASTA_SLIDES = "1ae2pC573LtGy06cqkdBiEAdKzET6nG1Y";
const MIME_GOOGLE_SLIDES = "application/vnd.google-apps.presentation";
const MIME_PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const drive = getDriveClient();

function extrairTextoDoSlideXml(xml) {
  const paragrafos = xml.match(/<a:p>.*?<\/a:p>/gs) ?? [];
  const linhas = [];
  for (const paragrafo of paragrafos) {
    let atual = "";
    for (const m of paragrafo.matchAll(/<a:t>([^<]*)<\/a:t>|<a:br\s*\/?>/g)) {
      if (m[1] !== undefined) atual += m[1];
      else {
        linhas.push(atual);
        atual = "";
      }
    }
    linhas.push(atual);
  }
  return linhas.map((l) => l.trim()).filter(Boolean);
}

async function lerSlides(arquivo) {
  let buffer;
  if (arquivo.mimeType === MIME_GOOGLE_SLIDES) {
    const res = await drive.files.export(
      { fileId: arquivo.id, mimeType: MIME_PPTX },
      { responseType: "arraybuffer" },
    );
    buffer = Buffer.from(res.data);
  } else if (arquivo.mimeType === MIME_PPTX) {
    const res = await drive.files.get({ fileId: arquivo.id, alt: "media" }, { responseType: "arraybuffer" });
    buffer = Buffer.from(res.data);
  } else {
    return null; // formato antigo .ppt ou outro: não dá para ler
  }

  const zip = await JSZip.loadAsync(buffer);
  const nomes = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/slide(\d+)/)[1]) - Number(b.match(/slide(\d+)/)[1]));

  const slides = [];
  for (const nome of nomes) {
    slides.push(extrairTextoDoSlideXml(await zip.files[nome].async("string")));
  }
  return slides;
}

function assinatura(slides) {
  if (!slides) return null;
  return slides
    .flat()
    .join("\n")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function nomeBase(nome) {
  return nome
    .replace(/^(Cópia de )+/i, "")
    .replace(/\.(pptx?|ppt)$/i, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// 1) lista tudo
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

// 2) agrupa
const grupos = new Map();
for (const a of arquivos) {
  const base = nomeBase(a.name);
  if (!grupos.has(base)) grupos.set(base, []);
  grupos.get(base).push(a);
}

const duplicados = [...grupos.entries()].filter(([, lista]) => lista.length > 1);
console.log(`Grupos duplicados: ${duplicados.length}`);

// 3) compara conteúdo
const identicos = [];
const diferentes = [];
const ilegiveis = [];

for (const [base, lista] of duplicados) {
  const comConteudo = [];
  for (const a of lista) {
    try {
      const slides = await lerSlides(a);
      comConteudo.push({ ...a, slides, assinatura: assinatura(slides) });
    } catch (err) {
      comConteudo.push({ ...a, slides: null, assinatura: null, erro: err.message });
    }
  }

  const assinaturas = new Set(comConteudo.map((c) => c.assinatura));
  if (comConteudo.some((c) => c.assinatura === null)) {
    ilegiveis.push({ base, arquivos: comConteudo.map((c) => ({ id: c.id, name: c.name, erro: c.erro ?? "formato não suportado" })) });
  } else if (assinaturas.size === 1) {
    identicos.push({ base, arquivos: comConteudo.map((c) => ({ id: c.id, name: c.name, size: c.size, slides: c.slides.length })) });
  } else {
    diferentes.push({
      base,
      arquivos: comConteudo.map((c) => ({ id: c.id, name: c.name, size: c.size, slides: c.slides.length, linhas: c.slides.flat().length })),
    });
  }
  process.stdout.write(".");
}

console.log("\n");
console.log(`Grupos com conteúdo IDÊNTICO (duplicata segura): ${identicos.length}`);
console.log(`Grupos com conteúdo DIFERENTE (precisa olhar): ${diferentes.length}`);
console.log(`Grupos ilegíveis (formato antigo): ${ilegiveis.length}`);

console.log("\n--- CONTEÚDO DIFERENTE ---");
for (const g of diferentes) {
  console.log(`\n"${g.base}":`);
  g.arquivos.forEach((a) => console.log(`   - ${a.name} | ${a.slides} slides | ${a.linhas} linhas | ${a.size} bytes`));
}

console.log("\n--- ILEGÍVEIS ---");
for (const g of ilegiveis) {
  console.log(`\n"${g.base}":`);
  g.arquivos.forEach((a) => console.log(`   - ${a.name} (${a.erro})`));
}

writeFileSync(
  new URL("./out-duplicados.json", import.meta.url),
  JSON.stringify({ identicos, diferentes, ilegiveis }, null, 2),
  "utf8",
);
console.log("\nSalvo em out-duplicados.json");
