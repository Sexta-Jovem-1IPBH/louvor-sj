// Regenera o .pptx de uma música e substitui o conteúdo do arquivo que já existe no Drive.
// Uso: node --env-file=.env.local scripts/regerar-slides.mjs "Título da música"
//
// Substituir conteúdo é diferente de criar arquivo: a conta de serviço não tem cota
// para criar, mas o arquivo já existe e pertence a outra pessoa, então o espaço é dela.

import { Readable } from "node:stream";
import { createClient } from "@supabase/supabase-js";
import { getDriveClient } from "../src/lib/google/client.ts";
import { montarApresentacao } from "../src/lib/slides/gerar.ts";

const MIME_PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const titulo = process.argv[2];
if (!titulo) throw new Error('passe o título: node scripts/regerar-slides.mjs "Nome da música"');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: musica, error } = await supabase
  .from("musicas")
  .select("id, titulo, slides_drive_id, slides_origem")
  .eq("titulo", titulo)
  .single();
if (error) throw new Error(`música não encontrada: ${error.message}`);
if (!musica.slides_drive_id) throw new Error("essa música não tem slide vinculado");
if (musica.slides_origem === "manual") {
  throw new Error("slide feito à mão — regra 5 do projeto: nunca sobrescrever");
}

const { data: secoes } = await supabase
  .from("secoes")
  .select("letra")
  .eq("musica_id", musica.id)
  .order("ordem");

const letra = secoes
  .map((s) => s.letra)
  .filter(Boolean)
  .join("\n\n");

const pptx = montarApresentacao(musica.titulo, letra);
const buffer = await pptx.write({ outputType: "nodebuffer" });
console.log(`Gerado: ${(buffer.length / 1024).toFixed(0)} KB`);

const drive = getDriveClient();
const res = await drive.files.update({
  fileId: musica.slides_drive_id,
  media: { mimeType: MIME_PPTX, body: Readable.from(buffer) },
  fields: "id, name, mimeType, size",
});

console.log("Arquivo atualizado:", res.data.name, "|", res.data.mimeType, "|", res.data.size, "bytes");
