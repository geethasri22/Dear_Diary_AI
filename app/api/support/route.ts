import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { text } = await req.json();

  const prompt = `
You are a compassionate support assistant.
Offer emotional validation.
Do not give medical advice.
Encourage seeking real help if crisis detected.
Keep response under 120 words.

User message: ${text}
`;

  // Replace with your AI model call
  const response = "I'm really sorry you're feeling this way. Your feelings are valid. You're not alone. If things feel overwhelming, consider reaching out to someone you trust or a professional for support.";

  return NextResponse.json({ reply: response });
}