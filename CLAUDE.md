# App de Louvor SJ — 1ª IPBH

App web (PWA, uso principal no celular) para centralizar o material de louvor: repertório, letras, slides, cifras (resumida e ampla), mídias (áudios e vídeos) e histórico de cultos.

O dono do projeto é o Arthur (estudante de engenharia de produção, nível técnico intermediário). Explique decisões técnicas de forma didática quando relevante e peça confirmação antes de ações irreversíveis.

## Stack

- **Frontend/backend:** Next.js (App Router) + TypeScript + Tailwind, hospedado na **Vercel** (plano Hobby).
- **Banco + login:** **Supabase** (plano Free, região São Paulo). Postgres + Supabase Auth com provedor Google.
- **Arquivos:** **Google Drive** da conta pessoal do Arthur (PowerPoints, áudios, vídeos, documentos). O Supabase guarda só dados e IDs/links do Drive.
- **Automação:** **GitHub Actions** (despertador anti-pausa e backup semanal).
- Integração Google: projeto Google Cloud dedicado (`louvorsj`, dono é a conta `louvorsj.1pipbh@gmail.com` criada só para o projeto). Drive API e Docs API ativadas. Autenticação via **conta de serviço** (`louvorsj@louvorsj.iam.gserviceaccount.com`), chave guardada em variável de ambiente, nunca no código. Decisão (mudou do plano original de OAuth com refresh token): evita a expiração de token de 7 dias que apps OAuth em modo "Teste" têm com escopos restritos do Drive, e não exige verificação do Google. Efeito prático: as pastas/documentos do Drive precisam ser **compartilhados manualmente** (como Editor) com o e-mail da conta de serviço para o app enxergá-los.

> **Limitação descoberta em 2026-10-01 (importante para a fase 2):** contas de serviço **não têm cota de armazenamento no Drive**. A mensagem do Google é literal: *"Service Accounts do not have storage quota. Leverage shared drives, or use OAuth delegation instead."* Isso significa que a conta de serviço:
> - **consegue:** ler qualquer arquivo compartilhado com ela, e **editar o conteúdo** de arquivos que já existem (reescrever o Repertório SJ e o documento de cifras funciona);
> - **não consegue:** criar nenhum arquivo ou pasta novos, nem dentro das pastas do Arthur.
>
> Isso bloqueia, do jeito atual: gerar os .pptx de slides (regra 4), criar subpastas por música e receber uploads de áudio/vídeo (fase 3). Saídas possíveis, a decidir antes da fase 2: (a) OAuth com a conta do Arthur usando escopo `drive.file` (não é escopo restrito, logo pode publicar em produção sem verificação do Google, e o token não expira — a criação de arquivos passaria a ser feita por ele, com a conta de serviço seguindo responsável pela leitura); (b) Google Workspace com Shared Drive (pago); (c) abrir mão da criação automática.

## Regras de negócio (não negociáveis)

1. **O repertório só cresce.** Não existe exclusão de música, nem na interface nem nas políticas do banco (RLS sem DELETE em `musicas` e `secoes`). Correções são permitidas.
2. **Toda alteração fica registrada** em `historico_alteracoes` (antes/depois em JSONB, usuário, data), para permitir desfazer.
3. **Acesso:** qualquer pessoa pode **ver** tudo sem login. Para **adicionar, editar ou enviar mídia**, é preciso entrar com qualquer conta Google (sem lista de autorizados).
4. **Automações no Drive** a cada música adicionada ou alterada:
   - Reescrever o documento **Repertório SJ** (lista alfabética de todos os títulos).
   - Gerar os **slides** (.pptx) se a música ainda não tiver, na pasta Slides nova.
   - Se houver cifra, atualizar o documento de **cifras**.
5. **PowerPoints feitos à mão nunca são sobrescritos.** Slides gerados pelo app (`slides_origem = 'gerado'`) são refeitos quando a letra muda.
6. **Cifra resumida é a fonte principal.** Pode existir sem a ampla.
7. **Cifra Club:** NÃO fazer scraping (os termos do site proíbem e é frágil). Oferecer só um botão que abre a busca do Cifra Club com o nome da música, em nova aba; o usuário copia e cola.
8. Nenhuma senha, chave ou token no repositório. Usar variáveis de ambiente (Vercel) e secrets (GitHub).

## Material existente no Google Drive (IDs)

