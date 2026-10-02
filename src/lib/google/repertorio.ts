// caminho relativo com extensão (e não o alias "@/") para o arquivo funcionar
// também nos scripts rodados direto pelo node, que exige o caminho completo
import { getDocsClient } from "./client.ts";

export const REPERTORIO_DOC_ID = "1BNvY-rXJDV6SiUMssoAV84cWjhYjxjNnJVCS9-_kzws";

const CABECALHO = "Repertório SJ";

/** Lê o conteúdo atual do documento, uma linha por parágrafo. */
export async function lerRepertorioSJ(): Promise<string[]> {
  const docs = getDocsClient();
  const res = await docs.documents.get({ documentId: REPERTORIO_DOC_ID });

  return (res.data.body?.content ?? [])
    .filter((el) => el.paragraph)
    .map((el) =>
      (el.paragraph!.elements ?? [])
        .map((e) => e.textRun?.content ?? "")
        .join("")
        .replace(/\n$/, "")
        .trim(),
    );
}

/**
 * Reescreve o documento Repertório SJ com a lista alfabética recebida.
 * Substitui todo o corpo: apaga o conteúdo atual e insere o novo de uma vez.
 */
export async function reescreverRepertorioSJ(titulos: string[]): Promise<void> {
  const docs = getDocsClient();
  const doc = await docs.documents.get({ documentId: REPERTORIO_DOC_ID });

  const conteudo = doc.data.body?.content ?? [];
  const ultimo = conteudo[conteudo.length - 1];
  // o Google Docs mantém uma quebra de linha final que não pode ser apagada
  const fim = (ultimo?.endIndex ?? 2) - 1;

  const texto = [CABECALHO, "", ...titulos].join("\n");

  const requests = [];
  if (fim > 1) {
    requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex: fim } } });
  }
  requests.push({ insertText: { location: { index: 1 }, text: texto } });

  await docs.documents.batchUpdate({ documentId: REPERTORIO_DOC_ID, requestBody: { requests } });
}
