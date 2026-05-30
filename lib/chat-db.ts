import { getSupabase } from "@/lib/supabase"

export async function createSession(title = "Новый чат") {
  const supabase = getSupabase()
  if (!supabase) return null

  const { data, error } = await supabase
    .from("sessions")
    .insert({ title })
    .select("id, title, created_at")
    .single()

  if (error) {
    console.error("[Supabase] Failed to create session:", error.message)
    return null
  }

  return data
}

export async function updateSessionTitle(sessionId: string, title: string) {
  const supabase = getSupabase()
  if (!supabase) return

  const { error } = await supabase
    .from("sessions")
    .update({ title })
    .eq("id", sessionId)

  if (error) {
    console.error("[Supabase] Failed to update session title:", error.message)
  }
}

export async function saveMessage(params: {
  sessionId: string
  role: "user" | "assistant"
  content: string
  isTask?: boolean
}) {
  const supabase = getSupabase()
  if (!supabase) return

  const { error } = await supabase.from("messages").insert({
    session_id: params.sessionId,
    role: params.role,
    content: params.content,
    is_task: params.isTask ?? false,
  })

  if (error) {
    console.error("[Supabase] Failed to save message:", error.message)
  }
}
