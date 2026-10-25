
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "api_keys": {
                  Row: {
                    "ciphertext": string,"created_at": string,"household_id": string | null,"id": string,"last4": string,"provider": string,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ciphertext": string,"created_at"?: string,"household_id"?: string | null,"id"?: string,"last4": string,"provider"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "ciphertext"?: string,"created_at"?: string,"household_id"?: string | null,"id"?: string,"last4"?: string,"provider"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "api_keys_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"household_members": {
                  Row: {
                    "daily_minutes_limit": number | null,"household_id": string,"joined_at": string,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "daily_minutes_limit"?: number | null,"household_id": string,"joined_at"?: string,"role"?: string,"user_id": string
                  }
                  Update: {
                    "daily_minutes_limit"?: number | null,"household_id"?: string,"joined_at"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "household_members_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"households": {
                  Row: {
                    "created_at": string,"created_by": string,"daily_minutes_limit": number,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"daily_minutes_limit"?: number,"id"?: string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"daily_minutes_limit"?: number,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"learner_profiles": {
                  Row: {
                    "cefr_level": string,"created_at": string,"end_of_turn_pause_ms": number,"goals": string,"idle_prompt_s": number,"interests": (string)[],"language": string,"native_lang": string,"turn_mode": string,"tutor_initiative": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cefr_level": string,"created_at"?: string,"end_of_turn_pause_ms"?: number,"goals"?: string,"idle_prompt_s"?: number,"interests"?: (string)[],"language": string,"native_lang"?: string,"turn_mode"?: string,"tutor_initiative"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "cefr_level"?: string,"created_at"?: string,"end_of_turn_pause_ms"?: number,"goals"?: string,"idle_prompt_s"?: number,"interests"?: (string)[],"language"?: string,"native_lang"?: string,"turn_mode"?: string,"tutor_initiative"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"lessons": {
                  Row: {
                    "duration_s": number | null,"ended_at": string | null,"id": string,"language": string,"plan": NonNullable<Json>,"started_at": string,"status": string,"summary": string | null,"topic_id": string | null,"transcript": NonNullable<Json>,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "duration_s"?: number | null,"ended_at"?: string | null,"id"?: string,"language": string,"plan"?: NonNullable<Json>,"started_at"?: string,"status"?: string,"summary"?: string | null,"topic_id"?: string | null,"transcript"?: NonNullable<Json>,"user_id"?: string
                  }
                  Update: {
                    "duration_s"?: number | null,"ended_at"?: string | null,"id"?: string,"language"?: string,"plan"?: NonNullable<Json>,"started_at"?: string,"status"?: string,"summary"?: string | null,"topic_id"?: string | null,"transcript"?: NonNullable<Json>,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lessons_topic_id_fkey"
      columns: ["topic_id"]
isOneToOne: false
      referencedRelation: "topics"
      referencedColumns: ["id"]
    }
                  ]
                },"mistakes": {
                  Row: {
                    "category": string,"corrected": string,"explanation_cs": string,"first_seen_at": string,"id": string,"language": string,"last_seen_at": string,"lesson_id": string | null,"mastered_at": string | null,"occurrences": number,"original": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"corrected": string,"explanation_cs"?: string,"first_seen_at"?: string,"id"?: string,"language": string,"last_seen_at"?: string,"lesson_id"?: string | null,"mastered_at"?: string | null,"occurrences"?: number,"original": string,"user_id"?: string
                  }
                  Update: {
                    "category"?: string,"corrected"?: string,"explanation_cs"?: string,"first_seen_at"?: string,"id"?: string,"language"?: string,"last_seen_at"?: string,"lesson_id"?: string | null,"mastered_at"?: string | null,"occurrences"?: number,"original"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mistakes_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    }
                  ]
                },"topics": {
                  Row: {
                    "cefr_level": string,"grammar_focus": (string)[],"id": string,"language": string,"scenario": string,"tags": (string)[],"title": string,"title_cs": string,"vocab_focus": (string)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "cefr_level": string,"grammar_focus"?: (string)[],"id": string,"language": string,"scenario": string,"tags"?: (string)[],"title": string,"title_cs": string,"vocab_focus"?: (string)[]
                  }
                  Update: {
                    "cefr_level"?: string,"grammar_focus"?: (string)[],"id"?: string,"language"?: string,"scenario"?: string,"tags"?: (string)[],"title"?: string,"title_cs"?: string,"vocab_focus"?: (string)[]
                  }
                  Relationships: [
                    
                  ]
                },"usage_daily": {
                  Row: {
                    "audio_seconds": number,"day": string,"household_id": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "audio_seconds"?: number,"day": string,"household_id"?: string | null,"user_id": string
                  }
                  Update: {
                    "audio_seconds"?: number,"day"?: string,"household_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "usage_daily_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"vocab_items": {
                  Row: {
                    "created_at": string,"due": string,"example": string,"fsrs": NonNullable<Json>,"id": string,"language": string,"lesson_id": string | null,"term": string,"translation": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"due"?: string,"example"?: string,"fsrs"?: NonNullable<Json>,"id"?: string,"language": string,"lesson_id"?: string | null,"term": string,"translation": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"due"?: string,"example"?: string,"fsrs"?: NonNullable<Json>,"id"?: string,"language"?: string,"lesson_id"?: string | null,"term"?: string,"translation"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vocab_items_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "is_household_member":
{ Args: { "hid": string }; Returns: boolean
                           },
"is_household_owner":
{ Args: { "hid": string }; Returns: boolean
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
