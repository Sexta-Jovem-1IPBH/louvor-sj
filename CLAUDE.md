# App de Louvor SJ — 1ª IPBH

App web (PWA, uso principal no celular) para centralizar o material de louvor: repertório, letras, slides, cifras (resumida e ampla), mídias (áudios e vídeos) e histórico de cultos.

O dono do projeto é o Arthur (estudante de engenharia de produção, nível técnico intermediário). Explique decisões técnicas de forma didática quando relevante e peça confirmação antes de ações irreversíveis.

## Stack

- **Frontend/backend:** Next.js (App Router) + TypeScript + Tailwind, hospedado na **Vercel** (plano Hobby).
- **Banco + login:** **Supabase** (plano Free, região São Paulo). Postgres + Supabase Auth com provedor Google.
- **Arquivos:** **Google Drive** da conta pessoal do Arthur (PowerPoints, áudios, vídeos, documentos). O Supabase guarda só dados e IDs/links do Drive.
- **Automação:** **GitHub Actions** (despertador anti-pausa e backup semanal).
- Integração Google: projeto Google Cloud dedicado (`louvorsj`, dono é a conta `louvorsj.1pipbh@gmail.com` criada só para o projeto). Drive API e Docs API ativadas. Autenticação via **conta de serviço** (`louvorsj@louvorsj.iam.gserviceaccount.com`), chave guardada em variável de ambiente, nunca no código. Decisão (mudou do plano original de OAuth com refresh token): evita a expiração de token de 7 dias que apps OAuth em modo "Teste" têm com escopos restritos do Drive, e não exige verificação do Google. Efeito prático: as pastas/documentos do Drive precisam ser **compartilhados manualmente** (como Editor) com o e-mail da conta de serviço para o app enxergá-los.

### O que a conta de serviço pode e não pode (verificado em 2026-10-01)

| Operação | Pode? | Observação |
|---|---|---|
| Ler arquivos compartilhados com ela | ✅ | toda a importação saiu daqui |
| Editar o **conteúdo** de documento existente | ✅ | testado no Repertório SJ via Docs API `batchUpdate` |
| Renomear arquivos | ✅ | 174 arquivos renomeados |
| **Criar** arquivo ou pasta | ❌ | *"Service Accounts do not have storage quota"* — contas de serviço fora do Workspace não têm cota, então falha mesmo dentro de pasta compartilhada |
| Apagar / mover para lixeira | ❌ | `canDelete: false`, `canTrash: false` (não é dona dos arquivos) |

Consequência: reescrever o Repertório SJ e o documento de cifras **funciona** com a conta de serviço. Gerar slides novos e subir mídia **não**.

**Decisão (2026-10-01) para a criação de arquivos:** usar o **token do Google da pessoa logada no app**, não um segundo serviço. O login com Google já existe (Supabase Auth); basta pedir o escopo `drive.file` junto e usar o `provider_token` da sessão para criar o arquivo em nome de quem está usando. Vantagens: sem custo, sem token de servidor que expira, sem verificação do Google (`drive.file` não é escopo restrito), e o arquivo nasce pertencendo a uma pessoa de verdade, consumindo a cota dela. Combina com a regra de que a mídia sobe direto do navegador.

A implementar junto com a fase 2, nesta ordem:
1. adicionar `drive.file` aos escopos na tela de consentimento do Google Cloud e no `signInWithOAuth` do app;
2. **verificar primeiro:** se o escopo `drive.file` consegue criar arquivo dentro de uma pasta pré-existente passando o ID dela. Se não conseguir, o caminho conhecido é o **Google Picker**, em que a pessoa escolhe a pasta uma vez e o app ganha acesso a ela;
3. quem for gerar slides precisa ter acesso de edição à pasta Slides — ou seja, a automação da regra 4 só roda para quem o Arthur autorizou no Drive, e para os demais o app registra a música e marca a pendência "sem slides".

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
| **Repertório SJ** (Google Docs) — lista mestre | `1BNvY-rXJDV6SiUMssoAV84cWjhYjxjNnJVCS9-_kzws` | 138 títulos, um por parágrafo. Fonte da verdade na importação; depois é reescrito pelo app |
| **Pasta Slides nova** (do Arthur) — destino oficial | `1ae2pC573LtGy06cqkdBiEAdKzET6nG1Y` | Fonte única. Em 2026-10-01 o Arthur copiou o resto da pasta antiga (224 arquivos); prefixo "Cópia de " removido de todos, redundantes marcados `ZZ DUPLICADO` e não-músicas marcadas `ZZ REVISAR` (ver `scripts/import/09`) |
| Pasta Slides antiga (do Lucas) | `1HFSEoAXzFyaCkWClCrEt7rKW0RCm9_4L` | Só leitura; já copiada para a pasta nova, não é mais usada |
| Pasta Cifras | `1ZPYd502E4kQRlC_CPCfDQQH-tNaFhu_O` | |
| "(Todas as cifras).docx" | `14Jm9z-iaVBPdcUPt5gtJlW6kBxOc--kt` | Cifras resumidas, lido direto como .docx (`scripts/import/02`). Para a reescrita automática vai precisar virar Google Docs — e isso **não pode ser feito pela conta de serviço** (ver limitação acima) |
| "(Todas as cifras).pdf" | `1A_QTKuUxEAGQgsQaXhfpp1xHtjbHf7WG` | |
| Pasta "Áudios e Divisões de vozes" | `1u0rX_mODCcso9EjkiB0K8ECWbHtZ6GbS` | Uma subpasta por música — manter esse padrão para novos áudios |
| Pasta Vídeos | `1MSCODB400NWO_bpOROtT5A7zIf06DTaN` | Criar subpasta por música para novos vídeos |

