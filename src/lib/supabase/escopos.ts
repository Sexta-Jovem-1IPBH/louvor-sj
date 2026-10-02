/**
 * Escopo pedido no login além dos básicos de perfil.
 *
 * `drive.file` dá acesso só aos arquivos que o próprio app cria (ou que a pessoa
 * escolhe explicitamente), e não é escopo restrito — por isso não exige verificação
 * do Google nem token que expira. É com ele que o app vai criar os slides e subir
 * mídia em nome de quem está usando, já que a conta de serviço não tem cota de
 * armazenamento no Drive. Ver CLAUDE.md, "O que a conta de serviço pode e não pode".
 */
export const ESCOPO_DRIVE = "https://www.googleapis.com/auth/drive.file";
