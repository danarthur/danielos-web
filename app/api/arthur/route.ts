import { StreamingTextResponse } from 'ai';

const PYTHON_BACKEND_URL = 'http://127.0.0.1:8000/api/chat';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // Forward to Python Backend
    const response = await fetch(PYTHON_BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      throw new Error(`Python Backend Error: ${response.statusText}`);
    }

    // Proxy the stream directly
    return new StreamingTextResponse(response.body);

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Arthur is offline' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

