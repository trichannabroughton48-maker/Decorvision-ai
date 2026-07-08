// DecorVision AI — written shopping plan for a chosen style
// Calls the Anthropic API. Requires env var ANTHROPIC_API_KEY set in Vercel.

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { imageB64, mediaType, style } = req.body || {};
    if (!imageB64 || !style) {
      return res.status(400).json({ error: "Missing photo or style." });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set in Vercel." });
    }

    const prompt =
      `You are an interior designer creating a concrete shopping plan to redo this room in a "${style}" style. ` +
      `Be specific and practical — name actual furniture pieces, sizes, and real paint colors from Sherwin-Williams, Behr, or Benjamin Moore with their color codes. ` +
      `No vague style talk, no discussion of "patterns" or abstract vibes. Every item must be something the person can go buy and place.\n\n` +
      `Respond with ONLY a JSON object, no markdown fences, no extra text, in exactly this shape:\n` +
      `{\n` +
      `  "diagnosis": "2-3 sentences on what is holding this room back right now",\n` +
      `  "palette": [{"name": "color name", "hex": "#RRGGBB"}] (exactly 5),\n` +
      `  "paint": [{"surface": "e.g. main walls", "brand": "Sherwin-Williams", "colorName": "Sea Salt", "code": "SW 6204"}] (2-3 entries),\n` +
      `  "furniture": [{"item": "specific piece with size/material", "placement": "exactly where in this room", "budget": "$ range"}] (5-7 entries),\n` +
      `  "quickWins": ["thing under $50 they can do this week"] (3-4 entries)\n` +
      `}`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType || "image/jpeg",
                  data: imageB64,
                },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      const msg = (data && data.error && data.error.message) || "Plan service error.";
      return res.status(502).json({ error: msg });
    }

    const text = (data.content || [])
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("");

    let plan;
    try {
      plan = JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch (e) {
      return res.status(502).json({ error: "The plan didn't come through cleanly. Tap retry." });
    }

    return res.status(200).json({ plan });
  } catch (e) {
    return res.status(500).json({ error: (e && e.message) || "Server error." });
  }
};
