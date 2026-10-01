import { getDriveClient } from "../../src/lib/google/client.ts";
import { writeFileSync } from "node:fs";
import JSZip from "jszip";

const PASTA_SLIDES = "1ae2pC573LtGy06cqkdBiEAdKzET6nG1Y";
const MIME_GOOGLE_SLIDES = "application/vnd.google-apps.presentation";
const MIME_PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const drive = getDriveClient();

function extrairTextoDoSlideXml(xml) {
  // cada parágrafo <a:p> pode conter várias linhas, separadas por <a:br/>
  const paragrafos = xml.match(/<a:p>.*?<\/a:p>/gs) ?? [];
  const linhas = [];

  for (const paragrafo of paragrafos) {
    let atual = "";
    for (const m of paragrafo.matchAll(/<a:t>([^<]*)<\/a:t>|<a:br\s*\/?>/g)) {
      if (m[1] !== undefined) {
        atual += m[1];
      } else {
        linhas.push(atual);
        atual = "";
      }
    }
    linhas.push(atual);
  }

  return linhas.map((l) => l.trim()).filter((l) => l.length > 0);
}

async function lerPptx(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const nomesSlides = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml/)[1]);
      const nb = Number(b.match(/slide(\d+)\.xml/)[1]);
      return na - nb;
    });

  const slides = [];
  for (const nome of nomesSlides) {
    const xml = await zip.files[nome].async("string");
    slides.push(extrairTextoDoSlideXml(xml));
  }
  return slides;
}

const arquivos = [];
let pageToken;
do {
  const res = await drive.files.list({
    q: `'${PASTA_SLIDES}' in parents and trashed = false`,
    fields: "nextPageToken, files(id, name, mimeType)",
    pageSize: 1000,
    pageToken,
  });
  arquivos.push(...(res.data.files ?? []));
  pageToken = res.data.nextPageToken ?? undefined;
} while (pageToken);

console.log(`Total de arquivos na pasta: ${arquivos.length}`);

const resultado = [];
const ignorados = [];
for (const arquivo of arquivos) {
  if (/^ZZ /.test(arquivo.name)) {
    ignorados.push(`${arquivo.name} (marcado como duplicado/revisar)`);
    continue;
  }
  try {
    let buffer;
    if (arquivo.mimeType === MIME_GOOGLE_SLIDES) {
      const res = await drive.files.export({ fileId: arquivo.id, mimeType: MIME_PPTX }, { responseType: "arraybuffer" });
      buffer = Buffer.from(res.data);
    } else if (arquivo.mimeType === MIME_PPTX) {
      const res = await drive.files.get({ fileId: arquivo.id, alt: "media" }, { responseType: "arraybuffer" });
      buffer = Buffer.from(res.data);
    } else {
      ignorados.push(`${arquivo.name} (formato não suportado: ${arquivo.mimeType})`);
      continue;
    }
    const slides = await lerPptx(buffer);
    resultado.push({ arquivo: arquivo.name, driveId: arquivo.id, slides });
    process.stdout.write(".");
  } catch (err) {
    ignorados.push(`${arquivo.name} (erro: ${err.message})`);
  }
}

console.log("\n");
if (ignorados.length) {
  console.log(`Ignorados (${ignorados.length}):`);
  ignorados.forEach((i) => console.log(`  - ${i}`));
}

writeFileSync(new URL("./out-slides.json", import.meta.url), JSON.stringify(resultado, null, 2), "utf8");
console.log(`\nSalvo em out-slides.json (${resultado.length} músicas)`);
