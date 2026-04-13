const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { text, settings } = await req.json();

    if (!text) {
      return new Response(JSON.stringify({ error: 'Missing text' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    if (!settings?.proxy_host || !settings?.proxy_port) {
      return new Response(JSON.stringify({ error: 'Proxy not configured' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    if (!settings?.llm_api_url) {
      return new Response(JSON.stringify({ error: 'API URL not configured' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    if (!settings?.llm_model) {
      return new Response(JSON.stringify({ error: 'Model not configured' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    if (!settings?.llm_api_key) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    const defaultPrompt = `Ты парсишь задачу. Верни JSON с полями: title, description, assignee, dueDate (YYYY-MM-DD), amount, priority (low/medium/high), externalUrl. Верни ТОЛЬКО валидный JSON без markdown.`;
    const prompt = settings.llm_prompt || defaultPrompt;

    const messages = [
      { role: 'system', content: prompt },
      { role: 'user', content: text.replace(/"/g, "'").replace(/\n/g, ' ') }
    ];

    const requestBody = {
      model: settings.llm_model,
      messages,
      temperature: 0.1,
      max_tokens: 500
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.llm_api_key}`,
    };

    const { HttpsProxyAgent } = await import('https://esm.sh/https-proxy-agent@7.0.0');
    const proxyUrl = settings.proxy_login && settings.proxy_password 
      ? `http://${settings.proxy_login}:${settings.proxy_password}@${settings.proxy_host}:${settings.proxy_port}`
      : `http://${settings.proxy_host}:${settings.proxy_port}`;
    // @ts-ignore
    const agent = new HttpsProxyAgent(proxyUrl);

    const response = await fetch(settings.llm_api_url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      agent,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in response');
    }

    const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let parsed;
    try {
      parsed = JSON.parse(cleanContent);
    } catch (e) {
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON from LLM: ' + cleanContent.slice(0, 200));
      }
    }

    return new Response(
      JSON.stringify({
        title: parsed.title || text.slice(0, 50),
        description: parsed.description || text,
        assignee: parsed.assignee || null,
        dueDate: parsed.dueDate || null,
        amount: parsed.amount || 0,
        priority: parsed.priority || 'medium',
        externalUrl: parsed.externalUrl || '',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});