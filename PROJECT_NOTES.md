# 2code Kanban Project Notes

## Working Branch
- **ONLY work on branch `jestkiu_vetka`** - NEVER work on main or other branches

## Current Status (Apr 2026)
- All Groq API keys are FORBIDDEN via proxy
- Need new AI keys (Groq, OpenAI, Anthropic, or Ollama)
- Kanban columns NOT saving changes to DB - need to fix

## Architecture
- **Database**: Supabase (project `aghexmykhvedbxyqptof`)
- **Frontend**: Vercel (react app)
- **All data must go through Supabase** - no local state only

## Current Issues
1. Column name changes not saving
2. Column order not saving
3. Column delete not saving

## Previous Accomplishments
- Kanban board with drag-drop (@dnd-kit)
- Editable columns, task forms
- AI task creation via Groq
- Voice input (Web Speech API)
- Audio/video transcription
- Cloudflare Worker proxy for Groq