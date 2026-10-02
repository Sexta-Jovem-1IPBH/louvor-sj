// Reaplica, nas seções já gravadas, as correções do parser: tira os espaços que
// sobraram do alinhamento com os acordes e troca "Parte N" por Intro/Estrofe/Refrão.
//
// Uso:  node --env-file=.env.local scripts/arrumar-secoes.mjs "Título"  [--aplicar]

import { createClient } from "@supabase/supabase-js";
import { rotularSecoes, limparEspacos } from "../src/lib/cifras/parser.ts";

const titulo = process.argv[2];
const APLICAR = process.argv.includes("--aplicar");
if (!titulo) throw new Error('uso: node scripts/arrumar-secoes.mjs "Título" [--aplicar]');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: musica, error } = await supabase
  .from("musicas")
  .select("id, titulo")
  .eq("titulo", titulo)
  .single();
if (error) throw new Error(`música não encontrada: ${error.message}`);

const { data: secoes } = await supabase
  .from("secoes")
  .select("id, ordem, tipo, acordes, letra, letra_cifrada")
  .eq("musica_id", musica.id)
  .order("ordem");

const parseadas = secoes.map((s) => ({
  tipo: s.tipo,
  acordes: s.acordes ?? "",
  letra: (s.letra ?? "").split("\n").map(limparEspacos).filter(Boolean).join("\n"),
  letraCifrada: s.letra_cifrada ?? "",
}));

const rotuladas = rotularSecoes(parseadas);

console.log(`${musica.titulo} — ${secoes.length} seções\n`);
const mudancas = [];
for (let i = 0; i < secoes.length; i++) {
  const antes = secoes[i];
  const depois = rotuladas[i];
  const letraNova = depois.letra || null;

  const mudouTipo = antes.tipo !== depois.tipo;
  const mudouLetra = (antes.letra ?? null) !== letraNova;
  if (!mudouTipo && !mudouLetra) continue;

  console.log(`  ${antes.ordem}: ${mudouTipo ? `"${antes.tipo}" -> "${depois.tipo}"` : depois.tipo}`);
  if (mudouLetra) console.log(`      letra: ${JSON.stringify(antes.letra?.split("\n")[0] ?? "")} -> ${JSON.stringify(letraNova?.split("\n")[0] ?? "")}`);

  mudancas.push({ id: antes.id, tipo: depois.tipo, letra: letraNova });
}

if (!mudancas.length) {
  console.log("Nada a mudar.");
  process.exit(0);
}

if (!APLICAR) {
  console.log(`\n${mudancas.length} seção(ões) a atualizar. (modo prévia — rode com --aplicar)`);
  process.exit(0);
}

for (const m of mudancas) {
  const { error: erro } = await supabase
    .from("secoes")
    .update({ tipo: m.tipo, letra: m.letra })
    .eq("id", m.id);
  if (erro) console.log(`ERRO na seção ${m.id}: ${erro.message}`);
}
console.log(`\n${mudancas.length} seção(ões) atualizada(s).`);