| Item | ID | Observação |
|---|---|---|
| Pasta raiz "Cifras e Vídeos - SJ" | `1g5Wrc0HMUGtJyFL90mIV4e2ljWtxHn3u` | |
| **Repertório SJ** (Google Docs) — lista mestre | `1BNvY-rXJDV6SiUMssoAV84cWjhYjxjNnJVCS9-_kzws` | ~145 títulos, um por parágrafo. Fonte da verdade na importação; depois é reescrito pelo app |
| **Pasta Slides nova** (do Arthur) — destino oficial | `1ae2pC573LtGy06cqkdBiEAdKzET6nG1Y` | Fonte única (decisão do Arthur: não comparar com a pasta antiga). Prefixo "Cópia de " removido dos 50 arquivos em 2026-10-01 |
| Pasta Slides antiga (do Lucas) | `1HFSEoAXzFyaCkWClCrEt7rKW0RCm9_4L` | Só leitura; não usada pelo app (acesso da conta de serviço nem foi configurado) |
| Pasta Cifras | `1ZPYd502E4kQRlC_CPCfDQQH-tNaFhu_O` | |
| "(Todas as cifras).docx" | `14Jm9z-iaVBPdcUPt5gtJlW6kBxOc--kt` | Cifras resumidas. Converter para Google Docs para facilitar a reescrita automática; regerar o PDF ao lado a cada atualização |
| "(Todas as cifras).pdf" | `1A_QTKuUxEAGQgsQaXhfpp1xHtjbHf7WG` | |
| Pasta "Áudios e Divisões de vozes" | `1u0rX_mODCcso9EjkiB0K8ECWbHtZ6GbS` | Uma subpasta por música — manter esse padrão para novos áudios |
| Pasta Vídeos | `1MSCODB400NWO_bpOROtT5A7zIf06DTaN` | Criar subpasta por música para novos vídeos |

### Formatos observados

- **Documento de cifras:** título da música numa linha, seguido de linhas de acordes (ex.: `A F#m D E`), sem rótulos de seção. Muitas músicas têm só o título (sem cifra ainda). Sustenidos aparecem escapados (`F\#m`) na exportação — normalizar.
- **Slides:** 1 slide de título (nome em maiúsculas) + slides com blocos de até 4 linhas de letra. Usar um PowerPoint existente (ex.: "Louvores e honras") como referência de estilo/modelo.
- **Discrepâncias conhecidas:** "És maia Forte" (repertório) = "És mais Forte" (slides); "Senhor, guia meu caminhar" = "Guia meu caminhar.ppt" (formato antigo, converter); "Mocidade presbiteriana (Hino)" = "Hino da Mocidade - Hino 382". Há slides fora do repertório (ex.: Falar com Deus, Proclamai, Incomparável, Das trevas à luz, Digno é o Senhor) → tela de revisão, com padrão "adicionar ao repertório".

## Funcionalidades

1. **Repertório (tela inicial):** lista alfabética com busca e selos de status por música: Letra, Slides, Resumida, Ampla, nº de Mídias. Filtros de pendência ("sem slides", "sem cifra").
2. **Página da música:** abas Letra | Slides (modo apresentação em tela cheia) | Cifra resumida | Cifra ampla | Mídias. Transposição de tom aplicada às duas cifras ao mesmo tempo.
3. **Adicionar música:** nome (alerta de nome parecido já existente) → colar letra (estrofes separadas por linha em branco) → opcional: colar cifra com acordes sobre a letra. Depois, automaticamente: slides no Drive, Repertório SJ reescrito, cifra resumida gerada e documento de cifras atualizado. Prévia antes de confirmar.
4. **Mídias:** upload de áudio e vídeo pelo celular, enviado **direto do navegador para o Drive** (upload resumível do Google; o servidor só cria a sessão — a Vercel não aceita arquivos grandes). Gravação de áudio pelo próprio app. Metadados: tipo (segunda voz, voz principal, instrumental, ensaio, referência), voz/instrumento (feminina, masculina, baixo, violão, piano), enviado por. Limite sugerido: 200 MB por vídeo. Medidor de espaço usado do Drive.
5. **Histórico de cultos:** data + setlist (músicas na ordem e no tom). Indicadores: última vez tocada, mais tocadas.

Fora do escopo: cadastro de pessoas, grupos de louvor e escala.

## Cifras: como as duas versões conversam

A música é guardada **por seções**. Cada seção tem:
- `acordes` — linha da cifra resumida (fonte principal);
- `letra` — texto da seção (usado nos slides e na aba Letra);
- `letra_cifrada` — opcional, a cifra ampla em formato ChordPro (`[A]linha...`).

