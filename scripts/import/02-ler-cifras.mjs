import { getDriveClient } from "../../src/lib/google/client.ts";
import { writeFileSync } from "node:fs";
import mammoth from "mammoth";

const CIFRAS_DOCX_ID = "14Jm9z-iaVBPdcUPt5gtJlW6kBxOc--kt";

const drive = getDriveClient();

console.log("Baixando .docx diretamente (sem criar cópia)...");
const res = await drive.files.get(
  { fileId: CIFRAS_DOCX_ID, alt: "media" },
  { responseType: "arraybuffer" },
);

const buffer = Buffer.from(res.data);
const { value: texto } = await mammoth.extractRawText({ buffer });

const linhas = texto.split("\n").map((l) => l.replace(/\r$/, ""));

console.log(`Total de linhas: ${linhas.length}`);
writeFileSync(new URL("./out-cifras-linhas.json", import.meta.url), JSON.stringify(linhas, null, 2), "utf8");
console.log("Salvo em out-cifras-linhas.json");
