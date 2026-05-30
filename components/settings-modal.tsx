"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Brain, Save } from "lucide-react"

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const [memory, setMemory] = useState("")
  const [taskTemplate, setTaskTemplate] = useState("")

  useEffect(() => {
    if (!open) return
    const savedMemory = localStorage.getItem("ai-memory")
    const savedTemplate = localStorage.getItem("task-template")
    if (savedMemory) setMemory(savedMemory)
    else setMemory("")
    if (savedTemplate) setTaskTemplate(savedTemplate)
    else setTaskTemplate("")
  }, [open])

  const handleSave = () => {
    localStorage.setItem("ai-memory", memory)
    if (taskTemplate.trim()) {
      localStorage.setItem("task-template", taskTemplate)
    } else {
      localStorage.removeItem("task-template")
    }
    onOpenChange(false)
  }

  const handleClear = () => {
    setMemory("")
    setTaskTemplate("")
    localStorage.removeItem("ai-memory")
    localStorage.removeItem("task-template")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="size-5 text-primary" />
            Настройки
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Настройте контекст для AI и формат итоговой задачи
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="memory">Что AI должен помнить о вас и вашей команде?</Label>
            <Textarea
              id="memory"
              value={memory}
              onChange={(e) => setMemory(e.target.value)}
              className="min-h-[160px] text-sm bg-input border-border resize-none"
              placeholder="Например:
• Мы используем Jira для трекинга задач
• Формат оценки: Story Points (1, 2, 3, 5, 8)
• Всегда добавлять критерии приёмки
• Наш стек: React, Node.js, PostgreSQL
• Команда: 3 фронтенд, 2 бэкенд разработчика"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-template">Шаблон задачи</Label>
            <Textarea
              id="task-template"
              value={taskTemplate}
              onChange={(e) => setTaskTemplate(e.target.value)}
              className="min-h-[160px] text-sm bg-input border-border resize-none font-mono"
              placeholder={`## Описание
## Критерии приёмки
## Технические детали`}
            />
            <p className="text-xs text-muted-foreground">
              Задайте структуру итоговой задачи. AI будет генерировать задачу строго по этому шаблону. Если поле пустое — используется стандартный формат.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={handleClear} className="text-muted-foreground">
            Очистить
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave} className="gap-2">
              <Save className="size-4" />
              Сохранить
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
