import {
  acordesComPosicao,
  acordesDaLinha,
  ehLinhaDeAcordes,
  ROTULO_SECAO,
} from "./acordes.ts";

export interface SecaoParseada {
  tipo: string;
  /** Cifra resumida: só os acordes, na ordem em que aparecem. */
  acordes: string;
  /** Letra limpa, uma linha por verso. */
  letra: string;
  /** Cifra ampla em ChordPro: "[D]Meu Jesus, [A]Salvador". Vazio se a seção não tiver letra. */
  letraCifrada: string;
}

/** Espaços múltiplos viram um só. Na cifra colada eles existem só para alinhar com os acordes. */
export function limparEspacos(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}

/**
 * Insere os acordes na letra na posição de coluna em que estavam escritos acima dela.
 * Ex.:  "   D        A"  +  "Meu Jesus, Salvador"  ->  "Meu[D] Jesus, [A]Salvador"
 */
export function alinharAcordes(linhaAcordes: string, linhaLetra: string): string {
  const marcas = acordesComPosicao(linhaAcordes);
  if (marcas.length === 0) return linhaLetra;

  let resultado = "";
  let posicaoNaLetra = 0;

  for (const { acorde, coluna } of marcas) {
    const ate = Math.min(coluna, linhaLetra.length);
    if (ate > posicaoNaLetra) {
      resultado += linhaLetra.slice(posicaoNaLetra, ate);
      posicaoNaLetra = ate;
    }
    resultado += `[${acorde}]`;
  }
  resultado += linhaLetra.slice(posicaoNaLetra);

  return resultado;
}

/**
 * Lê uma cifra colada (acordes escritos acima da letra) e devolve seções.
 * Seções são separadas por linha em branco ou por rótulo ("Intro", "Refrão"…).
 * Linhas só de acordes sem letra embaixo viram seção instrumental.
 */
export function parsearCifra(texto: string): SecaoParseada[] {
  const linhas = texto.replace(/\r\n/g, "\n").split("\n");

  const secoes: SecaoParseada[] = [];
  let atual: { tipo: string | null; acordes: string[]; letra: string[]; cifrada: string[] } | null = null;

  const fechar = () => {
    if (!atual) return;
    const temConteudo = atual.acordes.length || atual.letra.length;
    if (temConteudo) {
      secoes.push({
        tipo: atual.tipo ?? `Parte ${secoes.length + 1}`,
        acordes: atual.acordes.join(" "),
        letra: atual.letra.join("\n"),
        letraCifrada: atual.cifrada.join("\n"),
      });
    }
    atual = null;
  };

  const abrir = (tipo: string | null) => {
    atual = { tipo, acordes: [], letra: [], cifrada: [] };
  };

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];

    if (!linha.trim()) {
      fechar();
      continue;
    }

    const rotulo = linha.match(ROTULO_SECAO);
    // só é rótulo se o resto da linha for vazio ou forem acordes ("Intro: D A Bm G");
    // assim um verso que comece com "Final" não vira seção por engano
    if (rotulo && (!rotulo[2].trim() || ehLinhaDeAcordes(rotulo[2]))) {
      fechar();
      abrir(rotulo[1].trim());
      if (rotulo[2].trim()) atual!.acordes.push(...acordesDaLinha(rotulo[2]));
      continue;
    }

    if (!atual) abrir(null);

    if (ehLinhaDeAcordes(linha)) {
      const proxima = linhas[i + 1];
      const temLetraAbaixo = proxima !== undefined && proxima.trim() && !ehLinhaDeAcordes(proxima);

      atual!.acordes.push(...acordesDaLinha(linha));

      if (temLetraAbaixo) {
        // a letra vem com espaços extras para alinhar com os acordes acima;
        // no texto limpo eles viram espaço simples, senão aparecem nos slides
        atual!.letra.push(limparEspacos(proxima));
        atual!.cifrada.push(alinharAcordes(linha, proxima));
        i++; // a linha de letra já foi consumida
      }
    } else {
      // letra sem acordes acima
      atual!.letra.push(limparEspacos(linha));
      atual!.cifrada.push(limparEspacos(linha));
    }
  }

  fechar();
  return rotularSecoes(secoes);
}

/** Chave de comparação: duas seções são "a mesma" quando a letra (ou os acordes) coincidem. */
function chaveDaSecao(s: SecaoParseada): string {
  const base = s.letra || s.acordes;
  return base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const ROTULO_GENERICO = /^Parte \d+$/;

/**
 * Troca "Parte 1, Parte 2…" por nomes que fazem sentido para quem toca.
 * O refrão é descoberto pela repetição: o bloco com letra que mais se repete.
 * Rótulos que a pessoa escreveu na cifra colada são respeitados.
 */
export function rotularSecoes(secoes: SecaoParseada[]): SecaoParseada[] {
  if (secoes.length === 0) return secoes;

  const ocorrencias = new Map<string, number>();
  for (const s of secoes) {
    const chave = chaveDaSecao(s);
    ocorrencias.set(chave, (ocorrencias.get(chave) ?? 0) + 1);
  }

  // candidato a refrão: bloco COM letra que mais aparece (e aparece mais de uma vez)
  let chaveRefrao: string | null = null;
  let maior = 1;
  for (const s of secoes) {
    if (!s.letra) continue;
    const chave = chaveDaSecao(s);
    const vezes = ocorrencias.get(chave)!;
    if (vezes > maior) {
      maior = vezes;
      chaveRefrao = chave;
    }
  }

  let estrofe = 0;
  const numeroDaEstrofe = new Map<string, number>();

  return secoes.map((s, i) => {
    if (!ROTULO_GENERICO.test(s.tipo)) return s; // rótulo veio da cifra colada

    const chave = chaveDaSecao(s);

    if (!s.letra) {
      const tipo = i === 0 ? "Intro" : i === secoes.length - 1 ? "Final" : "Ponte";
      return { ...s, tipo };
    }

    if (chave === chaveRefrao) return { ...s, tipo: "Refrão" };

    if (!numeroDaEstrofe.has(chave)) numeroDaEstrofe.set(chave, ++estrofe);
    return { ...s, tipo: `Estrofe ${numeroDaEstrofe.get(chave)}` };
  });
}

/**
 * Seções sem repetição, para as abas de cifra: o refrão aparece uma vez só.
 * Compara pelo conteúdo e ignora o rótulo — senão músicas importadas antes da
 * rotulagem automática ("Parte 1", "Parte 2"…) continuariam repetindo tudo.
 */
export function secoesUnicas<T extends { acordes: string | null; letra: string | null }>(
  secoes: T[],
): T[] {
  const vistas = new Set<string>();
  return secoes.filter((s) => {
    const chave = `${s.letra ?? ""}|${s.acordes ?? ""}`.replace(/\s+/g, " ").trim().toLowerCase();
    if (vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  });
}
