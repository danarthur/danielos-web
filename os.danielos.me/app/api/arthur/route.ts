import { StreamingTextResponse, LangChainStream } from 'ai';

export async function POST(req: Request) {
    const { messages } = await req.json();
  const lastMessage = messages[messages.length - 1].content;

  // Create a stream to simulate AI thinking
  const { stream, writer } = LangChainStream();

  // Simulate a response (No Python required)
  const responseText = `[SIMULATION MODE] \n\nI received your query: "${lastMessage}". \n\nMy core Python backend is currently offline, so I cannot process complex logic yet. However, the frontend interface is fully operational.`;

  // Write the response slowly to look like AI
  (async () => {
    for (const char of responseText) {
        await new Promise(r => setTimeout(r, 20)); // Typing effect
        writer.write(char);
    }
    writer.close();
  })();

  return new StreamingTextResponse(stream);
  }
