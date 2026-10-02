// Reaplica, nas seções já gravadas, as correções do parser: tira os espaços que
// sobraram do alinhamento com os acordes e troca "Parte N" por Intro/Estrofe/Refrão.
//
// Uso:  node --env-file=.env.local scripts/arrumar-secoes.mjs "Título" [--aplicar]
//       node --env-file=.env.local scripts/arrumar-secoes.mjs --todas   [--aplicar]

import { createClient } from "@supabase/supabase-js";
import { rotularSecoes, limparEspacos } from "../src/lib/cifras/parser.ts";

const argumentos = process.argv.slice(2);
const APLICAR = argumentos.includes("--aplicar");
const TODAS = argumentos.includes("--todas");
const titulo = argumentos.find((a) => !a.startsWith("--"));

if (!TODAS && !titulo) {
  throw new Error('uso: node scripts/arrumar-secoes.mjs "Título" [--aplicar]  |  --todas [--aplicar]');
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const consulta = supabase.from("musicas").select("id, titulo").order("titulo_normalizado");
const { data: musicas, error } = TODAS ? await consulta : await consulta.eq("titulo", titulo);
if (error) throw new Error(error.message);
if (!musicas.length) throw new Error("nenhuma música encontrada");

let totalMudancas = 0;
let musicasAfetadas = 0;

for (const musica of musicas) {
  const { data: secoes } = await supabase
    .from("secoes")
    .select("id, ordem, tipo, acordes, letra, letra_cifrada")
    .eq("musica_id", musica.id)
    .order("ordem");

  if (!secoes?.length) continue;

  const rotuladas = rotularSecoes(
    secoes.map((s) => ({
      tipo: s.tipo,
      acordes: s.acordes ?? "",
      letra: (s.letra ?? "").split("\n").map(limparEspacos).filter(Boolean).join("\n"),
      letraCifrada: s.letra_cifrada ?? "",
    })),
  );

  const mudancas = [];
  for (let i = 0; i < secoes.length; i++) {
    const antes = secoes[i];
    const depois = rotuladas[i];
    const letraNova = depois.letra || null;
    if (antes.tipo === depois.tipo && (antes.letra ?? null) === letraNova) continue;
    mudancas.push({ id: antes.id, ordem: antes.ordem, de: antes.tipo, para: depois.tipo, letra: letraNova });
  }

  if (!mudancas.length) continue;
  musicasAfetadas++;
  totalMudancas += mudancas.length;

  console.log(`\n${musica.titulo} (${mudancas.length})`);
  console.log(`   ${mudancas.map((m) => `${m.de}→${m.para}`).join(", ")}`);

  if (!APLICAR) continue;

  for (const m of mudancas) {
    const { error: erro } = await supabase
      .from("secoes")
      .update({ tipo: m.para, letra: m.letra })
      .eq("id", m.id);
    if (erro) console.log(`   ERRO na seção ${m.ordem}: ${erro.message}`);
  }
}

console.log(
  `\n${totalMudancas} seção(ões) em ${musicasAfetadas} música(s)${APLICAR ? " atualizadas." : ". (modo prévia — rode com --aplicar)"}`,
);
