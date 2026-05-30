import { createClient, SupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export type Database = {
  public: {
    Tables: {
      sessions: {
        Row: {
          id: string
          title: string
          created_at: string
        }
        Insert: {
          id?: string
          title?: string
          created_at?: string
        }
        Update: {
          title?: string
        }
      }
      messages: {
        Row: {
          id: string
          session_id: string
          role: "user" | "assistant"
          content: string
          is_task: boolean
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          role: "user" | "assistant"
          content: string
          is_task?: boolean
          created_at?: string
        }
        Update: {
          content?: string
          is_task?: boolean
        }
      }
    }
  }
}

let supabaseClient: SupabaseClient<Database> | null = null

export function getSupabase(): SupabaseClient<Database> | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }

  if (!supabaseClient) {
    supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey)
  }

  return supabaseClient
}

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey)
}
