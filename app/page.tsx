"use client"

import { useState, useRef, useEffect } from "react"
import { Plus, MessageSquare, Settings, Copy, Check, Send, Sparkles, PenLine, Pencil, Trash2, Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { SettingsModal } from "@/components/settings-modal"
import { createSession, saveMessage, updateSessionTitle } from "@/lib/chat-db"
import { isSupabaseConfigured } from "@/lib/supabase"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  isTask?: boolean
}

interface Chat {
  id: string
  title: string
  messages: Message[]
}

type ApiChatMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

type ApiChatResponse = {
  message?: { role?: string; content?: string } | null
  error?: string
}

function createLocalChat(): Chat {
  return {
    id: Date.now().toString(),
    title: "Новый чат",
    messages: [],
  }
}

async function createNewChat(): Promise<Chat> {
  if (isSupabaseConfigured()) {
    const session = await createSession("Новый чат")
    if (session) {
      return {
        id: session.id,
        title: session.title,
        messages: [],
      }
    }
  }

  return createLocalChat()
}

export default function HomePage() {
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChatId, setActiveChatId] = useState("")
  const [isInitializing, setIsInitializing] = useState(true)
  const [input, setInput] = useState("")
  const [selectedText, setSelectedText] = useState("")
  const [selectionPosition, setSelectionPosition] = useState<{ x: number; y: number } | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const activeChat = chats.find(c => c.id === activeChatId)

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme")
    if (savedTheme === "dark") {
      setIsDark(true)
      document.documentElement.classList.add("dark")
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function initChat() {
      const chat = await createNewChat()
      if (cancelled) return
      setChats([chat])
      setActiveChatId(chat.id)
      setIsInitializing(false)
    }

    void initChat()

    return () => {
      cancelled = true
    }
  }, [])

  const toggleTheme = () => {
    setIsDark(prev => {
      const newValue = !prev
      if (newValue) {
        document.documentElement.classList.add("dark")
        localStorage.setItem("theme", "dark")
      } else {
        document.documentElement.classList.remove("dark")
        localStorage.setItem("theme", "light")
      }
      return newValue
    })
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [activeChat?.messages])

  const handleNewChat = async () => {
    const newChat = await createNewChat()
    setChats(prev => [newChat, ...prev])
    setActiveChatId(newChat.id)
  }

  const handleDeleteChat = async (chatId: string) => {
    if (editingChatId === chatId) {
      setEditingChatId(null)
      setEditingTitle("")
    }
    if (chats.length === 1) {
      const newChat = await createNewChat()
      setChats([newChat])
      setActiveChatId(newChat.id)
      return
    }
    setChats(prev => prev.filter(c => c.id !== chatId))
    if (activeChatId === chatId) {
      const remaining = chats.filter(c => c.id !== chatId)
      if (remaining.length > 0) {
        setActiveChatId(remaining[0].id)
      }
    }
  }

  const startRenamingChat = (chatId: string, title: string) => {
    setEditingChatId(chatId)
    setEditingTitle(title)
  }

  const commitRenameChat = () => {
    if (!editingChatId) return
    const trimmed = editingTitle.trim()
    if (trimmed) {
      setChats(prev =>
        prev.map(chat =>
          chat.id === editingChatId ? { ...chat, title: trimmed } : chat
        )
      )
      void updateSessionTitle(editingChatId, trimmed)
    }
    setEditingChatId(null)
    setEditingTitle("")
  }

  const cancelRenameChat = () => {
    setEditingChatId(null)
    setEditingTitle("")
  }

  const handleSend = async () => {
    if (isSending) return

    const trimmed = input.trim()
    if (!trimmed || !activeChat) return

    setSendError(null)
    setIsSending(true)

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: trimmed,
    }

    const isFirstMessage = activeChat.messages.length === 0
    const suggestedTitle =
      trimmed.slice(0, 30) + (trimmed.length > 30 ? "..." : "")
    const shouldAutoTitle = isFirstMessage && activeChat.title === "Новый чат"

    const optimisticMessages = [...activeChat.messages, userMessage]

    setChats(prev =>
      prev.map(chat =>
        chat.id === activeChatId
          ? {
              ...chat,
              title: shouldAutoTitle ? suggestedTitle : chat.title,
              messages: optimisticMessages,
            }
          : chat,
      ),
    )
    setInput("")

    void saveMessage({
      sessionId: activeChatId,
      role: "user",
      content: trimmed,
    })

    if (shouldAutoTitle) {
      void updateSessionTitle(activeChatId, suggestedTitle)
    }

    try {
      const history: ApiChatMessage[] = optimisticMessages
        .slice(-20)
        .map(m => ({
          role: m.role,
          content: m.content,
        }))

      const taskTemplate = localStorage.getItem("task-template")?.trim()

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: history.slice(0, -1),
          ...(taskTemplate ? { taskTemplate } : {}),
        }),
      })

      const data = (await res.json()) as ApiChatResponse

      if (!res.ok) {
        throw new Error(data?.error || "Ошибка API /api/chat")
      }

      const assistantContent = data?.message?.content?.trim()
      if (!assistantContent) {
        throw new Error("Пустой ответ от модели")
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: assistantContent,
        isTask:
          assistantContent.startsWith("##") ||
          assistantContent.includes("Критерии приёмки"),
      }

      setChats(prev =>
        prev.map(chat =>
          chat.id === activeChatId
            ? { ...chat, messages: [...chat.messages, aiMessage] }
            : chat,
        ),
      )

      void saveMessage({
        sessionId: activeChatId,
        role: "assistant",
        content: assistantContent,
        isTask: aiMessage.isTask,
      })
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Не удалось получить ответ от модели"
      setSendError(msg)

      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: "assistant",
        content:
          "Не получилось получить ответ от модели. Проверьте `OPENROUTER_API_KEY` и повторите.\n\n" +
          `Текст ошибки: ${msg}`,
      }

      setChats(prev =>
        prev.map(chat =>
          chat.id === activeChatId
            ? { ...chat, messages: [...chat.messages, errorMessage] }
            : chat,
        ),
      )

      void saveMessage({
        sessionId: activeChatId,
        role: "assistant",
        content: errorMessage.content,
      })
    } finally {
      setIsSending(false)
    }
  }

  const handleTextSelection = () => {
    const selection = window.getSelection()
    const text = selection?.toString().trim()
    
    if (text && text.length > 0) {
      setSelectedText(text)
      const range = selection?.getRangeAt(0)
      const rect = range?.getBoundingClientRect()
      if (rect) {
        setSelectionPosition({
          x: rect.left + rect.width / 2,
          y: rect.top - 10
        })
      }
    } else {
      setSelectedText("")
      setSelectionPosition(null)
    }
  }

  const handleEditSelected = () => {
    if (selectedText) {
      setInput(`Измени это: "${selectedText}"\n\nНа:`)
      setSelectedText("")
      setSelectionPosition(null)
    }
  }

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="flex h-screen bg-background">
      {isInitializing ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Загрузка...
        </div>
      ) : (
        <>
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-border bg-sidebar flex flex-col">
        <div className="p-3">
          <Button 
            onClick={handleNewChat}
            variant="outline" 
            className="w-full justify-start gap-2 bg-sidebar-accent border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent/80"
          >
            <Plus className="h-4 w-4" />
            Новый чат
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2">
          <div className="space-y-1">
            {chats.map(chat => (
              <div
                key={chat.id}
                className={cn(
                  "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors",
                  chat.id === activeChatId 
                    ? "bg-sidebar-accent text-sidebar-foreground" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
                )}
                onClick={() => {
                  if (editingChatId !== chat.id) setActiveChatId(chat.id)
                }}
              >
                <MessageSquare className="h-4 w-4 flex-shrink-0" />
                {editingChatId === chat.id ? (
                  <Input
                    autoFocus
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      e.stopPropagation()
                      if (e.key === "Enter") {
                        e.preventDefault()
                        commitRenameChat()
                      }
                      if (e.key === "Escape") {
                        e.preventDefault()
                        cancelRenameChat()
                      }
                    }}
                    onBlur={commitRenameChat}
                    className="h-7 flex-1 min-w-0 px-2 text-sm bg-sidebar border-sidebar-border"
                  />
                ) : (
                  <span className="truncate flex-1">{chat.title}</span>
                )}
                {editingChatId !== chat.id && (
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      title="Переименовать"
                      onClick={(e) => {
                        e.stopPropagation()
                        startRenamingChat(chat.id, chat.title)
                      }}
                      className="p-1 hover:bg-sidebar-border rounded"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      title="Удалить"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteChat(chat.id)
                      }}
                      className="p-1 hover:bg-sidebar-border rounded"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-1">
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={toggleTheme}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {isDark ? "Светлая тема" : "Тёмная тема"}
          </Button>
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="h-4 w-4" />
            Настройки
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Chat Area */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto"
          onMouseUp={handleTextSelection}
        >
          {activeChat?.messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center px-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-2xl font-semibold text-foreground mb-2">TaskAI</h1>
              <p className="text-muted-foreground text-center max-w-md">
                Опишите фичу или задачу, и я помогу составить техническое задание для разработки
              </p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
              {activeChat?.messages.map(message => (
                <div key={message.id} className="flex gap-4">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium",
                    message.role === "assistant" 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-secondary text-secondary-foreground"
                  )}>
                    {message.role === "assistant" ? "AI" : "PM"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">
                        {message.role === "assistant" ? "AI-ассистент" : "Вы"}
                      </span>
                    </div>
                    <div className={cn(
                      "text-sm leading-relaxed",
                      message.isTask && "bg-card border border-border rounded-lg p-4"
                    )}>
                      {message.isTask ? (
                        <div className="relative">
                          <div className="whitespace-pre-wrap text-foreground/90">{message.content}</div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute top-0 right-0"
                            onClick={() => handleCopy(message.content, message.id)}
                          >
                            {copiedId === message.id ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      ) : (
                        <p className="text-foreground/90 whitespace-pre-wrap">{message.content}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Selection Tooltip */}
        {selectionPosition && selectedText && (
          <div 
            className="fixed z-50 bg-popover border border-border rounded-lg shadow-lg p-1 flex gap-1"
            style={{
              left: selectionPosition.x,
              top: selectionPosition.y,
              transform: "translate(-50%, -100%)"
            }}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEditSelected}
              className="gap-1 text-xs"
            >
              <PenLine className="h-3 w-3" />
              Изменить
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCopy(selectedText, "selection")}
              className="gap-1 text-xs"
            >
              {copiedId === "selection" ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              Копировать
            </Button>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-border bg-background p-4">
          <div className="max-w-3xl mx-auto">
            <div className="relative">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Опишите фичу или задачу..."
                className="min-h-[60px] max-h-[200px] pr-12 resize-none bg-input border-border"
                rows={2}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isSending}
                size="icon"
                className="absolute right-2 bottom-2"
              >
                <Send className={cn("h-4 w-4", isSending && "opacity-60")} />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              {isSending
                ? "Отправка сообщения..."
                : "Enter для отправки, Shift+Enter для новой строки"}
            </p>
            {sendError && (
              <p className="text-xs text-destructive mt-2 text-center">
                {sendError}
              </p>
            )}
          </div>
        </div>
      </main>

      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
        </>
      )}
    </div>
  )
}
