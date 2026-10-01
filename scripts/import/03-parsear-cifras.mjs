import { readFileSync, writeFileSync } from "node:fs";

const linhas = JSON.parse(readFileSync(new URL("./out-cifras-linhas.json", import.meta.url), "utf8"));

const QUALIDADE = "(?:maj7|maj|dim7|dim|aug|sus2|sus4|sus|add9|add11|add13|add2|add4|m7|m9|m|º|°|ø)?";
const EXTENSAO = "(?:7M|9M|11M|13M|2|4|5|6|7|9|11|13)?";
const NOTA = `[A-G](?:#|b)?${QUALIDADE}${EXTENSAO}`;
const ACORDE = new RegExp(`^${NOTA}(?:\\/${NOTA})?$`);
const DUAS_NOTAS_GRUDADAS = /^[A-G]{2}$/;

function limparToken(t) {
  return t.replace(/^[(),]+/, "").replace(/[(),]+$/, "");
}

function ehRepeticaoOuVazio(t) {
  return t === "" || /^x\d*$/i.test(t) || /^\d+$/.test(t);
}

function ehAcordeValido(t) {
  return ACORDE.test(t) || DUAS_NOTAS_GRUDADAS.test(t);
}

function ehLinhaDeAcordes(linha) {
  const tokens = linha
    .trim()
    .split(/\s+/)
    .map(limparToken)
    .filter((t) => !ehRepeticaoOuVazio(t));
  if (tokens.length === 0) return true; // linha só com parênteses/repetição -> ignorar, não quebra a música
  return tokens.every(ehAcordeValido);
}

const musicas = [];
let atual = null;
let parteAberta = false;

for (const linhaOriginal of linhas) {
  const linha = linhaOriginal.trim();

  if (!linha) {
    parteAberta = false;
    continue;
  }

  if (ehLinhaDeAcordes(linha)) {
    if (!atual) continue; // lixo antes do primeiro título (cabeçalho do doc)
    const tokens = linha
      .trim()
      .split(/\s+/)
      .map(limparToken)
      .filter((t) => !ehRepeticaoOuVazio(t));
    if (tokens.length === 0) continue; // linha só decorativa, ex: "(x2)"
    if (!parteAberta) {
      atual.partes.push(linha);
      parteAberta = true;
    } else {
      atual.partes[atual.partes.length - 1] += " " + linha;
    }
  } else {
    atual = { titulo: linha, partes: [] };
    musicas.push(atual);
    parteAberta = false;
  }
}

// descarta o cabeçalho do documento, que entra como "música" fantasma
const musicasLimpas = musicas.filter((m) => !/^Repertório.*Cifras$/i.test(m.titulo));

console.log(`Total de músicas encontradas no documento de cifras: ${musicasLimpas.length}`);
console.log(`Músicas sem nenhuma parte de acordes (só título): ${musicasLimpas.filter((m) => m.partes.length === 0).length}`);

writeFileSync(new URL("./out-cifras-musicas.json", import.meta.url), JSON.stringify(musicasLimpas, null, 2), "utf8");
console.log("Salvo em out-cifras-musicas.json");
