import { NextResponse } from "next/server";

const CRISIS_KEYWORDS = [
  "die",
  "kill myself",
  "suicide",
  "end my life",
  "i want to die",
  "i wanna die",
  "i don't want to live",
  "no reason to live",
  "harm myself",
  "self-harm",
  "self harm",
  "cutting myself",
  "want to end it",
  "kill me"
];

const POSITIVE_KEYWORDS = [
  "happy", "joy", "great", "good", "amazing", "awesome", "love", "excited",
  "wonderful", "fantastic", "glad", "blessed", "cheerful", "peaceful", "proud",
  "hopeful", "delighted", "smile", "content", "calm", "optimistic", "healed"
];

const NEGATIVE_KEYWORDS = [
  "sad", "angry", "bad", "hate", "upset", "depressed", "cry", "hurt",
  "lonely", "terrible", "miserable", "fear", "anxious", "scared", "worst",
  "unhappy", "pain", "hopeless", "grief", "broken", "empty", "worthless", "stressed"
];

function runLocalAnalysis(text: string) {
  const lowerText = text.toLowerCase();
  
  // 1. Check Crisis
  const hasCrisis = CRISIS_KEYWORDS.some(word => lowerText.includes(word));
  if (hasCrisis) {
    return { mood: "CRISIS", score: -2 };
  }

  // 2. Score Sentiment
  let score = 0;
  POSITIVE_KEYWORDS.forEach(word => {
    if (lowerText.includes(word)) score += 1;
  });
  NEGATIVE_KEYWORDS.forEach(word => {
    if (lowerText.includes(word)) score -= 1;
  });

  let mood = "Neutral";
  if (score > 0) mood = "Positive";
  else if (score < 0) mood = "Negative";

  return { mood, score };
}

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    // 1. Crisis check first (safety first, local override)
    const lowerText = text.toLowerCase();
    const hasCrisis = CRISIS_KEYWORDS.some(word => lowerText.includes(word));
    if (hasCrisis) {
      return NextResponse.json({ mood: "CRISIS", score: -2 });
    }

    const hfToken = process.env.HF_TOKEN;

    if (hfToken) {
      try {
        const response = await fetch(
          "https://api-inference.huggingface.co/models/cardiffnlp/twitter-roberta-base-sentiment-latest",
          {
            headers: {
              Authorization: `Bearer ${hfToken}`,
              "Content-Type": "application/json",
            },
            method: "POST",
            body: JSON.stringify({ inputs: text }),
          }
        );

        if (response.ok) {
          const result = await response.json();
          // The CardiffNLP model response format is:
          // [[ { label: "negative", score: 0.8 }, { label: "neutral", score: 0.1 }, { label: "positive", score: 0.1 } ]]
          // or LABEL_0 (Negative), LABEL_1 (Neutral), LABEL_2 (Positive)
          if (Array.isArray(result) && result[0]) {
            const predictions = result[0];
            // Sort by score descending to get top prediction
            predictions.sort((a: any, b: any) => b.score - a.score);
            const topPrediction = predictions[0];
            const rawLabel = topPrediction.label.toUpperCase();
            
            let mood = "Neutral";
            let score = 0;

            if (rawLabel.includes("LABEL_0") || rawLabel.includes("NEGATIVE")) {
              mood = "Negative";
              score = -1;
            } else if (rawLabel.includes("LABEL_2") || rawLabel.includes("POSITIVE")) {
              mood = "Positive";
              score = 1;
            }

            return NextResponse.json({ mood, score });
          }
        }
        console.warn("Hugging Face API returned non-ok status, falling back to local analysis.");
      } catch (hfErr) {
        console.error("Hugging Face API call failed, falling back to local analysis:", hfErr);
      }
    }

    // Fallback or default to local analysis
    const localResult = runLocalAnalysis(text);
    return NextResponse.json(localResult);

  } catch (error) {
    console.error("Analyze API error:", error);
    return NextResponse.json({ error: "Failed to analyze sentiment" }, { status: 500 });
  }
}