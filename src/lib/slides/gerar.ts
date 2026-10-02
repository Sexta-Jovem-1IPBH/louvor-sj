import PptxGenJS from "pptxgenjs";
import { FUNDO_SLIDE_BASE64 } from "./fundo.ts";
import { secoesUnicas } from "../cifras/parser.ts";

/**
 * Gera o .pptx de uma música no mesmo padrão dos slides que a equipe já usa:
 * 16:9 de 13,333" x 7,5" (o mesmo dos arquivos existentes — o LAYOUT_16x9 do
 * pptxgenjs é menor), fundo com o logo da UMP, Calibri negrito centralizado,
 * um slide de título em maiúsculas e um slide por estrofe.
 *
 * Roda no navegador: quem cria o arquivo no Drive é a pessoa logada, com o
 * token dela (a conta de serviço não tem cota para criar arquivos).
 */

/** Teto de linhas por slide. As estrofes são respeitadas; isso só evita slide ilegível. */
const MAX_LINHAS_POR_SLIDE = 6;

const LAYOUT = { name: "SJ_16x9", width: 13.333, height: 7.5 };
const MASTER = "FUNDO_SJ";

const TEXTO_BASE = {
  fontFace: "Calibri",
  bold: true,
  color: "000000",
  align: "center",
  valign: "middle",
  x: 0.5,
  y: 0.3,
  w: LAYOUT.width - 1,
  h: LAYOUT.height - 0.6,
} as const;

/**
 * Junta a letra das seções para virar slides, com cada parte aparecendo uma vez só
 * (decisão do Arthur em 2026-10-02: o refrão repetido não é reescrito; quem projeta
 * volta no slide dele). O banco continua guardando a sequência como foi colada.
 */
export function letraDasSecoes(secoes: { letra: string | null; acordes: string | null }[]): string {
  return secoesUnicas(secoes)
    .map((s) => s.letra)
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Cada estrofe (separada por linha em branco) vira um slide, como nos arquivos
 * originais. Estrofe longa demais é quebrada para não ficar ilegível.
 */
export function dividirEmBlocos(letra: string, maxLinhas = MAX_LINHAS_POR_SLIDE): string[][] {
  const blocos: string[][] = [];

  for (const estrofe of letra.split(/\n\s*\n/)) {
    const linhas = estrofe
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (linhas.length === 0) continue;

    if (linhas.length <= maxLinhas) {
      blocos.push(linhas);
      continue;
    }

    // quebra em partes o mais parecidas possível, em vez de deixar uma linha sozinha no fim
    const partes = Math.ceil(linhas.length / maxLinhas);
    const porParte = Math.ceil(linhas.length / partes);
    for (let i = 0; i < linhas.length; i += porParte) {
      blocos.push(linhas.slice(i, i + porParte));
    }
  }

  return blocos;
}

/** Monta a apresentação em memória. Separado de `gerarSlides` para dar para testar fora do navegador. */
export function montarApresentacao(titulo: string, letra: string): PptxGenJS {
  const pptx = new PptxGenJS();
  pptx.defineLayout(LAYOUT);
  pptx.layout = LAYOUT.name;

  // o fundo entra no slide mestre para ser embutido uma vez só, e não a cada slide
  pptx.defineSlideMaster({
    title: MASTER,
    background: { data: `image/jpeg;base64,${FUNDO_SLIDE_BASE64}` },
  });

  const capa = pptx.addSlide({ masterName: MASTER });
  capa.addText(titulo.toUpperCase(), { ...TEXTO_BASE, fontSize: 80 });

  for (const bloco of dividirEmBlocos(letra)) {
    const slide = pptx.addSlide({ masterName: MASTER });
    slide.addText(bloco.join("\n"), { ...TEXTO_BASE, fontSize: 54 });
  }

  return pptx;
}

export async function gerarSlides(titulo: string, letra: string): Promise<Blob> {
  const pptx = montarApresentacao(titulo, letra);
  return (await pptx.write({ outputType: "blob" })) as Blob;
}
