// Reescreve o documento "Repertório SJ" no Drive com a lista alfabética vinda do banco.
// Uso:  node --env-file=.env.local scripts/reescrever-repertorio.mjs [--aplicar]
// Sem --aplicar, só mostra o que mudaria. Sempre salva um backup do conteúdo atual.

import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { lerRepertorioSJ, reescreverRepertorioSJ } from "../src/lib/google/repertorio.ts";

const APLICAR = process.argv.includes("--aplicar");

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data, error } = await supabase.from("musicas").select("titulo").order("titulo_normalizado");
if (error) throw new Error(`Erro ao ler o banco: ${error.message}`);

const titulos = data.map((m) => m.titulo);
const atual = await lerRepertorioSJ();

const backup = new URL("./backup-repertorio-sj.txt", import.meta.url);
writeFileSync(backup, atual.join("\n"), "utf8");
console.log(`Backup do conteúdo atual salvo em ${backup.pathname}`);

const atuaisUteis = atual.filter(Boolean);
const novos = titulos.filter((t) => !atuaisUteis.includes(t));
const sumiram = atuaisUteis.filter((t) => !titulos.includes(t) && t !== "Repertório SJ");

console.log(`\nNo documento hoje: ${atuaisUteis.length} linhas`);
console.log(`No banco: ${titulos.length} músicas`);
console.log(`\nEntram no documento (${novos.length}):`);
novos.forEach((t) => console.log(`  + ${t}`));
if (sumiram.length) {
  console.log(`\nEstavam no documento e não estão no banco (${sumiram.length}):`);
  sumiram.forEach((t) => console.log(`  - ${t}`));
}

if (!APLICAR) {
  console.log("\n(modo prévia — rode com --aplicar para reescrever o documento)");
  process.exit(0);
}

await reescreverRepertorioSJ(titulos);
console.log(`\nDocumento reescrito com ${titulos.length} títulos.`);
