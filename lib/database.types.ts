export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      unidades: {
        Row: {
          id: string;
          nome: string;
          sigla: string;
        };
        Insert: {
          id?: string;
          nome: string;
          sigla: string;
        };
        Update: {
          id?: string;
          nome?: string;
          sigla?: string;
        };
        Relationships: [];
      };
      safras: {
        Row: {
          id: string;
          nome: string;
        };
        Insert: {
          id?: string;
          nome: string;
        };
        Update: {
          id?: string;
          nome?: string;
        };
        Relationships: [];
      };
      culturas: {
        Row: {
          id: string;
          nome: string;
          unidade_padrao_id: string | null;
        };
        Insert: {
          id?: string;
          nome: string;
          unidade_padrao_id?: string | null;
        };
        Update: {
          id?: string;
          nome?: string;
          unidade_padrao_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "culturas_unidade_padrao_id_fkey";
            columns: ["unidade_padrao_id"];
            isOneToOne: false;
            referencedRelation: "unidades";
            referencedColumns: ["id"];
          },
        ];
      };
      talhoes: {
        Row: {
          id: string;
          nome: string;
          geojson: Json | null;
          ativo: boolean;
          criado_em: string;
        };
        Insert: {
          id?: string;
          nome: string;
          geojson?: Json | null;
          ativo?: boolean;
          criado_em?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          geojson?: Json | null;
          ativo?: boolean;
          criado_em?: string;
        };
        Relationships: [];
      };
      plantios: {
        Row: {
          id: string;
          talhao_id: string;
          cultura_id: string;
          safra_id: string;
          ano: number;
          data_plantio: string;
          data_colheita: string | null;
          area_ha: number;
          volume_colhido: number | null;
          unidade_id: string;
          produtividade_sc_ha: number | null;
          latitude: number | null;
          longitude: number | null;
          area_unidade: string;
          criado_em: string;
          criado_por: string | null;
          agronomo: string | null;
        };
        Insert: {
          id?: string;
          talhao_id: string;
          cultura_id: string;
          safra_id: string;
          ano: number;
          data_plantio: string;
          data_colheita?: string | null;
          area_ha: number;
          volume_colhido?: number | null;
          unidade_id: string;
          produtividade_sc_ha?: number | null;
          latitude?: number | null;
          longitude?: number | null;
          area_unidade?: string;
          criado_em?: string;
          criado_por?: string | null;
          agronomo?: string | null;
        };
        Update: {
          id?: string;
          talhao_id?: string;
          cultura_id?: string;
          safra_id?: string;
          ano?: number;
          data_plantio?: string;
          data_colheita?: string | null;
          area_ha?: number;
          volume_colhido?: number | null;
          unidade_id?: string;
          produtividade_sc_ha?: number | null;
          latitude?: number | null;
          longitude?: number | null;
          area_unidade?: string;
          criado_em?: string;
          criado_por?: string | null;
          agronomo?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "plantios_talhao_id_fkey";
            columns: ["talhao_id"];
            isOneToOne: false;
            referencedRelation: "talhoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plantios_cultura_id_fkey";
            columns: ["cultura_id"];
            isOneToOne: false;
            referencedRelation: "culturas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plantios_safra_id_fkey";
            columns: ["safra_id"];
            isOneToOne: false;
            referencedRelation: "safras";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plantios_unidade_id_fkey";
            columns: ["unidade_id"];
            isOneToOne: false;
            referencedRelation: "unidades";
            referencedColumns: ["id"];
          },
        ];
      };
      uploads: {
        Row: {
          id: string;
          nome_arquivo: string;
          status: string;
          criado_em: string;
          criado_por: string | null;
        };
        Insert: {
          id?: string;
          nome_arquivo: string;
          status: string;
          criado_em?: string;
          criado_por?: string | null;
        };
        Update: {
          id?: string;
          nome_arquivo?: string;
          status?: string;
          criado_em?: string;
          criado_por?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      resumo_producao_por_ano_cultura: {
        Args: Record<PropertyKey, never>;
        Returns: {
          ano: number;
          cultura: string;
          total_area: number;
          total_volume: number | null;
          avg_produtividade: number | null;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

/** Resultado da RPC resumo_producao_por_ano_cultura, usado no dashboard. */
export type ResumoProducao = {
  ano: number;
  cultura: string;
  total_area: number;
  total_volume: number | null;
  avg_produtividade: number | null;
};

/** Resultado do SELECT de plantios com joins, usado na página /plantios. */
export type PlantioComDetalhes = Pick<
  Tables<"plantios">,
  | "id"
  | "ano"
  | "data_plantio"
  | "data_colheita"
  | "area_ha"
  | "volume_colhido"
  | "produtividade_sc_ha"
  | "agronomo"
  | "latitude"
  | "longitude"
> & {
  talhoes: Pick<Tables<"talhoes">, "nome"> | null;
  culturas: Pick<Tables<"culturas">, "nome"> | null;
  safras: Pick<Tables<"safras">, "nome"> | null;
  unidades: Pick<Tables<"unidades">, "sigla"> | null;
};

/** Plantio enriquecido usado nos KPIs e gráficos do dashboard. */
export type PlantioEnriquecido = {
  id: string;
  ano: number;
  data_plantio: string | null;
  data_colheita: string | null;
  area_ha: number;
  volume_colhido: number | null;
  produtividade_sc_ha: number | null;
  talhao_id: string | null;
  talhao: string;
  cultura: string;
  safra: string;
};

/** Dado agregado por (cultura, talhão, quinzena) para a página Janela de Plantio. */
export type JanelaData = {
  cultura: string;
  talhao: string;
  periodo: string;
  mes: number;
  quinzena: 1 | 2;
  produtividade_media: number;
  total_plantios: number;
  area_media: number;
};
