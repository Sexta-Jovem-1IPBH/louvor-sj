import { getDriveClient } from "../../src/lib/google/client.ts";
import { writeFileSync } from "node:fs";
import JSZip from "jszip";

const PASTA_SLIDES = "1ae2pC573LtGy06cqkdBiEAdKzET6nG1Y";

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

const lista = await drive.files.list({
  q: `'${PASTA_SLIDES}' in parents and trashed = false`,
  fields: "files(id, name)",
  pageSize: 1000,
});

const arquivos = lista.data.files ?? [];
console.log(`Total de arquivos na pasta: ${arquivos.length}`);

const resultado = [];
for (const arquivo of arquivos) {
  if (!/\.pptx$/i.test(arquivo.name)) {
    console.log(`Ignorando (não é .pptx): ${arquivo.name}`);
    continue;
  }
  try {
    const res = await drive.files.get({ fileId: arquivo.id, alt: "media" }, { responseType: "arraybuffer" });
    const slides = await lerPptx(Buffer.from(res.data));
    resultado.push({ arquivo: arquivo.name, slides });
    console.log(`OK: ${arquivo.name} (${slides.length} slides)`);
  } catch (err) {
    console.log(`ERRO: ${arquivo.name} -> ${err.message}`);
  }
}

writeFileSync(new URL("./out-slides.json", import.meta.url), JSON.stringify(resultado, null, 2), "utf8");
console.log(`\nSalvo em out-slides.json (${resultado.length} músicas)`);
