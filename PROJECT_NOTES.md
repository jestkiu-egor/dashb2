# 2code Kanban Project Notes

## Working Branch
- **ONLY work on branch `jestkiu_vetka`** - NEVER work on main or other branches

## Commit Rules (ОБЯЗАТЕЛЬНО)
1. **Язык коммитов**: ТОЛЬКО русский
2. **Формат коммита**: <тип>: <краткое описание проблемы> - <краткое решение>
3. **Пример**: `fix: не сохранялись колонки в БД - добавил вызов handleUpdateColumn в KanbanBoard`

## Current Status (Apr 2026)
- All Groq API keys are FORBIDDEN via proxy
- Need new AI keys (Groq, OpenAI, Anthropic, or Ollama)
- Kanban columns NOT saving changes to DB - FIXED

## Architecture
- **Database**: Supabase (project `aghexmykhvedbxyqptof`)
- **Frontend**: Vercel (project-csb0k)
- **All data must go through Supabase** - no local state only

## Current Issues
1. Need to create `columns` table in Supabase (SQL provided)

## Previous Accomplishments
- Kanban board with drag-drop (@dnd-kit)
- Editable columns, task forms
- AI task creation via Groq
- Voice input (Web Speech API)
- Audio/video transcription
- Cloudflare Worker proxy for Groq