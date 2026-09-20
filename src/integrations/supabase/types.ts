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
      decisions: {
        Row: {
          created_at: string
          created_by: string | null
          data_decisao: string | null
          descricao: string | null
          empresa_id: string | null
          id: string
          impacto_financeiro: number | null
          responsavel: string | null
          status: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_decisao?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          impacto_financeiro?: number | null
          responsavel?: string | null
          status?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_decisao?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          impacto_financeiro?: number | null
          responsavel?: string | null
          status?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "decisions_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          categoria: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          empresa_id: string | null
          id: string
          nome: string
          updated_at: string
          url: string | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          cnpj: string | null
          codigo: string
          configuracoes: Json
          cor_primaria: string | null
          cor_secundaria: string | null
          cor_tema: string | null
          created_at: string
          id: string
          logo_url: string | null
          nome: string
          nome_fantasia: string | null
          razao_social: string | null
          segmento: string | null
          setor: string | null
          situacao: string
        }
        Insert: {
          cnpj?: string | null
          codigo: string
          configuracoes?: Json
          cor_primaria?: string | null
          cor_secundaria?: string | null
          cor_tema?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          nome: string
          nome_fantasia?: string | null
          razao_social?: string | null
          segmento?: string | null
          setor?: string | null
          situacao?: string
        }
        Update: {
          cnpj?: string | null
          codigo?: string
          configuracoes?: Json
          cor_primaria?: string | null
          cor_secundaria?: string | null
          cor_tema?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          nome?: string
          nome_fantasia?: string | null
          razao_social?: string | null
          segmento?: string | null
          setor?: string | null
          situacao?: string
        }
        Relationships: []
      }
      financial_scenarios: {
        Row: {
          created_at: string
          descricao: string | null
          empresa_id: string | null
          id: string
          nome: string
          payload: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          payload?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          payload?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_scenarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      growth_initiatives: {
        Row: {
          created_at: string
          created_by: string | null
          descricao: string | null
          empresa_id: string | null
          id: string
          investimento: number | null
          prazo_meses: number | null
          retorno_projetado: number | null
          status: string | null
          tipo: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          investimento?: number | null
          prazo_meses?: number | null
          retorno_projetado?: number | null
          status?: string | null
          tipo?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          investimento?: number | null
          prazo_meses?: number | null
          retorno_projetado?: number | null
          status?: string | null
          tipo?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "growth_initiatives_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_updates: {
        Row: {
          autor: string | null
          conteudo: string | null
          created_at: string
          created_by: string | null
          id: string
          periodo: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          autor?: string | null
          conteudo?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          periodo?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          autor?: string | null
          conteudo?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          periodo?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      key_results: {
        Row: {
          atual: number | null
          created_at: string
          descricao: string
          id: string
          meta: number | null
          okr_id: string
          unidade: string | null
          updated_at: string
        }
        Insert: {
          atual?: number | null
          created_at?: string
          descricao: string
          id?: string
          meta?: number | null
          okr_id: string
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          atual?: number | null
          created_at?: string
          descricao?: string
          id?: string
          meta?: number | null
          okr_id?: string
          unidade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "key_results_okr_id_fkey"
            columns: ["okr_id"]
            isOneToOne: false
            referencedRelation: "okrs"
            referencedColumns: ["id"]
          },
        ]
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
      kpis: {
        Row: {
          categoria: string | null
          created_at: string
          created_by: string | null
          empresa_id: string | null
          id: string
          meta: number | null
          nome: string
          observacoes: string | null
          periodo: string | null
          unidade: string | null
          updated_at: string
          valor: number | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id?: string | null
          id?: string
          meta?: number | null
          nome: string
          observacoes?: string | null
          periodo?: string | null
          unidade?: string | null
          updated_at?: string
          valor?: number | null
        }
        Update: {
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id?: string | null
          id?: string
          meta?: number | null
          nome?: string
          observacoes?: string | null
          periodo?: string | null
          unidade?: string | null
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kpis_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      markup_calculations: {
        Row: {
          categoria: string | null
          centro_custo: string | null
          created_at: string
          descricao: string | null
          empresa_id: string | null
          fornecedor: string | null
          id: string
          inputs: Json
          lucro_desejado: number | null
          margem_desejada: number | null
          preco_sugerido: number | null
          produto: string
          resultados: Json
          servico: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          categoria?: string | null
          centro_custo?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          fornecedor?: string | null
          id?: string
          inputs?: Json
          lucro_desejado?: number | null
          margem_desejada?: number | null
          preco_sugerido?: number | null
          produto: string
          resultados?: Json
          servico?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          categoria?: string | null
          centro_custo?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          fornecedor?: string | null
          id?: string
          inputs?: Json
          lucro_desejado?: number | null
          margem_desejada?: number | null
          preco_sugerido?: number | null
          produto?: string
          resultados?: Json
          servico?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "markup_calculations_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      okrs: {
        Row: {
          created_at: string
          created_by: string | null
          descricao: string | null
          empresa_id: string | null
          id: string
          objetivo: string
          progresso: number | null
          responsavel: string | null
          trimestre: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          objetivo: string
          progresso?: number | null
          responsavel?: string | null
          trimestre?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          objetivo?: string
          progresso?: number | null
          responsavel?: string | null
          trimestre?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "okrs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      payback_projects: {
        Row: {
          created_at: string
          created_by: string | null
          descricao: string | null
          empresa_id: string | null
          id: string
          investimento_inicial: number | null
          nome: string
          prazo_meses: number | null
          retorno_mensal: number | null
          status: string | null
          taxa_desconto: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          investimento_inicial?: number | null
          nome: string
          prazo_meses?: number | null
          retorno_mensal?: number | null
          status?: string | null
          taxa_desconto?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          investimento_inicial?: number | null
          nome?: string
          prazo_meses?: number | null
          retorno_mensal?: number | null
          status?: string | null
          taxa_desconto?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payback_projects_empresa_id_fkey"
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
      px_ai_usage: {
        Row: {
          created_at: string
          id: string
          modelo: string
          modulo: string
          tokens_in: number
          tokens_out: number
        }
        Insert: {
          created_at?: string
          id?: string
          modelo: string
          modulo: string
          tokens_in?: number
          tokens_out?: number
        }
        Update: {
          created_at?: string
          id?: string
          modelo?: string
          modulo?: string
          tokens_in?: number
          tokens_out?: number
        }
        Relationships: []
      }
      px_api_clients: {
        Row: {
          allowed_origins: string[]
          api_key_hash: string
          api_key_prefix: string
          ativo: boolean
          created_at: string
          criado_por: string | null
          descricao: string | null
          escopos: string[]
          id: string
          nome: string
          observacoes: string | null
          rate_limit_rpm: number
          secret_hash: string
          sistema_key: string
          updated_at: string
        }
        Insert: {
          allowed_origins?: string[]
          api_key_hash: string
          api_key_prefix: string
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          escopos?: string[]
          id?: string
          nome: string
          observacoes?: string | null
          rate_limit_rpm?: number
          secret_hash: string
          sistema_key: string
          updated_at?: string
        }
        Update: {
          allowed_origins?: string[]
          api_key_hash?: string
          api_key_prefix?: string
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          escopos?: string[]
          id?: string
          nome?: string
          observacoes?: string | null
          rate_limit_rpm?: number
          secret_hash?: string
          sistema_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      px_api_idempotency: {
        Row: {
          api_client_id: string
          created_at: string
          endpoint: string
          expires_at: string
          id: string
          idempotency_key: string
          method: string
          request_hash: string
          response_body: Json
          response_status: number
        }
        Insert: {
          api_client_id: string
          created_at?: string
          endpoint: string
          expires_at?: string
          id?: string
          idempotency_key: string
          method: string
          request_hash: string
          response_body: Json
          response_status: number
        }
        Update: {
          api_client_id?: string
          created_at?: string
          endpoint?: string
          expires_at?: string
          id?: string
          idempotency_key?: string
          method?: string
          request_hash?: string
          response_body?: Json
          response_status?: number
        }
        Relationships: [
          {
            foreignKeyName: "px_api_idempotency_api_client_id_fkey"
            columns: ["api_client_id"]
            isOneToOne: false
            referencedRelation: "px_api_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      px_api_logs: {
        Row: {
          api_client_id: string | null
          created_at: string
          endpoint: string
          erro_codigo: string | null
          erro_mensagem: string | null
          id: string
          ip: string | null
          latencia_ms: number | null
          metodo: string
          request_id: string | null
          sistema_key: string | null
          status: number
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          api_client_id?: string | null
          created_at?: string
          endpoint: string
          erro_codigo?: string | null
          erro_mensagem?: string | null
          id?: string
          ip?: string | null
          latencia_ms?: number | null
          metodo: string
          request_id?: string | null
          sistema_key?: string | null
          status: number
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          api_client_id?: string | null
          created_at?: string
          endpoint?: string
          erro_codigo?: string | null
          erro_mensagem?: string | null
          id?: string
          ip?: string | null
          latencia_ms?: number | null
          metodo?: string
          request_id?: string | null
          sistema_key?: string | null
          status?: number
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "px_api_logs_api_client_id_fkey"
            columns: ["api_client_id"]
            isOneToOne: false
            referencedRelation: "px_api_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      px_api_tokens: {
        Row: {
          api_client_id: string
          created_at: string
          escopos: string[]
          expires_at: string
          id: string
          ip: string | null
          jti: string
          refresh_expires_at: string | null
          refresh_token_hash: string | null
          revogado: boolean
          revogado_em: string | null
          revogado_por: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          api_client_id: string
          created_at?: string
          escopos?: string[]
          expires_at: string
          id?: string
          ip?: string | null
          jti: string
          refresh_expires_at?: string | null
          refresh_token_hash?: string | null
          revogado?: boolean
          revogado_em?: string | null
          revogado_por?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          api_client_id?: string
          created_at?: string
          escopos?: string[]
          expires_at?: string
          id?: string
          ip?: string | null
          jti?: string
          refresh_expires_at?: string | null
          refresh_token_hash?: string | null
          revogado?: boolean
          revogado_em?: string | null
          revogado_por?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "px_api_tokens_api_client_id_fkey"
            columns: ["api_client_id"]
            isOneToOne: false
            referencedRelation: "px_api_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      px_audit_log: {
        Row: {
          action: string
          created_at: string
          diff: Json | null
          entity_id: string
          entity_type: string
          id: string
          user_id: string | null
          user_label: string | null
        }
        Insert: {
          action: string
          created_at?: string
          diff?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          user_id?: string | null
          user_label?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          diff?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          user_id?: string | null
          user_label?: string | null
        }
        Relationships: []
      }
      px_cliente_credito: {
        Row: {
          bloqueado: boolean
          cliente_id: string
          created_at: string
          dia_fechamento: number | null
          dia_vencimento: number | null
          id: string
          liberado_ate: string | null
          liberado_por: string | null
          limite_credito: number
          motivo_bloqueio: string | null
          observacoes: string | null
          prazo_dias: number
          updated_at: string
        }
        Insert: {
          bloqueado?: boolean
          cliente_id: string
          created_at?: string
          dia_fechamento?: number | null
          dia_vencimento?: number | null
          id?: string
          liberado_ate?: string | null
          liberado_por?: string | null
          limite_credito?: number
          motivo_bloqueio?: string | null
          observacoes?: string | null
          prazo_dias?: number
          updated_at?: string
        }
        Update: {
          bloqueado?: boolean
          cliente_id?: string
          created_at?: string
          dia_fechamento?: number | null
          dia_vencimento?: number | null
          id?: string
          liberado_ate?: string | null
          liberado_por?: string | null
          limite_credito?: number
          motivo_bloqueio?: string | null
          observacoes?: string | null
          prazo_dias?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "px_cliente_credito_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "px_cliente_saldo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "px_cliente_credito_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "px_registry_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      px_cliente_lancamentos: {
        Row: {
          cliente_id: string
          created_at: string
          created_by: string | null
          descricao: string
          emissao: string
          id: string
          observacoes: string | null
          origem: string
          pago_em: string | null
          referencia_id: string | null
          referencia_tipo: string | null
          status: string
          tipo: string
          updated_at: string
          valor: number
          vencimento: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          created_by?: string | null
          descricao: string
          emissao?: string
          id?: string
          observacoes?: string | null
          origem: string
          pago_em?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          status?: string
          tipo: string
          updated_at?: string
          valor: number
          vencimento?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          descricao?: string
          emissao?: string
          id?: string
          observacoes?: string | null
          origem?: string
          pago_em?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          valor?: number
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "px_cliente_lancamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "px_cliente_saldo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "px_cliente_lancamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "px_registry_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      px_empresa_modulos: {
        Row: {
          ativo: boolean
          configuracoes: Json
          created_at: string
          empresa_id: string
          habilitado_em: string
          id: string
          modulo_key: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          configuracoes?: Json
          created_at?: string
          empresa_id: string
          habilitado_em?: string
          id?: string
          modulo_key: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          configuracoes?: Json
          created_at?: string
          empresa_id?: string
          habilitado_em?: string
          id?: string
          modulo_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "px_empresa_modulos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      px_events: {
        Row: {
          created_at: string
          id: string
          origem: string | null
          payload: Json
          tipo: string
        }
        Insert: {
          created_at?: string
          id?: string
          origem?: string | null
          payload?: Json
          tipo: string
        }
        Update: {
          created_at?: string
          id?: string
          origem?: string | null
          payload?: Json
          tipo?: string
        }
        Relationships: []
      }
      px_filiais: {
        Row: {
          ativo: boolean
          cidade: string | null
          cnpj: string | null
          created_at: string
          empresa_id: string
          id: string
          nome: string
          uf: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
          uf?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "px_filiais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      px_integration_inbox: {
        Row: {
          created_at: string
          erro: string | null
          evento: string
          external_id: string | null
          id: string
          payload: Json
          processed_at: string | null
          sistema_origem: string
          status: string
        }
        Insert: {
          created_at?: string
          erro?: string | null
          evento: string
          external_id?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          sistema_origem: string
          status?: string
        }
        Update: {
          created_at?: string
          erro?: string | null
          evento?: string
          external_id?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          sistema_origem?: string
          status?: string
        }
        Relationships: []
      }
      px_integration_links: {
        Row: {
          created_at: string
          id: string
          id_destino: string
          id_origem: string
          metadata: Json
          sistema_destino: string
          sistema_origem: string
          tipo_destino: string
          tipo_origem: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          id_destino: string
          id_origem: string
          metadata?: Json
          sistema_destino: string
          sistema_origem: string
          tipo_destino: string
          tipo_origem: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          id_destino?: string
          id_origem?: string
          metadata?: Json
          sistema_destino?: string
          sistema_origem?: string
          tipo_destino?: string
          tipo_origem?: string
          updated_at?: string
        }
        Relationships: []
      }
      px_perfil_permissoes: {
        Row: {
          acao: string
          created_at: string
          id: string
          perfil_id: string
          sistema_key: string
        }
        Insert: {
          acao: string
          created_at?: string
          id?: string
          perfil_id: string
          sistema_key: string
        }
        Update: {
          acao?: string
          created_at?: string
          id?: string
          perfil_id?: string
          sistema_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "px_perfil_permissoes_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "px_perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      px_perfis: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          is_system: boolean
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          is_system?: boolean
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          is_system?: boolean
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      px_registry_clientes: {
        Row: {
          api_payload: Json | null
          ativo: boolean
          bairro: string | null
          categorias: string[]
          cep: string | null
          cidade: string | null
          cnae_descricao: string | null
          cnae_principal: string | null
          cnpj: string
          complemento: string | null
          condicao_pagamento: string | null
          contato_cargo: string | null
          contato_nome: string | null
          created_at: string
          created_by: string | null
          data_abertura: string | null
          email: string | null
          id: string
          inativado_em: string | null
          inativado_por: string | null
          limite_credito: number | null
          logradouro: string | null
          motivo_inativacao: string | null
          natureza_juridica: string | null
          nome_fantasia: string | null
          numero: string | null
          observacoes: string | null
          observacoes_comerciais: string | null
          prazo_padrao_dias: number | null
          razao_social: string | null
          situacao_cadastral: string | null
          tabela_frete_id: string | null
          telefone: string | null
          uf: string | null
          updated_at: string
          updated_by: string | null
          whatsapp: string | null
        }
        Insert: {
          api_payload?: Json | null
          ativo?: boolean
          bairro?: string | null
          categorias?: string[]
          cep?: string | null
          cidade?: string | null
          cnae_descricao?: string | null
          cnae_principal?: string | null
          cnpj: string
          complemento?: string | null
          condicao_pagamento?: string | null
          contato_cargo?: string | null
          contato_nome?: string | null
          created_at?: string
          created_by?: string | null
          data_abertura?: string | null
          email?: string | null
          id?: string
          inativado_em?: string | null
          inativado_por?: string | null
          limite_credito?: number | null
          logradouro?: string | null
          motivo_inativacao?: string | null
          natureza_juridica?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          observacoes_comerciais?: string | null
          prazo_padrao_dias?: number | null
          razao_social?: string | null
          situacao_cadastral?: string | null
          tabela_frete_id?: string | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          updated_by?: string | null
          whatsapp?: string | null
        }
        Update: {
          api_payload?: Json | null
          ativo?: boolean
          bairro?: string | null
          categorias?: string[]
          cep?: string | null
          cidade?: string | null
          cnae_descricao?: string | null
          cnae_principal?: string | null
          cnpj?: string
          complemento?: string | null
          condicao_pagamento?: string | null
          contato_cargo?: string | null
          contato_nome?: string | null
          created_at?: string
          created_by?: string | null
          data_abertura?: string | null
          email?: string | null
          id?: string
          inativado_em?: string | null
          inativado_por?: string | null
          limite_credito?: number | null
          logradouro?: string | null
          motivo_inativacao?: string | null
          natureza_juridica?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          observacoes_comerciais?: string | null
          prazo_padrao_dias?: number | null
          razao_social?: string | null
          situacao_cadastral?: string | null
          tabela_frete_id?: string | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          updated_by?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      px_registry_contatos: {
        Row: {
          cargo: string | null
          cliente_id: string
          created_at: string
          created_by: string | null
          email: string | null
          endereco_id: string | null
          id: string
          is_principal: boolean
          nome: string
          observacoes: string | null
          setor: string
          telefone: string | null
          updated_at: string
          updated_by: string | null
          whatsapp: string | null
        }
        Insert: {
          cargo?: string | null
          cliente_id: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          endereco_id?: string | null
          id?: string
          is_principal?: boolean
          nome: string
          observacoes?: string | null
          setor?: string
          telefone?: string | null
          updated_at?: string
          updated_by?: string | null
          whatsapp?: string | null
        }
        Update: {
          cargo?: string | null
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          endereco_id?: string | null
          id?: string
          is_principal?: boolean
          nome?: string
          observacoes?: string | null
          setor?: string
          telefone?: string | null
          updated_at?: string
          updated_by?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "px_registry_contatos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "px_cliente_saldo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "px_registry_contatos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "px_registry_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "px_registry_contatos_endereco_id_fkey"
            columns: ["endereco_id"]
            isOneToOne: false
            referencedRelation: "px_registry_enderecos"
            referencedColumns: ["id"]
          },
        ]
      }
      px_registry_enderecos: {
        Row: {
          apelido: string | null
          ativo: boolean
          bairro: string | null
          cep: string | null
          cidade: string | null
          cliente_id: string
          complemento: string | null
          created_at: string
          created_by: string | null
          id: string
          is_padrao_destinatario: boolean
          is_padrao_remetente: boolean
          janela_recebimento: string | null
          logradouro: string | null
          numero: string | null
          observacoes: string | null
          ponto_referencia: string | null
          restricoes: string[]
          tipo: string
          uf: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          apelido?: string | null
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_id: string
          complemento?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_padrao_destinatario?: boolean
          is_padrao_remetente?: boolean
          janela_recebimento?: string | null
          logradouro?: string | null
          numero?: string | null
          observacoes?: string | null
          ponto_referencia?: string | null
          restricoes?: string[]
          tipo?: string
          uf?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          apelido?: string | null
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_id?: string
          complemento?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_padrao_destinatario?: boolean
          is_padrao_remetente?: boolean
          janela_recebimento?: string | null
          logradouro?: string | null
          numero?: string | null
          observacoes?: string | null
          ponto_referencia?: string | null
          restricoes?: string[]
          tipo?: string
          uf?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "px_registry_enderecos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "px_cliente_saldo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "px_registry_enderecos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "px_registry_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      px_registry_vinculos: {
        Row: {
          cliente_id: string
          id: string
          sistema_key: string
          vinculado_em: string
          vinculado_por: string | null
        }
        Insert: {
          cliente_id: string
          id?: string
          sistema_key: string
          vinculado_em?: string
          vinculado_por?: string | null
        }
        Update: {
          cliente_id?: string
          id?: string
          sistema_key?: string
          vinculado_em?: string
          vinculado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "px_registry_vinculos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "px_cliente_saldo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "px_registry_vinculos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "px_registry_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      px_shared_resources: {
        Row: {
          created_at: string
          empresa_origem_id: string
          empresas_compartilhadas: string[]
          id: string
          recurso_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_origem_id: string
          empresas_compartilhadas?: string[]
          id?: string
          recurso_id: string
          tipo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_origem_id?: string
          empresas_compartilhadas?: string[]
          id?: string
          recurso_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "px_shared_resources_empresa_origem_id_fkey"
            columns: ["empresa_origem_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      px_usuario_perfis: {
        Row: {
          created_at: string
          perfil_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          perfil_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          perfil_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "px_usuario_perfis_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "px_perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      px_usuario_sistemas: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          sistema_key: string
          ultimo_acesso: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          sistema_key: string
          ultimo_acesso?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          sistema_key?: string
          ultimo_acesso?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      px_usuarios_meta: {
        Row: {
          cargo: string | null
          created_at: string
          empresa_id: string | null
          login: string
          nome: string
          observacoes: string | null
          situacao: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cargo?: string | null
          created_at?: string
          empresa_id?: string | null
          login: string
          nome: string
          observacoes?: string | null
          situacao?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cargo?: string | null
          created_at?: string
          empresa_id?: string | null
          login?: string
          nome?: string
          observacoes?: string | null
          situacao?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "px_usuarios_meta_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      pxsales_atividades: {
        Row: {
          assunto: string
          cliente_id: string | null
          concluida: boolean
          concluida_em: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          empresa_id: string
          id: string
          lead_id: string | null
          oportunidade_id: string | null
          prevista_para: string | null
          responsavel_id: string | null
          resultado: string | null
          tipo: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assunto: string
          cliente_id?: string | null
          concluida?: boolean
          concluida_em?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id: string
          id?: string
          lead_id?: string | null
          oportunidade_id?: string | null
          prevista_para?: string | null
          responsavel_id?: string | null
          resultado?: string | null
          tipo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assunto?: string
          cliente_id?: string | null
          concluida?: boolean
          concluida_em?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          lead_id?: string | null
          oportunidade_id?: string | null
          prevista_para?: string | null
          responsavel_id?: string | null
          resultado?: string | null
          tipo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pxsales_atividades_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "px_cliente_saldo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "pxsales_atividades_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "px_registry_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pxsales_atividades_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pxsales_atividades_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "pxsales_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pxsales_atividades_oportunidade_id_fkey"
            columns: ["oportunidade_id"]
            isOneToOne: false
            referencedRelation: "pxsales_oportunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      pxsales_comissao_regras: {
        Row: {
          ativo: boolean
          base: string
          cliente_id: string | null
          created_at: string
          created_by: string | null
          empresa_id: string
          id: string
          nome: string
          observacoes: string | null
          percentual: number
          responsavel_id: string | null
          tipo: string
          tipo_operacao: string | null
          updated_at: string
          updated_by: string | null
          valor_fixo: number
          vigencia_fim: string | null
          vigencia_inicio: string
        }
        Insert: {
          ativo?: boolean
          base?: string
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id: string
          id?: string
          nome: string
          observacoes?: string | null
          percentual?: number
          responsavel_id?: string | null
          tipo?: string
          tipo_operacao?: string | null
          updated_at?: string
          updated_by?: string | null
          valor_fixo?: number
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Update: {
          ativo?: boolean
          base?: string
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          observacoes?: string | null
          percentual?: number
          responsavel_id?: string | null
          tipo?: string
          tipo_operacao?: string | null
          updated_at?: string
          updated_by?: string | null
          valor_fixo?: number
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "pxsales_comissao_regras_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "px_cliente_saldo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "pxsales_comissao_regras_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "px_registry_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pxsales_comissao_regras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      pxsales_comissoes: {
        Row: {
          apurada_em: string
          base: string
          base_valor: number
          cliente_id: string | null
          comissao_origem_id: string | null
          competencia: string
          congelada_em: string
          created_at: string
          created_by: string | null
          empresa_id: string
          empresa_nome: string
          estornada_em: string | null
          estornada_por: string | null
          estorno_motivo: string | null
          id: string
          observacoes: string | null
          percentual: number
          proposta_id: string | null
          regra_id: string | null
          regra_nome: string | null
          regra_snapshot: Json
          regra_vigencia_fim: string | null
          regra_vigencia_inicio: string | null
          responsavel_id: string | null
          status: string
          updated_at: string
          updated_by: string | null
          valor: number
          valor_fixo: number
        }
        Insert: {
          apurada_em?: string
          base?: string
          base_valor?: number
          cliente_id?: string | null
          comissao_origem_id?: string | null
          competencia?: string
          congelada_em?: string
          created_at?: string
          created_by?: string | null
          empresa_id: string
          empresa_nome?: string
          estornada_em?: string | null
          estornada_por?: string | null
          estorno_motivo?: string | null
          id?: string
          observacoes?: string | null
          percentual?: number
          proposta_id?: string | null
          regra_id?: string | null
          regra_nome?: string | null
          regra_snapshot?: Json
          regra_vigencia_fim?: string | null
          regra_vigencia_inicio?: string | null
          responsavel_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          valor?: number
          valor_fixo?: number
        }
        Update: {
          apurada_em?: string
          base?: string
          base_valor?: number
          cliente_id?: string | null
          comissao_origem_id?: string | null
          competencia?: string
          congelada_em?: string
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          empresa_nome?: string
          estornada_em?: string | null
          estornada_por?: string | null
          estorno_motivo?: string | null
          id?: string
          observacoes?: string | null
          percentual?: number
          proposta_id?: string | null
          regra_id?: string | null
          regra_nome?: string | null
          regra_snapshot?: Json
          regra_vigencia_fim?: string | null
          regra_vigencia_inicio?: string | null
          responsavel_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          valor?: number
          valor_fixo?: number
        }
        Relationships: [
          {
            foreignKeyName: "pxsales_comissoes_comissao_origem_id_fkey"
            columns: ["comissao_origem_id"]
            isOneToOne: false
            referencedRelation: "pxsales_comissoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pxsales_comissoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pxsales_comissoes_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "pxsales_propostas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pxsales_comissoes_regra_id_fkey"
            columns: ["regra_id"]
            isOneToOne: false
            referencedRelation: "pxsales_comissao_regras"
            referencedColumns: ["id"]
          },
        ]
      }
      pxsales_cotacao_componentes: {
        Row: {
          base: number
          codigo: string
          cotacao_id: string
          created_at: string
          detalhe: Json
          empresa_id: string
          id: string
          nome: string
          ordem: number
          valor: number
        }
        Insert: {
          base?: number
          codigo: string
          cotacao_id: string
          created_at?: string
          detalhe?: Json
          empresa_id: string
          id?: string
          nome: string
          ordem?: number
          valor?: number
        }
        Update: {
          base?: number
          codigo?: string
          cotacao_id?: string
          created_at?: string
          detalhe?: Json
          empresa_id?: string
          id?: string
          nome?: string
          ordem?: number
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pxsales_cotacao_componentes_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "pxsales_cotacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pxsales_cotacao_componentes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      pxsales_cotacoes: {
        Row: {
          advalorem_percentual: number
          cliente_id: string | null
          condicao_pagamento: string | null
          contato_email: string | null
          contato_nome: string | null
          contato_telefone: string | null
          created_at: string
          created_by: string | null
          cubagem: number
          desconto_percentual: number
          desconto_valor: number
          destino_cep: string | null
          destino_cidade: string | null
          destino_uf: string | null
          empresa_id: string
          empresa_nome: string
          frequencia_mensal: number | null
          gris_percentual: number
          id: string
          lead_id: string | null
          numero: number
          observacoes: string | null
          oportunidade_id: string | null
          origem_cep: string | null
          origem_cidade: string | null
          origem_uf: string | null
          pedagio: number
          peso: number
          peso_cubado: number
          peso_taxado: number
          prazo_dias: number
          qtd_volumes: number
          responsavel_id: string | null
          snapshot: Json
          status: string
          subtotal: number
          tabela_frete_id: string | null
          tabela_frete_nome: string | null
          tabela_id: string | null
          tabela_nome: string | null
          tabela_versao: number | null
          tabela_versao_id: string | null
          taxas_extras: number
          tipo_mercadoria: string | null
          tipo_operacao: string
          updated_at: string
          updated_by: string | null
          validade_ate: string | null
          valor_base: number
          valor_coleta: number
          valor_entrega: number
          valor_mercadoria: number
          valor_total: number
        }
        Insert: {
          advalorem_percentual?: number
          cliente_id?: string | null
          condicao_pagamento?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string
          created_by?: string | null
          cubagem?: number
          desconto_percentual?: number
          desconto_valor?: number
          destino_cep?: string | null
          destino_cidade?: string | null
          destino_uf?: string | null
          empresa_id: string
          empresa_nome: string
          frequencia_mensal?: number | null
          gris_percentual?: number
          id?: string
          lead_id?: string | null
          numero?: number
          observacoes?: string | null
          oportunidade_id?: string | null
          origem_cep?: string | null
          origem_cidade?: string | null
          origem_uf?: string | null
          pedagio?: number
          peso?: number
          peso_cubado?: number
          peso_taxado?: number
          prazo_dias?: number
          qtd_volumes?: number
          responsavel_id?: string | null
          snapshot?: Json
          status?: string
          subtotal?: number
          tabela_frete_id?: string | null
          tabela_frete_nome?: string | null
          tabela_id?: string | null
          tabela_nome?: string | null
          tabela_versao?: number | null
          tabela_versao_id?: string | null
          taxas_extras?: number
          tipo_mercadoria?: string | null
          tipo_operacao?: string
          updated_at?: string
          updated_by?: string | null
          validade_ate?: string | null
          valor_base?: number
          valor_coleta?: number
          valor_entrega?: number
          valor_mercadoria?: number
          valor_total?: number
        }
        Update: {
          advalorem_percentual?: number
          cliente_id?: string | null
          condicao_pagamento?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string
          created_by?: string | null
          cubagem?: number
          desconto_percentual?: number
          desconto_valor?: number
          destino_cep?: string | null
          destino_cidade?: string | null
          destino_uf?: string | null
          empresa_id?: string
          empresa_nome?: string
          frequencia_mensal?: number | null
          gris_percentual?: number
          id?: string
          lead_id?: string | null
          numero?: number
          observacoes?: string | null
          oportunidade_id?: string | null
          origem_cep?: string | null
          origem_cidade?: string | null
          origem_uf?: string | null
          pedagio?: number
          peso?: number
          peso_cubado?: number
          peso_taxado?: number
          prazo_dias?: number
          qtd_volumes?: number
          responsavel_id?: string | null
          snapshot?: Json
          status?: string
          subtotal?: number
          tabela_frete_id?: string | null
          tabela_frete_nome?: string | null
          tabela_id?: string | null
          tabela_nome?: string | null
          tabela_versao?: number | null
          tabela_versao_id?: string | null
          taxas_extras?: number
          tipo_mercadoria?: string | null
          tipo_operacao?: string
          updated_at?: string
          updated_by?: string | null
          validade_ate?: string | null
          valor_base?: number
          valor_coleta?: number
          valor_entrega?: number
          valor_mercadoria?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pxsales_cotacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "px_cliente_saldo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "pxsales_cotacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "px_registry_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pxsales_cotacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pxsales_cotacoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "pxsales_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pxsales_cotacoes_oportunidade_id_fkey"
            columns: ["oportunidade_id"]
            isOneToOne: false
            referencedRelation: "pxsales_oportunidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pxsales_cotacoes_tabela_frete_id_fkey"
            columns: ["tabela_frete_id"]
            isOneToOne: false
            referencedRelation: "tms_tabela_frete"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pxsales_cotacoes_tabela_id_fkey"
            columns: ["tabela_id"]
            isOneToOne: false
            referencedRelation: "pxsales_tabelas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pxsales_cotacoes_tabela_versao_id_fkey"
            columns: ["tabela_versao_id"]
            isOneToOne: false
            referencedRelation: "pxsales_tabela_versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      pxsales_leads: {
        Row: {
          cidade: string | null
          cliente_id: string | null
          cnpj: string | null
          contato_cargo: string | null
          contato_email: string | null
          contato_nome: string | null
          contato_telefone: string | null
          convertido_em: string | null
          created_at: string
          created_by: string | null
          empresa: string
          empresa_id: string
          etapa: string
          id: string
          motivo_perda: string | null
          nome_fantasia: string | null
          observacoes: string | null
          origem: string
          potencial_mensal: number | null
          proxima_acao: string | null
          proxima_acao_em: string | null
          responsavel_id: string | null
          segmento: string | null
          status: string
          temperatura: string
          tipo_carga: string | null
          uf: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cidade?: string | null
          cliente_id?: string | null
          cnpj?: string | null
          contato_cargo?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          convertido_em?: string | null
          created_at?: string
          created_by?: string | null
          empresa: string
          empresa_id: string
          etapa?: string
          id?: string
          motivo_perda?: string | null
          nome_fantasia?: string | null
          observacoes?: string | null
          origem?: string
          potencial_mensal?: number | null
          proxima_acao?: string | null
          proxima_acao_em?: string | null
          responsavel_id?: string | null
          segmento?: string | null
          status?: string
          temperatura?: string
          tipo_carga?: string | null
          uf?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cidade?: string | null
          cliente_id?: string | null
          cnpj?: string | null
          contato_cargo?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          convertido_em?: string | null
          created_at?: string
          created_by?: string | null
          empresa?: string
          empresa_id?: string
          etapa?: string
          id?: string
          motivo_perda?: string | null
          nome_fantasia?: string | null
          observacoes?: string | null
          origem?: string
          potencial_mensal?: number | null
          proxima_acao?: string | null
          proxima_acao_em?: string | null
          responsavel_id?: string | null
          segmento?: string | null
          status?: string
          temperatura?: string
          tipo_carga?: string | null
          uf?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pxsales_leads_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "px_cliente_saldo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "pxsales_leads_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "px_registry_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pxsales_leads_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      pxsales_oportunidade_historico: {
        Row: {
          created_at: string
          created_by: string | null
          etapa_anterior: string | null
          etapa_nova: string
          id: string
          observacao: string | null
          oportunidade_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          etapa_anterior?: string | null
          etapa_nova: string
          id?: string
          observacao?: string | null
          oportunidade_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          etapa_anterior?: string | null
          etapa_nova?: string
          id?: string
          observacao?: string | null
          oportunidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pxsales_oportunidade_historico_oportunidade_id_fkey"
            columns: ["oportunidade_id"]
            isOneToOne: false
            referencedRelation: "pxsales_oportunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      pxsales_oportunidades: {
        Row: {
          cliente_id: string | null
          created_at: string
          created_by: string | null
          empresa_id: string
          empresa_nome: string | null
          etapa: string
          fechada_em: string | null
          frequencia_mensal: number | null
          id: string
          lead_id: string | null
          margem_percentual: number | null
          motivo_perda: string | null
          observacoes: string | null
          origem: string | null
          previsao_fechamento: string | null
          probabilidade: number
          responsavel_id: string | null
          status: string
          tipo_operacao: string | null
          titulo: string
          updated_at: string
          updated_by: string | null
          valor_estimado: number
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id: string
          empresa_nome?: string | null
          etapa?: string
          fechada_em?: string | null
          frequencia_mensal?: number | null
          id?: string
          lead_id?: string | null
          margem_percentual?: number | null
          motivo_perda?: string | null
          observacoes?: string | null
          origem?: string | null
          previsao_fechamento?: string | null
          probabilidade?: number
          responsavel_id?: string | null
          status?: string
          tipo_operacao?: string | null
          titulo: string
          updated_at?: string
          updated_by?: string | null
          valor_estimado?: number
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          empresa_nome?: string | null
          etapa?: string
          fechada_em?: string | null
          frequencia_mensal?: number | null
          id?: string
          lead_id?: string | null
          margem_percentual?: number | null
          motivo_perda?: string | null
          observacoes?: string | null
          origem?: string | null
          previsao_fechamento?: string | null
          probabilidade?: number
          responsavel_id?: string | null
          status?: string
          tipo_operacao?: string | null
          titulo?: string
          updated_at?: string
          updated_by?: string | null
          valor_estimado?: number
        }
        Relationships: [
          {
            foreignKeyName: "pxsales_oportunidades_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "px_cliente_saldo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "pxsales_oportunidades_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "px_registry_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pxsales_oportunidades_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pxsales_oportunidades_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "pxsales_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      pxsales_pipeline_etapas: {
        Row: {
          ativo: boolean
          chave: string
          cor: string
          created_at: string
          created_by: string | null
          id: string
          label: string
          ordem: number
          tipo: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean
          chave: string
          cor?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          ordem?: number
          tipo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean
          chave?: string
          cor?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          ordem?: number
          tipo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      pxsales_portal_acessos: {
        Row: {
          ativo: boolean
          baixar_comprovantes: boolean
          cliente_id: string
          created_at: string
          created_by: string | null
          empresa_id: string
          expira_em: string | null
          id: string
          solicitar_cotacao: boolean
          token: string
          ultimo_acesso_em: string | null
          updated_at: string
          updated_by: string | null
          ver_componentes: boolean
          ver_comprovantes: boolean
          ver_cotacoes: boolean
          ver_documentos_fiscais: boolean
          ver_entregas: boolean
          ver_historico: boolean
          ver_tabela: boolean
          ver_valores: boolean
        }
        Insert: {
          ativo?: boolean
          baixar_comprovantes?: boolean
          cliente_id: string
          created_at?: string
          created_by?: string | null
          empresa_id: string
          expira_em?: string | null
          id?: string
          solicitar_cotacao?: boolean
          token: string
          ultimo_acesso_em?: string | null
          updated_at?: string
          updated_by?: string | null
          ver_componentes?: boolean
          ver_comprovantes?: boolean
          ver_cotacoes?: boolean
          ver_documentos_fiscais?: boolean
          ver_entregas?: boolean
          ver_historico?: boolean
          ver_tabela?: boolean
          ver_valores?: boolean
        }
        Update: {
          ativo?: boolean
          baixar_comprovantes?: boolean
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          expira_em?: string | null
          id?: string
          solicitar_cotacao?: boolean
          token?: string
          ultimo_acesso_em?: string | null
          updated_at?: string
          updated_by?: string | null
          ver_componentes?: boolean
          ver_comprovantes?: boolean
          ver_cotacoes?: boolean
          ver_documentos_fiscais?: boolean
          ver_entregas?: boolean
          ver_historico?: boolean
          ver_tabela?: boolean
          ver_valores?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pxsales_portal_acessos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "px_cliente_saldo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "pxsales_portal_acessos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "px_registry_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pxsales_portal_acessos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      pxsales_portal_eventos: {
        Row: {
          created_at: string
          id: string
          mensagem: string | null
          payload: Json
          proposta_id: string
          tipo: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          mensagem?: string | null
          payload?: Json
          proposta_id: string
          tipo: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          mensagem?: string | null
          payload?: Json
          proposta_id?: string
          tipo?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pxsales_portal_eventos_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "pxsales_propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      pxsales_proposta_historico: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          observacao: string | null
          proposta_id: string
          status_anterior: string | null
          status_novo: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          observacao?: string | null
          proposta_id: string
          status_anterior?: string | null
          status_novo: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          observacao?: string | null
          proposta_id?: string
          status_anterior?: string | null
          status_novo?: string
        }
        Relationships: [
          {
            foreignKeyName: "pxsales_proposta_historico_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "pxsales_propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      pxsales_propostas: {
        Row: {
          aceita_em: string | null
          anexos: Json
          cliente_id: string | null
          condicao_pagamento: string | null
          condicoes: string | null
          cotacao_id: string | null
          created_at: string
          created_by: string | null
          empresa_id: string
          empresa_nome: string
          enviada_em: string | null
          escopo: string | null
          id: string
          minuta_id: string | null
          motivo: string | null
          numero: number
          oportunidade_id: string | null
          portal_aberta_em: string | null
          portal_ativo: boolean
          portal_expira_em: string | null
          portal_token: string | null
          recusada_em: string | null
          responsavel_id: string | null
          status: string
          titulo: string
          updated_at: string
          updated_by: string | null
          validade_ate: string | null
          valor_total: number
          visualizada_em: string | null
        }
        Insert: {
          aceita_em?: string | null
          anexos?: Json
          cliente_id?: string | null
          condicao_pagamento?: string | null
          condicoes?: string | null
          cotacao_id?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id: string
          empresa_nome: string
          enviada_em?: string | null
          escopo?: string | null
          id?: string
          minuta_id?: string | null
          motivo?: string | null
          numero?: number
          oportunidade_id?: string | null
          portal_aberta_em?: string | null
          portal_ativo?: boolean
          portal_expira_em?: string | null
          portal_token?: string | null
          recusada_em?: string | null
          responsavel_id?: string | null
          status?: string
          titulo: string
          updated_at?: string
          updated_by?: string | null
          validade_ate?: string | null
          valor_total?: number
          visualizada_em?: string | null
        }
        Update: {
          aceita_em?: string | null
          anexos?: Json
          cliente_id?: string | null
          condicao_pagamento?: string | null
          condicoes?: string | null
          cotacao_id?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          empresa_nome?: string
          enviada_em?: string | null
          escopo?: string | null
          id?: string
          minuta_id?: string | null
          motivo?: string | null
          numero?: number
          oportunidade_id?: string | null
          portal_aberta_em?: string | null
          portal_ativo?: boolean
          portal_expira_em?: string | null
          portal_token?: string | null
          recusada_em?: string | null
          responsavel_id?: string | null
          status?: string
          titulo?: string
          updated_at?: string
          updated_by?: string | null
          validade_ate?: string | null
          valor_total?: number
          visualizada_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pxsales_propostas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "px_cliente_saldo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "pxsales_propostas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "px_registry_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pxsales_propostas_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "pxsales_cotacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pxsales_propostas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pxsales_propostas_minuta_id_fkey"
            columns: ["minuta_id"]
            isOneToOne: false
            referencedRelation: "tms_minutas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pxsales_propostas_oportunidade_id_fkey"
            columns: ["oportunidade_id"]
            isOneToOne: false
            referencedRelation: "pxsales_oportunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      pxsales_public_acessos: {
        Row: {
          chave: string
          created_at: string
          escopo: string
          id: string
          janela_inicio: string
          tentativas: number
        }
        Insert: {
          chave: string
          created_at?: string
          escopo: string
          id?: string
          janela_inicio?: string
          tentativas?: number
        }
        Update: {
          chave?: string
          created_at?: string
          escopo?: string
          id?: string
          janela_inicio?: string
          tentativas?: number
        }
        Relationships: []
      }
      pxsales_tabela_componentes: {
        Row: {
          ativo: boolean
          codigo: string
          config: Json
          created_at: string
          empresa_id: string
          id: string
          nome: string
          ordem: number
          tipo: string
          updated_at: string
          versao_id: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          config?: Json
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
          ordem?: number
          tipo: string
          updated_at?: string
          versao_id: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          config?: Json
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          ordem?: number
          tipo?: string
          updated_at?: string
          versao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pxsales_tabela_componentes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pxsales_tabela_componentes_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: false
            referencedRelation: "pxsales_tabela_versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      pxsales_tabela_faixas: {
        Row: {
          componente_id: string
          created_at: string
          empresa_id: string
          id: string
          peso_max: number
          peso_min: number
          tipo_valor: string
          valor: number
          valor_minimo: number
        }
        Insert: {
          componente_id: string
          created_at?: string
          empresa_id: string
          id?: string
          peso_max: number
          peso_min?: number
          tipo_valor?: string
          valor?: number
          valor_minimo?: number
        }
        Update: {
          componente_id?: string
          created_at?: string
          empresa_id?: string
          id?: string
          peso_max?: number
          peso_min?: number
          tipo_valor?: string
          valor?: number
          valor_minimo?: number
        }
        Relationships: [
          {
            foreignKeyName: "pxsales_tabela_faixas_componente_id_fkey"
            columns: ["componente_id"]
            isOneToOne: false
            referencedRelation: "pxsales_tabela_componentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pxsales_tabela_faixas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      pxsales_tabela_versoes: {
        Row: {
          created_at: string
          created_by: string | null
          empresa_id: string
          id: string
          observacoes: string | null
          ordem_calculo: Json
          publicada_em: string | null
          publicada_por: string | null
          status: string
          tabela_id: string
          updated_at: string
          updated_by: string | null
          versao: number
          vigencia_fim: string | null
          vigencia_inicio: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          empresa_id: string
          id?: string
          observacoes?: string | null
          ordem_calculo?: Json
          publicada_em?: string | null
          publicada_por?: string | null
          status?: string
          tabela_id: string
          updated_at?: string
          updated_by?: string | null
          versao: number
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          observacoes?: string | null
          ordem_calculo?: Json
          publicada_em?: string | null
          publicada_por?: string | null
          status?: string
          tabela_id?: string
          updated_at?: string
          updated_by?: string | null
          versao?: number
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "pxsales_tabela_versoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pxsales_tabela_versoes_tabela_id_fkey"
            columns: ["tabela_id"]
            isOneToOne: false
            referencedRelation: "pxsales_tabelas"
            referencedColumns: ["id"]
          },
        ]
      }
      pxsales_tabelas: {
        Row: {
          cliente_id: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          empresa_id: string
          id: string
          nome: string
          portal_mostrar_componentes: boolean
          portal_mostrar_valores: boolean
          portal_visivel: boolean
          responsavel_id: string | null
          status: string
          tipo: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id: string
          id?: string
          nome: string
          portal_mostrar_componentes?: boolean
          portal_mostrar_valores?: boolean
          portal_visivel?: boolean
          responsavel_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          portal_mostrar_componentes?: boolean
          portal_mostrar_valores?: boolean
          portal_visivel?: boolean
          responsavel_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pxsales_tabelas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "px_cliente_saldo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "pxsales_tabelas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "px_registry_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pxsales_tabelas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      risks: {
        Row: {
          categoria: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          empresa_id: string | null
          id: string
          impacto: number | null
          mitigacao: string | null
          probabilidade: number | null
          responsavel: string | null
          status: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          impacto?: number | null
          mitigacao?: string | null
          probabilidade?: number | null
          responsavel?: string | null
          status?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          impacto?: number | null
          mitigacao?: string | null
          probabilidade?: number | null
          responsavel?: string | null
          status?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risks_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_events: {
        Row: {
          created_at: string
          created_by: string | null
          data_evento: string
          descricao: string | null
          empresa_id: string | null
          id: string
          tipo: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_evento: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          tipo?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_evento?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          tipo?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_events_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      tms_cancelamentos: {
        Row: {
          created_at: string
          escopo: string
          id: string
          minuta_id: string | null
          motivo: string
          motivo_texto: string | null
          usuario_id: string | null
          viagem_id: string | null
          volume_id: string | null
        }
        Insert: {
          created_at?: string
          escopo: string
          id?: string
          minuta_id?: string | null
          motivo: string
          motivo_texto?: string | null
          usuario_id?: string | null
          viagem_id?: string | null
          volume_id?: string | null
        }
        Update: {
          created_at?: string
          escopo?: string
          id?: string
          minuta_id?: string | null
          motivo?: string
          motivo_texto?: string | null
          usuario_id?: string | null
          viagem_id?: string | null
          volume_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tms_cancelamentos_minuta_id_fkey"
            columns: ["minuta_id"]
            isOneToOne: false
            referencedRelation: "tms_minutas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tms_cancelamentos_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "tms_viagens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tms_cancelamentos_volume_id_fkey"
            columns: ["volume_id"]
            isOneToOne: false
            referencedRelation: "tms_volumes"
            referencedColumns: ["id"]
          },
        ]
      }
      tms_clientes: {
        Row: {
          ativo: boolean
          cidade: string | null
          cnpj: string | null
          contato: string | null
          created_at: string
          email: string | null
          empresa_id: string | null
          endereco: string | null
          id: string
          nome: string
          observacoes: string | null
          registry_id: string | null
          telefone: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cidade?: string | null
          cnpj?: string | null
          contato?: string | null
          created_at?: string
          email?: string | null
          empresa_id?: string | null
          endereco?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          registry_id?: string | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cidade?: string | null
          cnpj?: string | null
          contato?: string | null
          created_at?: string
          email?: string | null
          empresa_id?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          registry_id?: string | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tms_clientes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tms_clientes_registry_id_fkey"
            columns: ["registry_id"]
            isOneToOne: false
            referencedRelation: "px_cliente_saldo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "tms_clientes_registry_id_fkey"
            columns: ["registry_id"]
            isOneToOne: false
            referencedRelation: "px_registry_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      tms_eventos: {
        Row: {
          created_at: string
          id: string
          minuta_id: string | null
          operador_id: string | null
          origem_evento: string | null
          payload: Json
          tipo: Database["public"]["Enums"]["tms_evento_tipo"]
          volume_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          minuta_id?: string | null
          operador_id?: string | null
          origem_evento?: string | null
          payload?: Json
          tipo: Database["public"]["Enums"]["tms_evento_tipo"]
          volume_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          minuta_id?: string | null
          operador_id?: string | null
          origem_evento?: string | null
          payload?: Json
          tipo?: Database["public"]["Enums"]["tms_evento_tipo"]
          volume_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tms_eventos_minuta_id_fkey"
            columns: ["minuta_id"]
            isOneToOne: false
            referencedRelation: "tms_minutas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tms_eventos_volume_id_fkey"
            columns: ["volume_id"]
            isOneToOne: false
            referencedRelation: "tms_volumes"
            referencedColumns: ["id"]
          },
        ]
      }
      tms_lm_comprovantes: {
        Row: {
          assinatura_base64: string | null
          created_at: string
          criado_por: string | null
          entrega_id: string
          foto_fachada: string | null
          foto_mercadoria: string | null
          id: string
          lat: number | null
          lng: number | null
          observacoes: string | null
          recebedor_doc: string | null
          recebedor_nome: string | null
        }
        Insert: {
          assinatura_base64?: string | null
          created_at?: string
          criado_por?: string | null
          entrega_id: string
          foto_fachada?: string | null
          foto_mercadoria?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          observacoes?: string | null
          recebedor_doc?: string | null
          recebedor_nome?: string | null
        }
        Update: {
          assinatura_base64?: string | null
          created_at?: string
          criado_por?: string | null
          entrega_id?: string
          foto_fachada?: string | null
          foto_mercadoria?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          observacoes?: string | null
          recebedor_doc?: string | null
          recebedor_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tms_lm_comprovantes_entrega_id_fkey"
            columns: ["entrega_id"]
            isOneToOne: false
            referencedRelation: "tms_lm_entregas"
            referencedColumns: ["id"]
          },
        ]
      }
      tms_lm_entregas: {
        Row: {
          cep: string | null
          cidade: string | null
          cliente_id: string | null
          concluida_em: string | null
          created_at: string
          cubagem: number
          destinatario: string
          distancia_km: number | null
          endereco: string | null
          id: string
          janela_fim: string | null
          janela_inicio: string | null
          lat: number | null
          lng: number | null
          minuta_id: string | null
          observacoes: string | null
          ordem: number
          peso: number
          prioridade: string
          qtd_volumes: number
          rota_id: string | null
          status: string
          telefone: string | null
          tempo_estimado_min: number | null
          uf: string | null
          updated_at: string
          valor_mercadoria: number
        }
        Insert: {
          cep?: string | null
          cidade?: string | null
          cliente_id?: string | null
          concluida_em?: string | null
          created_at?: string
          cubagem?: number
          destinatario: string
          distancia_km?: number | null
          endereco?: string | null
          id?: string
          janela_fim?: string | null
          janela_inicio?: string | null
          lat?: number | null
          lng?: number | null
          minuta_id?: string | null
          observacoes?: string | null
          ordem?: number
          peso?: number
          prioridade?: string
          qtd_volumes?: number
          rota_id?: string | null
          status?: string
          telefone?: string | null
          tempo_estimado_min?: number | null
          uf?: string | null
          updated_at?: string
          valor_mercadoria?: number
        }
        Update: {
          cep?: string | null
          cidade?: string | null
          cliente_id?: string | null
          concluida_em?: string | null
          created_at?: string
          cubagem?: number
          destinatario?: string
          distancia_km?: number | null
          endereco?: string | null
          id?: string
          janela_fim?: string | null
          janela_inicio?: string | null
          lat?: number | null
          lng?: number | null
          minuta_id?: string | null
          observacoes?: string | null
          ordem?: number
          peso?: number
          prioridade?: string
          qtd_volumes?: number
          rota_id?: string | null
          status?: string
          telefone?: string | null
          tempo_estimado_min?: number | null
          uf?: string | null
          updated_at?: string
          valor_mercadoria?: number
        }
        Relationships: [
          {
            foreignKeyName: "tms_lm_entregas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "tms_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tms_lm_entregas_minuta_id_fkey"
            columns: ["minuta_id"]
            isOneToOne: false
            referencedRelation: "tms_minutas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tms_lm_entregas_rota_id_fkey"
            columns: ["rota_id"]
            isOneToOne: false
            referencedRelation: "tms_lm_rotas"
            referencedColumns: ["id"]
          },
        ]
      }
      tms_lm_eventos: {
        Row: {
          created_at: string
          criado_por: string | null
          entrega_id: string | null
          id: string
          payload: Json
          rota_id: string | null
          tipo: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          entrega_id?: string | null
          id?: string
          payload?: Json
          rota_id?: string | null
          tipo: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          entrega_id?: string | null
          id?: string
          payload?: Json
          rota_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "tms_lm_eventos_entrega_id_fkey"
            columns: ["entrega_id"]
            isOneToOne: false
            referencedRelation: "tms_lm_entregas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tms_lm_eventos_rota_id_fkey"
            columns: ["rota_id"]
            isOneToOne: false
            referencedRelation: "tms_lm_rotas"
            referencedColumns: ["id"]
          },
        ]
      }
      tms_lm_motoristas: {
        Row: {
          ativo: boolean
          cnh: string | null
          cpf: string | null
          created_at: string
          empresa_id: string | null
          id: string
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnh?: string | null
          cpf?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnh?: string | null
          cpf?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tms_lm_ocorrencias: {
        Row: {
          created_at: string
          criado_por: string | null
          descricao: string | null
          entrega_id: string
          foto_url: string | null
          id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          entrega_id: string
          foto_url?: string | null
          id?: string
          tipo: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          entrega_id?: string
          foto_url?: string | null
          id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "tms_lm_ocorrencias_entrega_id_fkey"
            columns: ["entrega_id"]
            isOneToOne: false
            referencedRelation: "tms_lm_entregas"
            referencedColumns: ["id"]
          },
        ]
      }
      tms_lm_rotas: {
        Row: {
          cidade: string | null
          created_at: string
          data: string
          empresa_id: string | null
          faturavel: boolean
          hora_finalizada: string | null
          hora_prevista: string | null
          hora_saida: string | null
          id: string
          motorista_id: string | null
          numero: number
          observacoes: string | null
          status: string
          updated_at: string
          valor_rota: number
          veiculo_id: string | null
        }
        Insert: {
          cidade?: string | null
          created_at?: string
          data?: string
          empresa_id?: string | null
          faturavel?: boolean
          hora_finalizada?: string | null
          hora_prevista?: string | null
          hora_saida?: string | null
          id?: string
          motorista_id?: string | null
          numero?: number
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor_rota?: number
          veiculo_id?: string | null
        }
        Update: {
          cidade?: string | null
          created_at?: string
          data?: string
          empresa_id?: string | null
          faturavel?: boolean
          hora_finalizada?: string | null
          hora_prevista?: string | null
          hora_saida?: string | null
          id?: string
          motorista_id?: string | null
          numero?: number
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor_rota?: number
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tms_lm_rotas_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "tms_lm_motoristas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tms_lm_rotas_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "tms_lm_veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      tms_lm_veiculos: {
        Row: {
          ativo: boolean
          capacidade_kg: number
          capacidade_m3: number
          created_at: string
          empresa_id: string | null
          id: string
          modelo: string | null
          placa: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          capacidade_kg?: number
          capacidade_m3?: number
          created_at?: string
          empresa_id?: string | null
          id?: string
          modelo?: string | null
          placa: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          capacidade_kg?: number
          capacidade_m3?: number
          created_at?: string
          empresa_id?: string | null
          id?: string
          modelo?: string | null
          placa?: string
          updated_at?: string
        }
        Relationships: []
      }
      tms_lm_volumes: {
        Row: {
          carregado_em: string | null
          codigo: string
          created_at: string
          entrega_id: string
          entregue_em: string | null
          id: string
          separado_em: string | null
          status: string
        }
        Insert: {
          carregado_em?: string | null
          codigo: string
          created_at?: string
          entrega_id: string
          entregue_em?: string | null
          id?: string
          separado_em?: string | null
          status?: string
        }
        Update: {
          carregado_em?: string | null
          codigo?: string
          created_at?: string
          entrega_id?: string
          entregue_em?: string | null
          id?: string
          separado_em?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tms_lm_volumes_entrega_id_fkey"
            columns: ["entrega_id"]
            isOneToOne: false
            referencedRelation: "tms_lm_entregas"
            referencedColumns: ["id"]
          },
        ]
      }
      tms_minutas: {
        Row: {
          cancelada_em: string | null
          cancelada_por: string | null
          cancelamento_motivo: string | null
          cliente_id: string | null
          created_at: string
          cubagem: number
          data_coleta: string | null
          destinatario: Json
          destino: string
          empresa_id: string | null
          id: string
          janela_atendimento: string | null
          necessita_coleta: boolean
          numero: number
          observacoes: string | null
          origem: string
          peso: number
          peso_cubado: number
          peso_taxado: number
          prazo_dias: number
          qtd_volumes: number
          remetente: Json
          responsavel_id: string | null
          status: string
          status_financeiro: string
          tipo_mercadoria: string | null
          updated_at: string
          valor_frete: number
          valor_mercadoria: number
        }
        Insert: {
          cancelada_em?: string | null
          cancelada_por?: string | null
          cancelamento_motivo?: string | null
          cliente_id?: string | null
          created_at?: string
          cubagem?: number
          data_coleta?: string | null
          destinatario?: Json
          destino: string
          empresa_id?: string | null
          id?: string
          janela_atendimento?: string | null
          necessita_coleta?: boolean
          numero?: number
          observacoes?: string | null
          origem: string
          peso?: number
          peso_cubado?: number
          peso_taxado?: number
          prazo_dias?: number
          qtd_volumes?: number
          remetente?: Json
          responsavel_id?: string | null
          status?: string
          status_financeiro?: string
          tipo_mercadoria?: string | null
          updated_at?: string
          valor_frete?: number
          valor_mercadoria?: number
        }
        Update: {
          cancelada_em?: string | null
          cancelada_por?: string | null
          cancelamento_motivo?: string | null
          cliente_id?: string | null
          created_at?: string
          cubagem?: number
          data_coleta?: string | null
          destinatario?: Json
          destino?: string
          empresa_id?: string | null
          id?: string
          janela_atendimento?: string | null
          necessita_coleta?: boolean
          numero?: number
          observacoes?: string | null
          origem?: string
          peso?: number
          peso_cubado?: number
          peso_taxado?: number
          prazo_dias?: number
          qtd_volumes?: number
          remetente?: Json
          responsavel_id?: string | null
          status?: string
          status_financeiro?: string
          tipo_mercadoria?: string | null
          updated_at?: string
          valor_frete?: number
          valor_mercadoria?: number
        }
        Relationships: [
          {
            foreignKeyName: "tms_minutas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "tms_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tms_minutas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      tms_tabela_frete: {
        Row: {
          ativo: boolean
          cliente_id: string | null
          created_at: string
          destino: string | null
          faixa_cubagem_max: number | null
          faixa_cubagem_min: number | null
          faixa_peso_max: number | null
          faixa_peso_min: number | null
          id: string
          nome: string
          origem: string | null
          prazo_dias: number
          regra: Json
          tipo_cobranca: string
          updated_at: string
          valor_coleta: number
          valor_entrega: number
          valor_kg: number
          valor_m3: number
          valor_minimo: number
        }
        Insert: {
          ativo?: boolean
          cliente_id?: string | null
          created_at?: string
          destino?: string | null
          faixa_cubagem_max?: number | null
          faixa_cubagem_min?: number | null
          faixa_peso_max?: number | null
          faixa_peso_min?: number | null
          id?: string
          nome: string
          origem?: string | null
          prazo_dias?: number
          regra?: Json
          tipo_cobranca?: string
          updated_at?: string
          valor_coleta?: number
          valor_entrega?: number
          valor_kg?: number
          valor_m3?: number
          valor_minimo?: number
        }
        Update: {
          ativo?: boolean
          cliente_id?: string | null
          created_at?: string
          destino?: string | null
          faixa_cubagem_max?: number | null
          faixa_cubagem_min?: number | null
          faixa_peso_max?: number | null
          faixa_peso_min?: number | null
          id?: string
          nome?: string
          origem?: string | null
          prazo_dias?: number
          regra?: Json
          tipo_cobranca?: string
          updated_at?: string
          valor_coleta?: number
          valor_entrega?: number
          valor_kg?: number
          valor_m3?: number
          valor_minimo?: number
        }
        Relationships: [
          {
            foreignKeyName: "tms_tabela_frete_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "tms_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      tms_viagem_eventos: {
        Row: {
          codigo: string | null
          created_at: string
          id: string
          motivo: string | null
          operador_id: string | null
          payload: Json
          tipo: string
          viagem_id: string
          volume_id: string | null
        }
        Insert: {
          codigo?: string | null
          created_at?: string
          id?: string
          motivo?: string | null
          operador_id?: string | null
          payload?: Json
          tipo: string
          viagem_id: string
          volume_id?: string | null
        }
        Update: {
          codigo?: string | null
          created_at?: string
          id?: string
          motivo?: string | null
          operador_id?: string | null
          payload?: Json
          tipo?: string
          viagem_id?: string
          volume_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tms_viagem_eventos_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "tms_viagens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tms_viagem_eventos_volume_id_fkey"
            columns: ["volume_id"]
            isOneToOne: false
            referencedRelation: "tms_volumes"
            referencedColumns: ["id"]
          },
        ]
      }
      tms_viagem_minutas: {
        Row: {
          created_at: string
          minuta_id: string
          viagem_id: string
        }
        Insert: {
          created_at?: string
          minuta_id: string
          viagem_id: string
        }
        Update: {
          created_at?: string
          minuta_id?: string
          viagem_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tms_viagem_minutas_minuta_id_fkey"
            columns: ["minuta_id"]
            isOneToOne: false
            referencedRelation: "tms_minutas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tms_viagem_minutas_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "tms_viagens"
            referencedColumns: ["id"]
          },
        ]
      }
      tms_viagens: {
        Row: {
          codigo: string
          created_at: string
          cubagem_prev: number
          data_prevista: string | null
          destino: string
          empresa_id: string | null
          finalizada_em: string | null
          id: string
          iniciada_em: string | null
          motorista_id: string | null
          motorista_nome: string | null
          observacoes: string | null
          operador_id: string | null
          origem: string
          peso_emb: number
          peso_prev: number
          placa: string | null
          qtd_volumes_emb: number
          qtd_volumes_prev: number
          resumo: Json | null
          rota: string | null
          status: string
          tempo_operacao_min: number | null
          updated_at: string
          veiculo_id: string | null
        }
        Insert: {
          codigo: string
          created_at?: string
          cubagem_prev?: number
          data_prevista?: string | null
          destino: string
          empresa_id?: string | null
          finalizada_em?: string | null
          id?: string
          iniciada_em?: string | null
          motorista_id?: string | null
          motorista_nome?: string | null
          observacoes?: string | null
          operador_id?: string | null
          origem: string
          peso_emb?: number
          peso_prev?: number
          placa?: string | null
          qtd_volumes_emb?: number
          qtd_volumes_prev?: number
          resumo?: Json | null
          rota?: string | null
          status?: string
          tempo_operacao_min?: number | null
          updated_at?: string
          veiculo_id?: string | null
        }
        Update: {
          codigo?: string
          created_at?: string
          cubagem_prev?: number
          data_prevista?: string | null
          destino?: string
          empresa_id?: string | null
          finalizada_em?: string | null
          id?: string
          iniciada_em?: string | null
          motorista_id?: string | null
          motorista_nome?: string | null
          observacoes?: string | null
          operador_id?: string | null
          origem?: string
          peso_emb?: number
          peso_prev?: number
          placa?: string | null
          qtd_volumes_emb?: number
          qtd_volumes_prev?: number
          resumo?: Json | null
          rota?: string | null
          status?: string
          tempo_operacao_min?: number | null
          updated_at?: string
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tms_viagens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tms_viagens_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "tms_lm_motoristas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tms_viagens_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "tms_lm_veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      tms_volumes: {
        Row: {
          altura: number | null
          bloqueado: boolean
          bloqueio_motivo: string | null
          codigo: string
          comprimento: number | null
          created_at: string
          embarcado_em: string | null
          embarcado_por: string | null
          hub_atual: string | null
          id: string
          largura: number | null
          minuta_id: string
          numero: number
          peso: number
          status: string
          updated_at: string
          viagem_id: string | null
        }
        Insert: {
          altura?: number | null
          bloqueado?: boolean
          bloqueio_motivo?: string | null
          codigo: string
          comprimento?: number | null
          created_at?: string
          embarcado_em?: string | null
          embarcado_por?: string | null
          hub_atual?: string | null
          id?: string
          largura?: number | null
          minuta_id: string
          numero: number
          peso?: number
          status?: string
          updated_at?: string
          viagem_id?: string | null
        }
        Update: {
          altura?: number | null
          bloqueado?: boolean
          bloqueio_motivo?: string | null
          codigo?: string
          comprimento?: number | null
          created_at?: string
          embarcado_em?: string | null
          embarcado_por?: string | null
          hub_atual?: string | null
          id?: string
          largura?: number | null
          minuta_id?: string
          numero?: number
          peso?: number
          status?: string
          updated_at?: string
          viagem_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tms_volumes_minuta_id_fkey"
            columns: ["minuta_id"]
            isOneToOne: false
            referencedRelation: "tms_minutas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tms_volumes_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "tms_viagens"
            referencedColumns: ["id"]
          },
        ]
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
      valuation_models: {
        Row: {
          ano_base: number | null
          created_at: string
          created_by: string | null
          crescimento_perpetuo: number | null
          ebitda: number | null
          empresa_id: string | null
          fcf_anual: number | null
          id: string
          metodologia: string
          multiplo: number | null
          premissas: string | null
          updated_at: string
          valor_calculado: number | null
          wacc: number | null
        }
        Insert: {
          ano_base?: number | null
          created_at?: string
          created_by?: string | null
          crescimento_perpetuo?: number | null
          ebitda?: number | null
          empresa_id?: string | null
          fcf_anual?: number | null
          id?: string
          metodologia: string
          multiplo?: number | null
          premissas?: string | null
          updated_at?: string
          valor_calculado?: number | null
          wacc?: number | null
        }
        Update: {
          ano_base?: number | null
          created_at?: string
          created_by?: string | null
          crescimento_perpetuo?: number | null
          ebitda?: number | null
          empresa_id?: string | null
          fcf_anual?: number | null
          id?: string
          metodologia?: string
          multiplo?: number | null
          premissas?: string | null
          updated_at?: string
          valor_calculado?: number | null
          wacc?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "valuation_models_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      px_cliente_saldo: {
        Row: {
          bloqueado: boolean | null
          cliente_id: string | null
          disponivel: number | null
          liberado_ate: string | null
          limite_credito: number | null
          motivo_bloqueio: string | null
          utilizado: number | null
          vencido: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_system_access: {
        Args: { _sistema: string; _user_id: string }
        Returns: boolean
      }
      is_executive: { Args: { _user_id: string }; Returns: boolean }
      px_can_access_empresa: {
        Args: { _empresa_id: string; _user_id: string }
        Returns: boolean
      }
      px_has_permission: {
        Args: { _acao: string; _sistema: string; _user_id: string }
        Returns: boolean
      }
      px_user_empresas: { Args: { _user_id: string }; Returns: string[] }
      pxsales_apurar_comissao: {
        Args: { p_proposta_id: string }
        Returns: Json
      }
      pxsales_can: {
        Args: { _acao: string; _empresa_id: string }
        Returns: boolean
      }
      pxsales_converter_proposta_pxlog: {
        Args: { p_proposta_id: string }
        Returns: Json
      }
      pxsales_nova_versao: {
        Args: {
          _tabela_id: string
          _vigencia_fim: string
          _vigencia_inicio: string
        }
        Returns: string
      }
      pxsales_publicar_versao: { Args: { _versao_id: string }; Returns: string }
      pxsales_rate_limit: {
        Args: {
          p_chave: string
          p_escopo: string
          p_janela_seg: number
          p_max: number
        }
        Returns: boolean
      }
      pxsales_responder_proposta_publica: {
        Args: {
          p_acao: string
          p_mensagem?: string
          p_nome?: string
          p_token: string
        }
        Returns: Json
      }
      pxsales_set_status_comissao: {
        Args: { p_id: string; p_motivo?: string; p_status: string }
        Returns: Json
      }
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
      tms_evento_tipo:
        | "solicitado"
        | "coleta_programada"
        | "coletado"
        | "recebido_hub_origem"
        | "conferido"
        | "etiquetado"
        | "embarcado"
        | "em_transferencia"
        | "recebido_hub_destino"
        | "separado"
        | "em_rota"
        | "saiu_entrega"
        | "entregue"
        | "ocorrencia"
        | "devolucao"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      tms_evento_tipo: [
        "solicitado",
        "coleta_programada",
        "coletado",
        "recebido_hub_origem",
        "conferido",
        "etiquetado",
        "embarcado",
        "em_transferencia",
        "recebido_hub_destino",
        "separado",
        "em_rota",
        "saiu_entrega",
        "entregue",
        "ocorrencia",
        "devolucao",
      ],
    },
  },
} as const