Parser da cifra colada: detectar linhas só de acordes vs. linhas de letra, alinhar acordes às sílabas pela posição da coluna, identificar seções (linha em branco ou rótulos como "Intro", "Refrão"). Gerar a resumida quando não existir; quando existir e divergir, **sinalizar a diferença** por seção e deixar o usuário escolher. Na importação, as linhas do documento atual entram como "Parte 1, Parte 2…" para rotular depois.

## Modelo de dados (ponto de partida)

- `musicas` (id, titulo, titulo_normalizado, tom_original, tom_grupo, slides_drive_id, slides_origem ['manual','gerado'], criado_por, criado_em, atualizado_em)
- `secoes` (id, musica_id, ordem, tipo, acordes, letra, letra_cifrada)
- `midias` (id, musica_id, tipo, voz_instrumento, drive_file_id, mime_type, tamanho_bytes, enviado_por, criado_em)
- `cultos` (id, data, observacao) e `setlist` (culto_id, musica_id, ordem, tom)
- `historico_alteracoes` (id, tabela, registro_id, antes, depois, usuario, em)

RLS: leitura pública; escrita para usuários autenticados; sem DELETE em `musicas`/`secoes`; mídias apagáveis só por quem enviou.

## GitHub Actions

- **manter-ativo.yml:** a cada 3 dias, uma consulta simples ao Supabase via REST (o plano Free pausa após 7 dias sem atividade).
- **backup.yml:** semanal, `pg_dump` do banco salvo como artefato ou numa pasta de backup no Drive.

## Fases

1. **Importação e consulta:** schema do Supabase; importar Repertório SJ + documento de cifras + letras extraídas dos PowerPoints; tela de revisão de casamento de nomes; tela do repertório; página da música com transposição; reescrita automática do Repertório SJ.
2. **Adicionar música completo:** gerador de slides (.pptx no padrão atual, salvo no Drive), parser de cifra, geração da resumida, verificação de divergências, atualização do documento de cifras, botão do Cifra Club.
3. **Mídias e histórico:** upload direto para o Drive, gravação de áudio, aba Mídias com filtros, registro de cultos.

## Setup pendente (guiar o Arthur passo a passo)

- [x] Contas GitHub, Vercel e Supabase (projeto em São Paulo)
- [x] Node.js, npm e Git instalados; projeto Next.js (TypeScript + Tailwind + App Router) criado em `Louvor SJ/`
- [x] Identidade dedicada do projeto: conta Google `louvorsj.1pipbh@gmail.com`; repositório movido para a Organização GitHub **Sexta-Jovem-1IPBH**; convite enviado na Org do Supabase
- [x] Projeto no Google Cloud (`louvorsj`): Drive API e Docs API ativadas, conta de serviço criada (`louvorsj@louvorsj.iam.gserviceaccount.com`) e chave testada (ver "Integração Google" acima — mudou de OAuth para conta de serviço)
- [x] Compartilhar as pastas/documentos do Drive listados acima com `louvorsj@louvorsj.iam.gserviceaccount.com` (acesso de Editor) — testado e confirmado (as 6 pastas/documentos aparecem para a conta de serviço)
- [x] Provedor Google no Supabase Auth (login dos usuários do app, diferente da conta de serviço do Drive) — testado via `/auth/v1/settings`, `google: true`
- [x] Variáveis de ambiente na Vercel e secrets no GitHub — projeto `louvor-sj` no Vercel (conta `louvorsj1pipbh`, time `sj-f21f`) deployado em produção: https://louvor-sj-ashy.vercel.app ; as 4 env vars configuradas em Production/Preview/Development; secrets do GitHub (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_DB_URL`) configurados e os 2 workflows testados com sucesso. Deploy automático a cada push conectado (repositório **tornado público** — plano Hobby do Vercel não conecta repositório privado de Organização do GitHub; sem segredos no histórico, código/repertório abertos não é problema para um app de louvor)
- [x] Conferir se a cópia da pasta Slides está completa (decisão: usar só a pasta nova como fonte, sem comparar com a antiga; prefixo "Cópia de " removido dos 50 arquivos)

## Decisões ainda abertas

- Refrão repetido deve aparecer escrito de novo nos slides? (Padrão até decidir: seguir a letra como foi colada.)
- Confirmar se o histórico de cultos será usado.

@AGENTS.md
