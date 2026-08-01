export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      athlete_states: {
        Row: {
          schema_version: number
          state: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          schema_version?: number
          state: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          schema_version?: number
          state?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      personal_records: {
        Row: {
          date: string
          display: string
          metric_id: string
          notes: string | null
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          date: string
          display: string
          metric_id: string
          notes?: string | null
          updated_at?: string
          user_id: string
          value: number
        }
        Update: {
          date?: string
          display?: string
          metric_id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      pr_attempts: {
        Row: {
          created_at: string
          date: string
          display: string
          id: string
          is_pr: boolean
          metric_id: string
          metric_name: string
          notes: string | null
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          date: string
          display: string
          id: string
          is_pr?: boolean
          metric_id: string
          metric_name: string
          notes?: string | null
          user_id: string
          value: number
        }
        Update: {
          created_at?: string
          date?: string
          display?: string
          id?: string
          is_pr?: boolean
          metric_id?: string
          metric_name?: string
          notes?: string | null
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      readiness_checks: {
        Row: {
          available_minutes: number
          created_at: string
          date: string
          energy: number
          id: string
          pain: boolean
          soreness: string
          user_id: string
        }
        Insert: {
          available_minutes: number
          created_at?: string
          date: string
          energy: number
          id: string
          pain?: boolean
          soreness: string
          user_id: string
        }
        Update: {
          available_minutes?: number
          created_at?: string
          date?: string
          energy?: number
          id?: string
          pain?: boolean
          soreness?: string
          user_id?: string
        }
        Relationships: []
      }
      training_events: {
        Row: {
          created_at: string
          date: string
          id: string
          kind: string
          movement_ids: string[]
          raw_box_text: string | null
          recommendation: Json | null
          session_id: string | null
          status: string
          stimuli: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id: string
          kind: string
          movement_ids?: string[]
          raw_box_text?: string | null
          recommendation?: Json | null
          session_id?: string | null
          status?: string
          stimuli?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          kind?: string
          movement_ids?: string[]
          raw_box_text?: string | null
          recommendation?: Json | null
          session_id?: string | null
          status?: string
          stimuli?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workout_logs: {
        Row: {
          competition_proof: Json | null
          created_at: string
          date: string
          day_id: string
          day_title: string
          difficulty: number | null
          duration_minutes: number | null
          id: string
          mobility_done: boolean
          movement_patterns: string[]
          notes: string | null
          readiness: string | null
          readiness_check_id: string | null
          recommendation_snapshot: Json | null
          rpe: string | null
          rx_status: string | null
          strength_result: string | null
          structured_score: Json | null
          timer_result: Json | null
          training_event_id: string | null
          user_id: string
          week: number
          wod_score: string | null
          workout_source: string
        }
        Insert: {
          competition_proof?: Json | null
          created_at?: string
          date: string
          day_id: string
          day_title: string
          difficulty?: number | null
          duration_minutes?: number | null
          id: string
          mobility_done?: boolean
          movement_patterns?: string[]
          notes?: string | null
          readiness?: string | null
          readiness_check_id?: string | null
          recommendation_snapshot?: Json | null
          rpe?: string | null
          rx_status?: string | null
          strength_result?: string | null
          structured_score?: Json | null
          timer_result?: Json | null
          training_event_id?: string | null
          user_id: string
          week: number
          wod_score?: string | null
          workout_source?: string
        }
        Update: {
          competition_proof?: Json | null
          created_at?: string
          date?: string
          day_id?: string
          day_title?: string
          difficulty?: number | null
          duration_minutes?: number | null
          id?: string
          mobility_done?: boolean
          movement_patterns?: string[]
          notes?: string | null
          readiness?: string | null
          readiness_check_id?: string | null
          recommendation_snapshot?: Json | null
          rpe?: string | null
          rx_status?: string | null
          strength_result?: string | null
          structured_score?: Json | null
          timer_result?: Json | null
          training_event_id?: string | null
          user_id?: string
          week?: number
          wod_score?: string | null
          workout_source?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      save_personal_record: {
        Args: { p_personal_record: Json }
        Returns: undefined
      }
      save_pr_attempt: {
        Args: { p_attempt: Json; p_personal_record?: Json }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
