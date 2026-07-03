import { NextResponse } from "next/server";

const LOCAL_RESPONSES = {
  Positive: [
    "That's wonderful to hear! Nurture these bright moments and carry this positive energy with you. ✨",
    "It's so beautiful to read about your joy. Remember this feeling, and keep shining! 🌟",
    "I'm so glad you had a positive experience today. Celebrating your wins is a wonderful way to honor yourself. 💛",
    "Your positive energy is inspiring. Thank you for taking a moment to write down what went well today! 🌿"
  ],
  Neutral: [
    "Thank you for sharing. Finding balance in the quiet, neutral moments is a great form of self-reflection. 🌿",
    "It's okay to feel neutral. Every day doesn't need to be a peak or a valley—sometimes peaceful stability is exactly what we need. 🌸",
    "Reflecting on your day is a valuable habit, even when things feel plain. You are doing great. 🤍",
    "A neutral day is a calm canvas. Take some time to rest and recharge for tomorrow. 🌿"
  ],
  Negative: [
    "I'm really sorry you're feeling this way. Your feelings are completely valid, and it's okay to not be okay. Please be gentle with yourself. 💛",
    "It sounds like you're carrying a heavy burden right now. You are not alone, and it's okay to give yourself space to just feel. 🌸",
    "I hear you, and I'm sending you warmth. Acknowledging these tough emotions shows real courage and vulnerability. Take things one step at a time. 🌿",
    "Today was tough, but you showed up for yourself by writing it down. Please take a deep breath. You are stronger than you think. 🤍"
  ],
  CRISIS: [
    "You are not alone, and there is support available. Please know that your life is valuable. Reach out to the Kiran Helpline at 1800-599-0019 (available 24/7) or speak to a professional. We care about you. ☎️💛",
    "Please stay safe. If you're feeling overwhelmed, call the Kiran mental health helpline at 1800-599-0019 right away. There are people who want to listen and help you through this. 💛"
  ]
};

function getLocalFeedback(mood: string): string {
  const normalizedMood = (mood === "CRISIS" ? "CRISIS" : mood === "Positive" ? "Positive" : mood === "Negative" ? "Negative" : "Neutral") as keyof typeof LOCAL_RESPONSES;
  const list = LOCAL_RESPONSES[normalizedMood] || LOCAL_RESPONSES.Neutral;
  const randomIndex = Math.floor(Math.random() * list.length);
  return list[randomIndex];
}

export async function POST(req: Request) {
  try {
    const { text, mood } = await req.json();

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const hfToken = process.env.HF_TOKEN;

    if (hfToken) {
      try {
        const prompt = `You are a compassionate support assistant. Provide a brief, supportive, validating, and empathetic response (under 80 words) to a user who just wrote in their diary.
User's Detected Mood: ${mood}
User's Diary Entry: "${text}"

Do not give medical advice. If the mood is CRISIS, encourage them to reach out to professional support or call Kiran Helpline 1800-599-0019. Keep the tone warm and human.`;

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
              parameters: { max_new_tokens: 150, temperature: 0.7 }
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

          // Clean up the prompt from output if returned
          if (reply.includes("[/INST]")) {
            reply = reply.split("[/INST]").pop()?.trim() || "";
          } else if (reply.includes(prompt)) {
            reply = reply.replace(prompt, "").trim();
          }

          if (reply.trim().length > 0) {
            return NextResponse.json({ reply: reply.trim() });
          }
        }
        console.warn("Hugging Face API returned non-ok status, falling back to local support response.");
      } catch (hfErr) {
        console.error("Hugging Face API call failed, falling back to local support response:", hfErr);
      }
    }

    // Local dictionary fallback
    const localReply = getLocalFeedback(mood);
    return NextResponse.json({ reply: localReply });

  } catch (error) {
    console.error("Support API error:", error);
    return NextResponse.json({ error: "Failed to generate support response" }, { status: 500 });
  }
}