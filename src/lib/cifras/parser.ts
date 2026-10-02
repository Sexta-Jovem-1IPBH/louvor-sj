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
        atual!.letra.push(proxima.trim());
        atual!.cifrada.push(alinharAcordes(linha, proxima));
        i++; // a linha de letra já foi consumida
      }
    } else {
      // letra sem acordes acima
      atual!.letra.push(linha.trim());
      atual!.cifrada.push(linha.trim());
    }
  }

  fechar();
  return secoes;
}
