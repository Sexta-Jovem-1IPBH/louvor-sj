// Confere se todo slides_drive_id guardado no banco ainda existe e está acessível no Drive.
// Uso: node --env-file=.env.local scripts/verificar-slides.mjs
import { createClient } from "@supabase/supabase-js";
import { getDriveClient } from "../src/lib/google/client.ts";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const drive = getDriveClient();

const { data: musicas, error } = await supabase
  .from("musicas")
  .select("id, titulo, slides_drive_id")
  .not("slides_drive_id", "is", null)
  .order("titulo_normalizado");

if (error) throw new Error(error.message);
console.log(`Músicas com slide vinculado: ${musicas.length}`);

const quebrados = [];
const renomeados = [];

for (const m of musicas) {
  try {
    const res = await drive.files.get({ fileId: m.slides_drive_id, fields: "id,name,trashed" });
    if (res.data.trashed) {
      quebrados.push({ ...m, motivo: "está na lixeira" });
    } else if (/^ZZ /.test(res.data.name)) {
      renomeados.push({ ...m, nomeNoDrive: res.data.name });
    }
  } catch (err) {
    quebrados.push({ ...m, motivo: err.message });
  }
  process.stdout.write(".");
}

console.log("\n");
if (!quebrados.length && !renomeados.length) {
  console.log("Tudo certo: todos os slides vinculados continuam acessíveis.");
} else {
  if (quebrados.length) {
    console.log(`Vínculos quebrados (${quebrados.length}):`);
    quebrados.forEach((q) => console.log(`  - ${q.titulo}: ${q.motivo}`));
  }
  if (renomeados.length) {
    console.log(`\nApontam para arquivo marcado ZZ (${renomeados.length}):`);
    renomeados.forEach((r) => console.log(`  - ${r.titulo} -> ${r.nomeNoDrive}`));
  }
}
