/**
 * Criação de arquivos no Drive a partir do navegador, com o token do Google da
 * pessoa logada. É assim porque a conta de serviço não tem cota de armazenamento
 * e não consegue criar nada (ver CLAUDE.md). O escopo usado é `drive.file`, que
 * já foi verificado: cria dentro de pasta existente passando só o ID dela.
 */

export const PASTA_SLIDES = "1ae2pC573LtGy06cqkdBiEAdKzET6nG1Y";

export class ErroDrive extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ErroDrive";
  }
}

async function lerErro(resposta: Response): Promise<never> {
  let mensagem = `HTTP ${resposta.status}`;
  try {
    const corpo = await resposta.json();
    mensagem = corpo?.error?.message ?? mensagem;
  } catch {
    // resposta sem JSON: fica a mensagem genérica
  }
  throw new ErroDrive(mensagem, resposta.status);
}

/** Envia um arquivo novo para uma pasta do Drive. Devolve o id criado. */
export async function enviarArquivo({
  token,
  nome,
  conteudo,
  mimeType,
  pastaId,
}: {
  token: string;
  nome: string;
  conteudo: Blob;
  mimeType: string;
  pastaId: string;
}): Promise<string> {
  const metadados = new Blob([JSON.stringify({ name: nome, parents: [pastaId] })], {
    type: "application/json",
  });

  const corpo = new FormData();
  corpo.append("metadata", metadados);
  corpo.append("file", conteudo);

  const resposta = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: corpo,
    },
  );

  if (!resposta.ok) await lerErro(resposta);
  const { id } = await resposta.json();
  return id as string;
}
