export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { query } = await req.json();

    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "Missing query" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const prompt = `
Convert this campus amenity search into JSON.

Allowed type values:
- "vending"
- "microwave"
- null

Return JSON only with this exact shape:
{
  "type": "vending" | "microwave" | null,
  "keyword": string | null
}

Rules:
- If the user mentions vending, snacks, soda, chips, coffee machine, or drinks, use "vending".
- If the user mentions microwave, use "microwave".
- If no type is clear, use null.
- If the user includes location phrases like "near", "by", or "close to", keep the full phrase in "keyword".
  Examples:
  - "near alpine hall" -> "keyword": "near alpine hall"
  - "by parking lot 1" -> "keyword": "by parking lot 1"
- Otherwise, use the main building name or descriptor as "keyword".

User query: "${query}"
`.trim();
console.log("ANTHROPIC_API_KEY exists:", !!process.env.ANTHROPIC_API_KEY);
console.log("ANTHROPIC_API_KEY prefix:", process.env.ANTHROPIC_API_KEY?.slice(0, 10));
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return new Response(JSON.stringify({ error: text }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const text = data.content?.[0]?.text ?? "{}";

// Extract JSON from Claude response
const match = text.match(/\{[\s\S]*\}/);

if (!match) {
  return new Response(
    JSON.stringify({ error: "No JSON found", raw: text }),
    {
      status: 500,
      headers: { "Content-Type": "application/json" },
    }
  );
}

let parsed;
try {
  parsed = JSON.parse(match[0]);
} catch {
  return new Response(
    JSON.stringify({ error: "Invalid JSON format", raw: text }),
    {
      status: 500,
      headers: { "Content-Type": "application/json" },
    }
  );
}

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Something went wrong" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};