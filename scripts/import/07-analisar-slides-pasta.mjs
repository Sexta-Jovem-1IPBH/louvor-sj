import { getDriveClient } from "../../src/lib/google/client.ts";

const PASTA_SLIDES = "1ae2pC573LtGy06cqkdBiEAdKzET6nG1Y";
const drive = getDriveClient();

const arquivos = [];
let pageToken;
do {
  const res = await drive.files.list({
    q: `'${PASTA_SLIDES}' in parents and trashed = false`,
    fields: "nextPageToken, files(id, name, size, modifiedTime, mimeType)",
    pageSize: 1000,
    pageToken,
  });
  arquivos.push(...(res.data.files ?? []));
  pageToken = res.data.nextPageToken ?? undefined;
} while (pageToken);

function nomeBase(nome) {
  return nome
    .replace(/^(Cópia de )+/i, "")
    .replace(/\.(pptx?|ppt)$/i, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

console.log(`Total de arquivos na pasta: ${arquivos.length}`);
console.log(`Com prefixo "Cópia de": ${arquivos.filter((a) => /^Cópia de /i.test(a.name)).length}`);
console.log(`Sem prefixo: ${arquivos.filter((a) => !/^Cópia de /i.test(a.name)).length}`);

const porBase = new Map();
for (const a of arquivos) {
  const base = nomeBase(a.name);
  if (!porBase.has(base)) porBase.set(base, []);
  porBase.get(base).push(a);
}

const duplicados = [...porBase.entries()].filter(([, lista]) => lista.length > 1);
console.log(`\nMúsicas com mais de um arquivo: ${duplicados.length}`);
for (const [base, lista] of duplicados) {
  console.log(`\n  "${base}" (${lista.length} arquivos):`);
  for (const a of lista) {
    console.log(`     - ${a.name} | ${a.size ?? "?"} bytes | modificado ${a.modifiedTime}`);
  }
}

const naoPptx = arquivos.filter((a) => !/\.pptx$/i.test(a.name));
if (naoPptx.length) {
  console.log(`\nArquivos que não são .pptx (${naoPptx.length}):`);
  naoPptx.forEach((a) => console.log(`  - ${a.name} (${a.mimeType})`));
}
