import { getDocsClient } from "../../src/lib/google/client.ts";
import { writeFileSync } from "node:fs";

const REPERTORIO_ID = "1BNvY-rXJDV6SiUMssoAV84cWjhYjxjNnJVCS9-_kzws";

const docs = getDocsClient();
const res = await docs.documents.get({ documentId: REPERTORIO_ID });

const titulos = [];
for (const el of res.data.body?.content ?? []) {
  const paragraph = el.paragraph;
  if (!paragraph) continue;
  const texto = (paragraph.elements ?? [])
    .map((e) => e.textRun?.content ?? "")
    .join("")
    .replace(/\n$/, "")
    .trim();
  if (texto) titulos.push(texto);
}

console.log(`Total de títulos encontrados: ${titulos.length}`);
writeFileSync(new URL("./out-titulos-repertorio.json", import.meta.url), JSON.stringify(titulos, null, 2), "utf8");
console.log("Salvo em out-titulos-repertorio.json");
