import { NextResponse } from "next/server";

const CHAT_FALLBACKS = [
  "I hear you. It sounds like things have been really challenging, but please remember that I am here to support you. You're doing the best you can.",
  "Thank you for sharing that with me. It takes a lot of strength to talk about these feelings. How can I help you feel a bit more comfortable right now?",
  "That sounds incredibly heavy. Please remember to take a deep breath and be gentle with yourself. You are not alone in this.",
  "I'm here to listen. Whatever you are going through, your feelings are valid. What else is on your mind?",
  "I appreciate you opening up. It's completely okay to feel overwhelmed sometimes. I'm here to support you step by step."
];

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages array is required" }, { status: 400 });
    }

    const lastMessage = messages[messages.length - 1]?.content || "";

    const hfToken = process.env.HF_TOKEN;

    if (hfToken && lastMessage.trim()) {
      try {
        const conversationHistory = messages.map(msg => {
          return `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`;
        }).join("\n");

        const prompt = `You are a supportive, warm, and compassionate mental health chatbot helper for a journaling application called "Dear Diary". A user has been going through a difficult week and wants to talk.
Provide a comforting, brief, and validating response (under 70 words) to the user's message. Do not give medical or clinical advice.

Conversation history:
${conversationHistory}

Response:`;

        const response = await fetch(
          "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
          {
            headers: {
              Authorization: `Bearer ${hfToken}`,
              "Content-Type": "application/json",
            },
            method: "POST",
            body: JSON.stringify({
              inputs: `<s>[INST] ${prompt} [/INST]`,
              parameters: { max_new_tokens: 100, temperature: 0.7 }
            }),
          }
        );

        if (response.ok) {
          const result = await response.json();
          let reply = "";
          if (Array.isArray(result) && result[0]) {
            reply = result[0].generated_text || "";
          } else if (result && result.generated_text) {
            reply = result.generated_text;
          }

          if (reply.includes("[/INST]")) {
            reply = reply.split("[/INST]").pop()?.trim() || "";
          } else if (reply.includes("Response:")) {
            reply = reply.split("Response:").pop()?.trim() || "";
          }

          if (reply.trim().length > 0) {
            return NextResponse.json({ reply: reply.trim() });
          }
        }
      } catch (err) {
        console.error("HF chat API call failed:", err);
      }
    }

    // Fallback response
    const randomIndex = Math.floor(Math.random() * CHAT_FALLBACKS.length);
    const reply = CHAT_FALLBACKS[randomIndex];
    return NextResponse.json({ reply });

  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: "Failed to generate chat response" }, { status: 500 });
  }
}
