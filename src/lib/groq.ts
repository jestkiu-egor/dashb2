const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_PROXY_URL = import.meta.env.VITE_GROQ_PROXY_URL;

interface ParsedTask {
  title: string;
  description: string;
  assignee?: string;
  dueDate?: string;
  amount?: number;
  externalUrl?: string;
  priority?: 'low' | 'medium' | 'high';
}

export async function parseTaskWithAI(text: string): Promise<ParsedTask | null> {
  const prompt = `Parse the following task description and extract structured information. Return ONLY valid JSON without any markdown or extra text.

Extract:
- title: short task name (required)
- description: full description
- assignee: who should do this task (if mentioned)
- dueDate: deadline in YYYY-MM-DD format (if mentioned, like "до понедельника", "к 15 числу" → convert to actual date)
- amount: money amount in rubles (if mentioned like "5000 рублей" or "на 10 тысяч")
- externalUrl: any links found (like bitrix24 links)
- priority: low, medium, or high (detect from urgency words like "срочно", "важно", "критично")

Text: "${text}"

Return JSON like:
{"title":"...","description":"...","assignee":"...","dueDate":"2024-12-31","amount":5000,"externalUrl":"...","priority":"high"}`;

  const targetUrl = GROQ_PROXY_URL 
    ? `${GROQ_PROXY_URL}/v1/chat/completions` 
    : 'https://api.groq.com/openai/v1/chat/completions';

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Groq API error:', response.status, errorData);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) return null;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing task:', error);
    return null;
  }
}

export async function transcribeAudio(file: File): Promise<string | null> {
  const targetUrl = GROQ_PROXY_URL 
    ? `${GROQ_PROXY_URL}/v1/audio/transcriptions` 
    : 'https://api.groq.com/openai/v1/audio/transcriptions';

  const formData = new FormData();
  formData.append('file', file);
  formData.append('model', 'whisper-large-v3');
  formData.append('language', 'ru');

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      console.error('Transcription error:', await response.text());
      return null;
    }

    const data = await response.json();
    return data.text || null;
  } catch (error) {
    console.error('Error transcribing:', error);
    return null;
  }
}
