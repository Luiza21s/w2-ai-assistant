import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

const openrouterApiKey = process.env.OPENROUTER_API_KEY

if (!openrouterApiKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "[OpenRouter] OPENROUTER_API_KEY is not set. /api/chat will return 500 until it is configured.",
  )
}

const openai = new OpenAI({
  apiKey: openrouterApiKey,
  baseURL: "https://openrouter.ai/api/v1",
})

type ChatMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

type ChatRequestBody = {
  message: string
  history?: ChatMessage[]
  taskTemplate?: string
}

const DEFAULT_TASK_TEMPLATE = `## Название
## Описание
## Критерии приёмки
## Технические детали`

function buildSystemPrompt(taskTemplate?: string): string {
  const basePrompt = `Ты — опытный бизнес-аналитик и продуктовый менеджер. Твоя задача — помочь PM сформулировать чёткую задачу для разработчиков. Когда пользователь описывает фичу:

Задавай уточняющие вопросы по одному — не все сразу
Подсвечивай что не хватает: цель фичи, границы, edge cases, критерии приёмки
Когда информации достаточно — предложи сгенерировать задачу
Генерируй задачу только когда пользователь подтвердит готовность
Говори по-русски. Будь конкретным и профессиональным.
Задача должна быть написана понятно и по-человечески — без канцелярита, сложных терминов и бюрократических формулировок. Разработчик должен сразу понять что нужно сделать и зачем.`

  const trimmedTemplate = taskTemplate?.trim()

  if (trimmedTemplate) {
    return `${basePrompt}

Когда генерируешь задачу, строго следуй этой структуре. Сохрани все заголовки и порядок секций из шаблона, заполни каждую секцию содержательным текстом. Не добавляй и не удаляй секции, не меняй их порядок:

${trimmedTemplate}`
  }

  return `${basePrompt}

Когда генерируешь задачу, используй стандартный формат:

${DEFAULT_TASK_TEMPLATE}`
}

export async function POST(req: NextRequest) {
  try {
    if (!openrouterApiKey) {
      return NextResponse.json(
        { error: "OPENROUTER_API_KEY is not configured on the server." },
        { status: 500 },
      )
    }

    const json = (await req.json()) as ChatRequestBody | null

    if (!json || typeof json.message !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid `message` in request body." },
        { status: 400 },
      )
    }

    const { message, history = [], taskTemplate } = json

    const normalizedHistory: ChatMessage[] = Array.isArray(history)
      ? history.filter(
          (m): m is ChatMessage =>
            m &&
            (m.role === "system" ||
              m.role === "user" ||
              m.role === "assistant") &&
            typeof m.content === "string" &&
            m.content.trim().length > 0,
        )
      : []

    const systemPrompt = buildSystemPrompt(
      typeof taskTemplate === "string" ? taskTemplate : undefined,
    )

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: systemPrompt,
      },
      ...normalizedHistory,
      {
        role: "user",
        content: message,
      },
    ]

    const completion = await openai.chat.completions.create({
      model: "poolside/laguna-xs.2:free",
      messages,
    })

    const choice = completion.choices[0]

    return NextResponse.json({
      message: choice.message,
      usage: completion.usage,
      id: completion.id,
      model: completion.model,
    })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[OpenRouter] /api/chat error:", error)

    return NextResponse.json(
      { error: "Failed to generate completion from OpenRouter." },
      { status: 500 },
    )
  }
}