### Formatos observados

- **Documento de cifras:** título da música numa linha, seguido de linhas de acordes separadas por linha em branco, sem rótulos de seção. 132 músicas, das quais 61 só têm o título (sem cifra ainda). A quantidade de linhas em branco entre as partes é irregular e **não** indica fim de música — o que separa uma música da outra é a linha de título. Notação brasileira em uso: `7M`, `A4`, `º`, `°`, `ø`, `(x2)` (o dicionário de acordes está em `scripts/import/03`).
- **Slides:** 1 slide de título (nome em maiúsculas) + slides com blocos de até 4 linhas de letra. As quebras de linha dentro do slide são tags `<a:br/>`, não parágrafos — quem ignora isso gruda as linhas da letra. Usar um PowerPoint existente (ex.: "Louvores e honras") como referência de estilo/modelo; há também um "0. Modelo slide 1.pptx" na pasta.
- **Discrepâncias conhecidas:** "És maia Forte" (repertório) = "És mais Forte" (slides); "Senhor, guia meu caminhar" = "Guia meu caminhar.ppt" (formato antigo; não dá para ler nem converter pela conta de serviço); "Mocidade presbiteriana (Hino)" = "Hino da Mocidade - Hino 382". Há slides fora do repertório → tela de revisão, com padrão "adicionar ao repertório".

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

1. **Importação e consulta — concluída.** Schema do Supabase; importação das três fontes do Drive (176 músicas e 985 seções, em 2026-10-01, via `scripts/import/`); tela do repertório com busca, filtros e selos; página da música com abas; transposição de tom; reescrita do documento Repertório SJ (`src/lib/google/repertorio.ts`, rodada em 2026-10-02 — o documento foi de 138 para 176 títulos).

### Como a importação foi feita (2026-10-01)

Scripts numerados em `scripts/import/`, rodados em ordem (`node --env-file=.env.local scripts/import/<arquivo>`). As saídas `out-*.json` ficam fora do Git.

Resultado: 176 músicas = 138 do Repertório SJ + 38 que só existiam como slide (o CLAUDE.md já definia "adicionar ao repertório" como padrão para esse caso). Dessas, 155 com letra, 71 com acordes, 155 com slide vinculado; 21 músicas do repertório seguem sem slide.

Decisões do casamento de nomes (`scripts/import/10`), úteis se for preciso reimportar:
- casa primeiro por apelido conhecido, depois por nome de arquivo exato, depois pelo título dentro do slide, e só então por semelhança (Levenshtein + sobreposição de palavras);
- semelhança abaixo de 0.86 é **recusada** e a música vira nova — pegou os falsos positivos "Confissões"≈"Missões" e "Salmo 139"≈"Salmo 34";
- `SJ.pptx` é conteúdo repetido de "O meu louvor é fruto", não entra como música.

As seções entram como "Parte 1, Parte 2…" pareadas por índice, porque letra (dos slides) e acordes (do documento de cifras) são fontes independentes com quantidades diferentes de blocos. A rotulagem correta (Intro, Refrão…) fica para a interface, depois.

### Transposição (`src/lib/cifras/transpor.ts`)

Transpõe a cifra resumida (linhas de acordes) e a ampla (ChordPro `[A]letra`) com o mesmo controle, preservando espaçamento, parênteses, marcadores como `(x2)` e símbolos `º`/`°`/`ø`. Mantém o estilo do acorde original: quem escreveu bemol continua lendo bemol.

**Decisão do Arthur (2026-10-02): a transposição usa sustenidos.** Subir meio tom de A dá `A#`, e não `Bb`. Enarmonicamente correto e é como os sites de cifra brasileiros costumam escrever. Não precisa "melhorar" isso depois.
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
