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

    const { message, history = [] } = json

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

    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          "Ты — AI-ассистент для постановки задач на разработку. " +
          "Работаешь как продуктовый аналитик: задаёшь уточняющие вопросы, " +
          "подсвечиваешь пробелы в требованиях и помогаешь формировать структурированные задачи.",
      },
      ...normalizedHistory,
      {
        role: "user",
        content: message,
      },
    ]

    const completion = await openai.chat.completions.create({
      model: "google/gemma-3-4b-it:free",
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

