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
      athlete_movement_restrictions: {
        Row: {
          created_at: string
          guidance: string | null
          id: string
          movement_family_id: string | null
          movement_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          guidance?: string | null
          id?: string
          movement_family_id?: string | null
          movement_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          guidance?: string | null
          id?: string
          movement_family_id?: string | null
          movement_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_movement_restrictions_movement_family_id_fkey"
            columns: ["movement_family_id"]
            isOneToOne: false
            referencedRelation: "movement_families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_movement_restrictions_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
        ]
      }
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
      conditioning_movements: {
        Row: {
          calories: number | null
          conditioning_id: string
          distance_meters: number | null
          duration_seconds: number | null
          equipment: string[]
          id: number
          load_kg: number | null
          movement_family_id: string
          movement_id: string
          movement_name: string
          movement_order: number
          percentage_reference: number | null
          reps: number | null
          user_id: string
        }
        Insert: {
          calories?: number | null
          conditioning_id: string
          distance_meters?: number | null
          duration_seconds?: number | null
          equipment?: string[]
          id?: never
          load_kg?: number | null
          movement_family_id: string
          movement_id: string
          movement_name: string
          movement_order: number
          percentage_reference?: number | null
          reps?: number | null
          user_id: string
        }
        Update: {
          calories?: number | null
          conditioning_id?: string
          distance_meters?: number | null
          duration_seconds?: number | null
          equipment?: string[]
          id?: never
          load_kg?: number | null
          movement_family_id?: string
          movement_id?: string
          movement_name?: string
          movement_order?: number
          percentage_reference?: number | null
          reps?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conditioning_movements_conditioning_id_fkey"
            columns: ["conditioning_id"]
            isOneToOne: false
            referencedRelation: "conditioning_prescriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conditioning_movements_movement_family_id_fkey"
            columns: ["movement_family_id"]
            isOneToOne: false
            referencedRelation: "movement_families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conditioning_movements_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
        ]
      }
      conditioning_prescriptions: {
        Row: {
          duration_minutes: number | null
          estimated_duration_minutes: number
          format: string
          id: string
          intended_stimulus: string
          rest_seconds: number | null
          rounds: number | null
          scaling_options: Json
          session_id: string
          target_duration_max: number | null
          target_duration_min: number | null
          target_rpe: number | null
          time_cap_minutes: number | null
          user_id: string
          work_seconds: number | null
        }
        Insert: {
          duration_minutes?: number | null
          estimated_duration_minutes: number
          format: string
          id: string
          intended_stimulus: string
          rest_seconds?: number | null
          rounds?: number | null
          scaling_options: Json
          session_id: string
          target_duration_max?: number | null
          target_duration_min?: number | null
          target_rpe?: number | null
          time_cap_minutes?: number | null
          user_id: string
          work_seconds?: number | null
        }
        Update: {
          duration_minutes?: number | null
          estimated_duration_minutes?: number
          format?: string
          id?: string
          intended_stimulus?: string
          rest_seconds?: number | null
          rounds?: number | null
          scaling_options?: Json
          session_id?: string
          target_duration_max?: number | null
          target_duration_min?: number | null
          target_rpe?: number | null
          time_cap_minutes?: number | null
          user_id?: string
          work_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conditioning_prescriptions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_transitions: {
        Row: {
          estimated_minutes: number
          from_equipment: string[]
          id: number
          session_id: string
          to_equipment: string[]
          transition_order: number
          user_id: string
        }
        Insert: {
          estimated_minutes: number
          from_equipment?: string[]
          id?: never
          session_id: string
          to_equipment?: string[]
          transition_order: number
          user_id: string
        }
        Update: {
          estimated_minutes?: number
          from_equipment?: string[]
          id?: never
          session_id?: string
          to_equipment?: string[]
          transition_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_transitions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_prescriptions: {
        Row: {
          calories: number | null
          coaching_cues: Json
          distance_meters: number | null
          duration_seconds: number | null
          equipment: string[]
          estimated_duration_minutes: number
          group_id: string | null
          id: string
          intensity_max: number | null
          intensity_method: string
          intensity_value: number | null
          load_kg: number | null
          movement_family_id: string
          movement_id: string
          movement_name: string
          pause_description: string | null
          progression_objective: string | null
          progression_step_number: number | null
          progression_track_id: string | null
          reference_lift: string | null
          reference_max_kg: number | null
          rep_range_max: number | null
          rep_range_min: number | null
          reps: number | null
          rest_seconds: number
          scaling_options: Json
          section: string
          session_id: string
          sets: number
          setup_minutes: number
          stopping_rule: string | null
          technical_intent: string
          tempo: string | null
          user_id: string
          warmup_set_count: number
        }
        Insert: {
          calories?: number | null
          coaching_cues?: Json
          distance_meters?: number | null
          duration_seconds?: number | null
          equipment?: string[]
          estimated_duration_minutes: number
          group_id?: string | null
          id: string
          intensity_max?: number | null
          intensity_method: string
          intensity_value?: number | null
          load_kg?: number | null
          movement_family_id: string
          movement_id: string
          movement_name: string
          pause_description?: string | null
          progression_objective?: string | null
          progression_step_number?: number | null
          progression_track_id?: string | null
          reference_lift?: string | null
          reference_max_kg?: number | null
          rep_range_max?: number | null
          rep_range_min?: number | null
          reps?: number | null
          rest_seconds: number
          scaling_options?: Json
          section: string
          session_id: string
          sets: number
          setup_minutes?: number
          stopping_rule?: string | null
          technical_intent: string
          tempo?: string | null
          user_id: string
          warmup_set_count?: number
        }
        Update: {
          calories?: number | null
          coaching_cues?: Json
          distance_meters?: number | null
          duration_seconds?: number | null
          equipment?: string[]
          estimated_duration_minutes?: number
          group_id?: string | null
          id?: string
          intensity_max?: number | null
          intensity_method?: string
          intensity_value?: number | null
          load_kg?: number | null
          movement_family_id?: string
          movement_id?: string
          movement_name?: string
          pause_description?: string | null
          progression_objective?: string | null
          progression_step_number?: number | null
          progression_track_id?: string | null
          reference_lift?: string | null
          reference_max_kg?: number | null
          rep_range_max?: number | null
          rep_range_min?: number | null
          reps?: number | null
          rest_seconds?: number
          scaling_options?: Json
          section?: string
          session_id?: string
          sets?: number
          setup_minutes?: number
          stopping_rule?: string | null
          technical_intent?: string
          tempo?: string | null
          user_id?: string
          warmup_set_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "exercise_prescriptions_movement_family_id_fkey"
            columns: ["movement_family_id"]
            isOneToOne: false
            referencedRelation: "movement_families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_prescriptions_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_prescriptions_progression_track_id_fkey"
            columns: ["progression_track_id"]
            isOneToOne: false
            referencedRelation: "progression_tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_prescriptions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_results: {
        Row: {
          achieved_rpe: number | null
          completed_reps: number
          completed_sets: number
          load_kg: number | null
          pain_reported: boolean
          prescription_id: string
          progression_track_id: string
          successful: boolean
          user_id: string
        }
        Insert: {
          achieved_rpe?: number | null
          completed_reps: number
          completed_sets: number
          load_kg?: number | null
          pain_reported?: boolean
          prescription_id: string
          progression_track_id: string
          successful: boolean
          user_id: string
        }
        Update: {
          achieved_rpe?: number | null
          completed_reps?: number
          completed_sets?: number
          load_kg?: number | null
          pain_reported?: boolean
          prescription_id?: string
          progression_track_id?: string
          successful?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_results_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: true
            referencedRelation: "exercise_prescriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_results_progression_track_id_fkey"
            columns: ["progression_track_id"]
            isOneToOne: false
            referencedRelation: "progression_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      movement_families: {
        Row: {
          catalog_version: number
          created_at: string
          id: string
          name: string
        }
        Insert: {
          catalog_version?: number
          created_at?: string
          id: string
          name: string
        }
        Update: {
          catalog_version?: number
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      movements: {
        Row: {
          allowed_contexts: string[]
          catalog_version: number
          category: string
          created_at: string
          difficulty: string
          equipment: string[]
          family_id: string
          id: string
          is_isometric: boolean
          is_technique_drill: boolean
          loadable: boolean
          name: string
          prerequisites: string[]
          purposes: string[]
          requires_percentage_reference: boolean
          seconds_per_rep: number
          unilateral: boolean
        }
        Insert: {
          allowed_contexts: string[]
          catalog_version?: number
          category: string
          created_at?: string
          difficulty: string
          equipment?: string[]
          family_id: string
          id: string
          is_isometric?: boolean
          is_technique_drill?: boolean
          loadable?: boolean
          name: string
          prerequisites?: string[]
          purposes?: string[]
          requires_percentage_reference?: boolean
          seconds_per_rep?: number
          unilateral?: boolean
        }
        Update: {
          allowed_contexts?: string[]
          catalog_version?: number
          category?: string
          created_at?: string
          difficulty?: string
          equipment?: string[]
          family_id?: string
          id?: string
          is_isometric?: boolean
          is_technique_drill?: boolean
          loadable?: boolean
          name?: string
          prerequisites?: string[]
          purposes?: string[]
          requires_percentage_reference?: boolean
          seconds_per_rep?: number
          unilateral?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "movements_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "movement_families"
            referencedColumns: ["id"]
          },
        ]
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
      program_validation_results: {
        Row: {
          code: string
          created_at: string
          id: number
          issue_path: string
          message: string
          program_id: string
          severity: string
          user_id: string
          validator_version: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: never
          issue_path: string
          message: string
          program_id: string
          severity: string
          user_id: string
          validator_version: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: never
          issue_path?: string
          message?: string
          program_id?: string
          severity?: string
          user_id?: string
          validator_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "program_validation_results_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programming_engine_flags: {
        Row: {
          rollout_group: string
          updated_at: string
          user_id: string
          v2_enabled: boolean
        }
        Insert: {
          rollout_group?: string
          updated_at?: string
          user_id: string
          v2_enabled?: boolean
        }
        Update: {
          rollout_group?: string
          updated_at?: string
          user_id?: string
          v2_enabled?: boolean
        }
        Relationships: []
      }
      progression_steps: {
        Row: {
          estimated_duration_minutes: number
          id: string
          intensity_max: number | null
          intensity_method: string
          intensity_min: number | null
          movement_family_id: string
          movement_id: string | null
          pause_description: string | null
          progression_track_id: string
          rep_range_max: number | null
          rep_range_min: number | null
          reps: number | null
          rest_seconds: number | null
          sets: number | null
          step_number: number
          technical_intent: string
          tempo: string | null
          user_id: string
          week_number: number
        }
        Insert: {
          estimated_duration_minutes: number
          id: string
          intensity_max?: number | null
          intensity_method: string
          intensity_min?: number | null
          movement_family_id: string
          movement_id?: string | null
          pause_description?: string | null
          progression_track_id: string
          rep_range_max?: number | null
          rep_range_min?: number | null
          reps?: number | null
          rest_seconds?: number | null
          sets?: number | null
          step_number: number
          technical_intent: string
          tempo?: string | null
          user_id: string
          week_number: number
        }
        Update: {
          estimated_duration_minutes?: number
          id?: string
          intensity_max?: number | null
          intensity_method?: string
          intensity_min?: number | null
          movement_family_id?: string
          movement_id?: string | null
          pause_description?: string | null
          progression_track_id?: string
          rep_range_max?: number | null
          rep_range_min?: number | null
          reps?: number | null
          rest_seconds?: number | null
          sets?: number | null
          step_number?: number
          technical_intent?: string
          tempo?: string | null
          user_id?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "progression_steps_movement_family_id_fkey"
            columns: ["movement_family_id"]
            isOneToOne: false
            referencedRelation: "movement_families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progression_steps_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progression_steps_progression_track_id_fkey"
            columns: ["progression_track_id"]
            isOneToOne: false
            referencedRelation: "progression_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      progression_tracks: {
        Row: {
          consecutive_failures: number
          created_at: string
          current_step: number
          id: string
          metadata: Json
          movement_family_id: string
          status: string
          total_steps: number
          track_type: string
          training_block_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          consecutive_failures?: number
          created_at: string
          current_step: number
          id: string
          metadata?: Json
          movement_family_id: string
          status: string
          total_steps: number
          track_type: string
          training_block_id: string
          updated_at: string
          user_id: string
        }
        Update: {
          consecutive_failures?: number
          created_at?: string
          current_step?: number
          id?: string
          metadata?: Json
          movement_family_id?: string
          status?: string
          total_steps?: number
          track_type?: string
          training_block_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "progression_tracks_movement_family_id_fkey"
            columns: ["movement_family_id"]
            isOneToOne: false
            referencedRelation: "movement_families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progression_tracks_training_block_id_fkey"
            columns: ["training_block_id"]
            isOneToOne: false
            referencedRelation: "training_blocks"
            referencedColumns: ["id"]
          },
        ]
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
      session_feedback: {
        Row: {
          completed: boolean
          completed_at: string
          duration_minutes_actual: number | null
          fatigue: number | null
          notes: string | null
          pain_reported: boolean
          session_id: string
          session_rpe: number | null
          user_id: string
        }
        Insert: {
          completed: boolean
          completed_at: string
          duration_minutes_actual?: number | null
          fatigue?: number | null
          notes?: string | null
          pain_reported?: boolean
          session_id: string
          session_rpe?: number | null
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string
          duration_minutes_actual?: number | null
          fatigue?: number | null
          notes?: string | null
          pain_reported?: boolean
          session_id?: string
          session_rpe?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_progression_tracks: {
        Row: {
          progression_step_number: number
          progression_track_id: string
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          progression_step_number: number
          progression_track_id: string
          role: string
          session_id: string
          user_id: string
        }
        Update: {
          progression_step_number?: number
          progression_track_id?: string
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_progression_tracks_progression_track_id_fkey"
            columns: ["progression_track_id"]
            isOneToOne: false
            referencedRelation: "progression_tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_progression_tracks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_sections: {
        Row: {
          estimated_duration_minutes: number
          id: string
          section: string
          section_order: number
          session_id: string
          user_id: string
        }
        Insert: {
          estimated_duration_minutes: number
          id: string
          section: string
          section_order: number
          session_id: string
          user_id: string
        }
        Update: {
          estimated_duration_minutes?: number
          id?: string
          section?: string
          section_order?: number
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_sections_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      training_blocks: {
        Row: {
          block_type: string
          completed_at: string | null
          created_at: string
          current_week: number
          deload_week: number | null
          duration_weeks: number
          goal: string
          id: string
          name: string
          program_id: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          block_type: string
          completed_at?: string | null
          created_at: string
          current_week: number
          deload_week?: number | null
          duration_weeks: number
          goal: string
          id: string
          name: string
          program_id: string
          started_at?: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Update: {
          block_type?: string
          completed_at?: string | null
          created_at?: string
          current_week?: number
          deload_week?: number | null
          duration_weeks?: number
          goal?: string
          id?: string
          name?: string
          program_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_blocks_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id"]
          },
        ]
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
      training_programs: {
        Row: {
          active_training_block_id: string | null
          catalog_version: number
          created_at: string
          engine_version: string
          id: string
          name: string
          revision: number
          schema_version: number
          status: string
          template_version: string
          updated_at: string
          user_id: string
          validated_snapshot: Json
          validator_version: number
        }
        Insert: {
          active_training_block_id?: string | null
          catalog_version: number
          created_at: string
          engine_version?: string
          id: string
          name: string
          revision?: number
          schema_version: number
          status: string
          template_version: string
          updated_at: string
          user_id: string
          validated_snapshot: Json
          validator_version: number
        }
        Update: {
          active_training_block_id?: string | null
          catalog_version?: number
          created_at?: string
          engine_version?: string
          id?: string
          name?: string
          revision?: number
          schema_version?: number
          status?: string
          template_version?: string
          updated_at?: string
          user_id?: string
          validated_snapshot?: Json
          validator_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "training_programs_active_block_fk"
            columns: ["active_training_block_id"]
            isOneToOne: false
            referencedRelation: "training_blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      training_sessions: {
        Row: {
          community_workout_advice: string
          created_at: string
          duration_target_minutes: number
          duration_validation_status: string
          estimated_duration_minutes: number
          expected_fatigue: string
          fatigue_focus: string
          id: string
          intended_stimulus: string
          objective: string
          provisional: boolean
          revision: number
          session_number: number
          status: string
          stress: Json
          training_week_id: string
          updated_at: string
          user_id: string
          week_number: number
        }
        Insert: {
          community_workout_advice: string
          created_at: string
          duration_target_minutes: number
          duration_validation_status: string
          estimated_duration_minutes: number
          expected_fatigue: string
          fatigue_focus: string
          id: string
          intended_stimulus: string
          objective: string
          provisional?: boolean
          revision: number
          session_number: number
          status: string
          stress: Json
          training_week_id: string
          updated_at: string
          user_id: string
          week_number: number
        }
        Update: {
          community_workout_advice?: string
          created_at?: string
          duration_target_minutes?: number
          duration_validation_status?: string
          estimated_duration_minutes?: number
          expected_fatigue?: string
          fatigue_focus?: string
          id?: string
          intended_stimulus?: string
          objective?: string
          provisional?: boolean
          revision?: number
          session_number?: number
          status?: string
          stress?: Json
          training_week_id?: string
          updated_at?: string
          user_id?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "training_sessions_training_week_id_fkey"
            columns: ["training_week_id"]
            isOneToOne: false
            referencedRelation: "training_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      training_weeks: {
        Row: {
          id: string
          status: string
          theme: string
          training_block_id: string
          user_id: string
          week_number: number
        }
        Insert: {
          id: string
          status: string
          theme: string
          training_block_id: string
          user_id: string
          week_number: number
        }
        Update: {
          id?: string
          status?: string
          theme?: string
          training_block_id?: string
          user_id?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "training_weeks_training_block_id_fkey"
            columns: ["training_block_id"]
            isOneToOne: false
            referencedRelation: "training_blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      warmup_exercises: {
        Row: {
          distance_meters: number | null
          duration_seconds: number | null
          equipment: string[]
          exercise_order: number
          id: number
          movement_id: string
          movement_name: string
          reps: number | null
          user_id: string
          warmup_id: string
        }
        Insert: {
          distance_meters?: number | null
          duration_seconds?: number | null
          equipment?: string[]
          exercise_order: number
          id?: never
          movement_id: string
          movement_name: string
          reps?: number | null
          user_id: string
          warmup_id: string
        }
        Update: {
          distance_meters?: number | null
          duration_seconds?: number | null
          equipment?: string[]
          exercise_order?: number
          id?: never
          movement_id?: string
          movement_name?: string
          reps?: number | null
          user_id?: string
          warmup_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warmup_exercises_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warmup_exercises_warmup_id_fkey"
            columns: ["warmup_id"]
            isOneToOne: false
            referencedRelation: "warmup_prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      warmup_prescriptions: {
        Row: {
          duration_minutes: number
          id: string
          purpose: string
          rounds: number | null
          session_id: string
          user_id: string
        }
        Insert: {
          duration_minutes: number
          id: string
          purpose: string
          rounds?: number | null
          session_id: string
          user_id: string
        }
        Update: {
          duration_minutes?: number
          id?: string
          purpose?: string
          rounds?: number | null
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warmup_prescriptions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
        ]
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
      load_active_programming_engine_v2: { Args: never; Returns: Json }
      load_programming_engine_v2: {
        Args: { p_program_id: string }
        Returns: Json
      }
      replace_athlete_movement_restrictions: {
        Args: { p_restrictions: Json }
        Returns: {
          created_at: string
          guidance: string | null
          id: string
          movement_family_id: string | null
          movement_id: string | null
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "athlete_movement_restrictions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      save_personal_record: {
        Args: { p_personal_record: Json }
        Returns: undefined
      }
      save_pr_attempt: {
        Args: { p_attempt: Json; p_personal_record?: Json }
        Returns: Json
      }
      save_programming_engine_v2: {
        Args: { p_expected_revision?: number; p_program: Json }
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
