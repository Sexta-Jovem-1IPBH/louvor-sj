export type SlidesOrigem = "manual" | "gerado";

export type TipoMidia =
  | "segunda_voz"
  | "voz_principal"
  | "instrumental"
  | "ensaio"
  | "referencia";

export interface Musica {
  id: string;
  titulo: string;
  titulo_normalizado: string;
  tom_original: string | null;
  tom_grupo: string | null;
  slides_drive_id: string | null;
  slides_origem: SlidesOrigem | null;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface Secao {
  id: string;
  musica_id: string;
  ordem: number;
  tipo: string;
  acordes: string | null;
  letra: string | null;
  letra_cifrada: string | null;
}

export interface Midia {
  id: string;
  musica_id: string;
  tipo: TipoMidia | null;
  voz_instrumento: string | null;
  drive_file_id: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
  enviado_por: string | null;
  criado_em: string;
}

export interface Culto {
  id: string;
  data: string;
  observacao: string | null;
}

export interface SetlistItem {
  id: string;
  culto_id: string;
  musica_id: string;
  ordem: number;
  tom: string | null;
}

export interface MusicaComStatus extends Musica {
  temLetra: boolean;
  temSlides: boolean;
  temResumida: boolean;
  temAmpla: boolean;
  numMidias: number;
}
