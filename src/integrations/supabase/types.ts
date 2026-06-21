export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      business_plans: {
        Row: {
          ano_inicio: number
          created_at: string
          descricao: string | null
          empresa_id: string | null
          horizonte: Database["public"]["Enums"]["plan_horizon"]
          id: string
          meta_ebitda: number | null
          meta_receita: number | null
          meta_valuation: number | null
          progresso: number | null
          status: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          ano_inicio: number
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          horizonte: Database["public"]["Enums"]["plan_horizon"]
          id?: string
          meta_ebitda?: number | null
          meta_receita?: number | null
          meta_valuation?: number | null
          progresso?: number | null
          status?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          ano_inicio?: number
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          horizonte?: Database["public"]["Enums"]["plan_horizon"]
          id?: string
          meta_ebitda?: number | null
          meta_receita?: number | null
          meta_valuation?: number | null
          progresso?: number | null
          status?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_plans_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_custo: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      custos: {
        Row: {
          categoria_id: string | null
          centro_custo: string | null
          created_at: string
          created_by: string | null
          data: string
          descricao: string | null
          empresa_id: string | null
          id: string
          nome: string
          status: string
          tipo_custo: Database["public"]["Enums"]["tipo_custo"]
          updated_at: string
          valor: number
        }
        Insert: {
          categoria_id?: string | null
          centro_custo?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          status?: string
          tipo_custo?: Database["public"]["Enums"]["tipo_custo"]
          updated_at?: string
          valor?: number
        }
        Update: {
          categoria_id?: string | null
          centro_custo?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          status?: string
          tipo_custo?: Database["public"]["Enums"]["tipo_custo"]
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "custos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          codigo: string
          cor_tema: string | null
          created_at: string
          id: string
          nome: string
          setor: string | null
        }
        Insert: {
          codigo: string
          cor_tema?: string | null
          created_at?: string
          id?: string
          nome: string
          setor?: string | null
        }
        Update: {
          codigo?: string
          cor_tema?: string | null
          created_at?: string
          id?: string
          nome?: string
          setor?: string | null
        }
        Relationships: []
      }
      kpi_snapshots: {
        Row: {
          caixa: number | null
          capital_giro: number | null
          contas_pagar: number | null
          contas_receber: number | null
          created_at: string
          ebitda: number | null
          empresa_id: string | null
          endividamento: number | null
          id: string
          lucro_liquido: number | null
          periodo: string
          receita: number | null
          valuation: number | null
        }
        Insert: {
          caixa?: number | null
          capital_giro?: number | null
          contas_pagar?: number | null
          contas_receber?: number | null
          created_at?: string
          ebitda?: number | null
          empresa_id?: string | null
          endividamento?: number | null
          id?: string
          lucro_liquido?: number | null
          periodo: string
          receita?: number | null
          valuation?: number | null
        }
        Update: {
          caixa?: number | null
          capital_giro?: number | null
          contas_pagar?: number | null
          contas_receber?: number | null
          created_at?: string
          ebitda?: number | null
          empresa_id?: string | null
          endividamento?: number | null
          id?: string
          lucro_liquido?: number | null
          periodo?: string
          receita?: number | null
          valuation?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_snapshots_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_executive: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "master_admin"
        | "socio"
        | "diretor"
        | "gestor"
        | "consultor"
        | "auditor"
      plan_horizon: "1_ano" | "3_anos" | "5_anos" | "10_anos"
      tipo_custo: "fixo" | "variavel" | "unico" | "recorrente"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "master_admin",
        "socio",
        "diretor",
        "gestor",
        "consultor",
        "auditor",
      ],
      plan_horizon: ["1_ano", "3_anos", "5_anos", "10_anos"],
      tipo_custo: ["fixo", "variavel", "unico", "recorrente"],
    },
  },
} as const
