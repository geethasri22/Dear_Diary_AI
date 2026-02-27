import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    const positiveWords = [
      "happy", "joy", "great", "good", "amazing",
      "awesome", "love", "excited", "wonderful", "fantastic"
    ];

    const negativeWords = [
      "sad", "angry", "bad", "hate", "upset",
      "depressed", "cry", "hurt", "lonely", "terrible",
      "suicide", "kill myself", "end my life"
    ];

    let score = 0;

    const lowerText = text.toLowerCase();

    positiveWords.forEach(word => {
      if (lowerText.includes(word)) score++;
    });

    negativeWords.forEach(word => {
      if (lowerText.includes(word)) score--;
    });

    let label = "Neutral 😐";

    if (score > 0) label = "Positive 😊";
    if (score < 0) label = "Negative 😔";
    if (score < -1) label = "Severe Negative 🚨";

    return NextResponse.json([[{ label, score }]]);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to analyze" }, { status: 500 });
  }
}