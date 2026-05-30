import { getSupabase, isSupabaseConfigured } from "@/lib/supabase"

export const ACTIVE_SESSION_STORAGE_KEY = "active-session-id"

export type DbSession = {
  id: string
  title: string
  created_at: string
}

export type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  isTask?: boolean
}

export type LoadedChat = {
  id: string
  title: string
  messages: ChatMessage[]
  messagesLoaded: boolean
}

export function persistActiveSessionId(sessionId: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, sessionId)
  }
}

export function getStoredActiveSessionId(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)
}

export async function fetchAllSessions(): Promise<DbSession[]> {
  const supabase = getSupabase()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("sessions")
    .select("id, title, created_at")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[Supabase] Failed to fetch sessions:", error.message)
    return []
  }

  return data ?? []
}

export async function fetchMessagesForSession(
  sessionId: string,
): Promise<ChatMessage[]> {
  const supabase = getSupabase()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("messages")
    .select("id, role, content, is_task, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("[Supabase] Failed to fetch messages:", error.message)
    return []
  }

  return (data ?? []).map(message => ({
    id: message.id,
    role: message.role,
    content: message.content,
    isTask: message.is_task,
  }))
}

export async function resolveLastActiveSessionId(
  sessions: DbSession[],
): Promise<string | null> {
  if (sessions.length === 0) return null

  const storedId = getStoredActiveSessionId()
  if (storedId && sessions.some(session => session.id === storedId)) {
    return storedId
  }

  const supabase = getSupabase()
  if (!supabase) return sessions[0].id

  const { data, error } = await supabase
    .from("messages")
    .select("session_id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("[Supabase] Failed to resolve active session:", error.message)
    return sessions[0].id
  }

  if (
    data?.session_id &&
    sessions.some(session => session.id === data.session_id)
  ) {
    return data.session_id
  }

  return sessions[0].id
}

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

function createLocalChat(): LoadedChat {
  return {
    id: Date.now().toString(),
    title: "Новый чат",
    messages: [],
    messagesLoaded: true,
  }
}

export async function loadInitialChats(): Promise<{
  chats: LoadedChat[]
  activeId: string
}> {
  if (!isSupabaseConfigured()) {
    const localChat = createLocalChat()
    return { chats: [localChat], activeId: localChat.id }
  }

  const sessions = await fetchAllSessions()

  if (sessions.length === 0) {
    const session = await createSession("Новый чат")
    if (!session) {
      const localChat = createLocalChat()
      return { chats: [localChat], activeId: localChat.id }
    }

    const chat: LoadedChat = {
      id: session.id,
      title: session.title,
      messages: [],
      messagesLoaded: true,
    }

    persistActiveSessionId(session.id)
    return { chats: [chat], activeId: session.id }
  }

  const activeId =
    (await resolveLastActiveSessionId(sessions)) ?? sessions[0].id
  const activeMessages = await fetchMessagesForSession(activeId)

  const chats: LoadedChat[] = sessions.map(session => ({
    id: session.id,
    title: session.title,
    messages: session.id === activeId ? activeMessages : [],
    messagesLoaded: session.id === activeId,
  }))

  persistActiveSessionId(activeId)
  return { chats, activeId }
}

export async function createNewChatSession(): Promise<LoadedChat> {
  if (isSupabaseConfigured()) {
    const session = await createSession("Новый чат")
    if (session) {
      return {
        id: session.id,
        title: session.title,
        messages: [],
        messagesLoaded: true,
      }
    }
  }

  return createLocalChat()
}
