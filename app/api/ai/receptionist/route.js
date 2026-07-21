// Server-side AI receptionist. The Anthropic key stays on the server (it must
// never ship to the browser). With a key set, this calls Claude; without one it
// falls back to a deterministic keyword parser so the flow is fully demoable.
import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/session";
import { isAnthropicConfigured } from "@/lib/env";

const SYSTEM = `You are the AI receptionist for Fleming Realty Group, a property management company in Camp Hill, PA.
A resident has described a maintenance issue. Your job is to:
1. Reply warmly and empathetically in 1 short sentence acknowledging their issue.
2. Then output a JSON block (and nothing else after it) with this exact structure:
{"title":"short issue title max 6 words","category":"one of: HVAC|Plumbing|Electrical|Security|General|Appliance|Other","urgency":"urgent|pending|scheduled","notes":"1-2 sentence summary of the issue for the maintenance team"}
urgency rules: urgent = safety risk or no heat/AC/water. pending = annoying but livable. scheduled = cosmetic or minor.
Output format: friendly sentence, then on a new line: WORKORDER_JSON: {"title":...}`;

export async function POST(request) {
  const me = await getServerUser(request);
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { message } = await request.json().catch(() => ({}));
  if (!message || !message.trim()) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  if (isAnthropicConfigured()) {
    try {
      const result = await callClaude(message);
      // Guarantee a structured work order even if the model didn't emit clean JSON.
      if (!result.workOrder) {
        const mock = mockParse(message);
        return NextResponse.json({ reply: result.reply || mock.reply, workOrder: mock.workOrder });
      }
      return NextResponse.json(result);
    } catch (e) {
      // On any Anthropic error, fall back to the deterministic parser so the flow works.
      return NextResponse.json(mockParse(message));
    }
  }
  return NextResponse.json(mockParse(message));
}

async function callClaude(message) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
      max_tokens: 500,
      system: SYSTEM,
      messages: [{ role: "user", content: message }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const data = await res.json();
  const raw = data.content?.[0]?.text || "";

  // Prefer the explicit marker, but fall back to the first {...} JSON block so we
  // stay robust to models that don't follow the exact output contract.
  const marker = raw.indexOf("WORKORDER_JSON:");
  let jsonStart = marker > -1 ? raw.indexOf("{", marker) : raw.indexOf("{");
  let reply = (jsonStart > -1 ? raw.slice(0, marker > -1 ? marker : jsonStart) : raw).trim();
  let workOrder = null;
  if (jsonStart > -1) {
    const jsonEnd = raw.lastIndexOf("}");
    try { workOrder = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)); } catch {}
  }
  return { reply: reply || "Got it — let me create that work order for you.", workOrder };
}

// Deterministic fallback so the receptionist works with no API key.
function mockParse(text) {
  const t = text.toLowerCase();
  const pick = (map, dflt) => Object.entries(map).find(([, kws]) => kws.some((k) => t.includes(k)))?.[0] || dflt;

  const category = pick({
    HVAC: ["ac", "a/c", "air condition", "heat", "furnace", "hvac", "cooling", "thermostat"],
    Plumbing: ["leak", "water", "drain", "toilet", "faucet", "sink", "pipe", "clog"],
    Electrical: ["light", "outlet", "power", "electric", "breaker", "spark"],
    Security: ["lock", "door", "window", "break", "key", "smoke", "alarm"],
    Appliance: ["fridge", "refrigerator", "oven", "stove", "dishwasher", "washer", "dryer", "microwave"],
  }, "General");

  const urgency = pick({
    urgent: ["no heat", "no ac", "no a/c", "no water", "flood", "gas", "smoke", "spark", "won't lock", "cant lock", "can't lock", "not cooling", "not heating"],
    scheduled: ["cosmetic", "paint", "scratch", "minor", "whenever", "small"],
  }, "pending");

  const firstSentence = text.trim().replace(/\s+/g, " ").split(/[.!?]/)[0];
  const title = firstSentence.length > 42 ? firstSentence.slice(0, 42).trim() + "…" : firstSentence;

  const replies = {
    urgent: "I'm sorry you're dealing with that — I'm flagging it as urgent right now.",
    pending: "Thanks for letting me know — I'll get this logged for you.",
    scheduled: "Got it, thanks — I'll add this to the list to take care of.",
  };

  return {
    reply: replies[urgency],
    workOrder: {
      title: title.charAt(0).toUpperCase() + title.slice(1),
      category,
      urgency,
      notes: `Resident reported: ${text.trim()}`,
    },
  };
}
