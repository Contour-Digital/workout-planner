import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EXERCISE_CATEGORIES = ["strength", "cardio", "mobility", "bodyweight", "functional", "recovery"];

const MUSCLE_GROUPS = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "forearms",
  "core",
  "glutes",
  "quads",
  "hamstrings",
  "calves",
  "full_body",
  "cardiovascular",
  "hip_flexors",
  "lower_back",
];

const EQUIPMENT = [
  "none",
  "barbell",
  "dumbbell",
  "kettlebell",
  "machine",
  "cable",
  "resistance_band",
  "bench",
  "pull_up_bar",
  "treadmill",
  "bike",
  "rower",
  "foam_roller",
  "mat",
  "other",
];

const REPLY_TOOL = {
  name: "record_reply",
  description: "Record your reply to the user, plus any specific exercise suggestions.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      reply: { type: "string", description: "Your conversational reply to the user's latest message. Keep it concise — 2 to 5 sentences." },
      suggestions: {
        type: "array",
        description: "Specific exercises you're suggesting the user add, if any. Leave empty for a plain conversational reply with no actionable suggestion.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Exercise name, cleaned up to standard title case (e.g. 'Barbell Bench Press')." },
            section: { type: "string", enum: ["warmup", "main", "cooldown"], description: "Which part of the routine this belongs in." },
            category: { type: "string", enum: EXERCISE_CATEGORIES, description: "Best-guess exercise category." },
            primaryMuscles: { type: "array", items: { type: "string", enum: MUSCLE_GROUPS }, description: "Best-guess primary muscle groups worked, most relevant first." },
            equipment: { type: "array", items: { type: "string", enum: EQUIPMENT }, description: "Best-guess equipment used. Use ['none'] for pure bodyweight moves." },
            reason: { type: "string", description: "One short phrase on why you're suggesting it (e.g. 'balances the pushing volume above')." },
          },
          required: ["name", "section", "category", "primaryMuscles", "equipment", "reason"],
          additionalProperties: false,
        },
      },
    },
    required: ["reply", "suggestions"],
    additionalProperties: false,
  },
};

function listOrNone(items: string[]): string {
  return items.length ? items.join(", ") : "none yet";
}

// deno-lint-ignore no-explicit-any
function buildSystemPrompt(context: any): string {
  const intro = `You are the built-in AI assistant for Workout Planner, a workout tracking app. You help users pick exercises, suggest warm-up and cool-down stretches, answer training questions (form, sets/reps, rest periods), and give general fitness advice. You are not a medical professional — for pain, injury, or medical concerns, tell the user to consult a doctor or physical therapist rather than diagnosing anything yourself.

Keep replies conversational and concise (2-5 sentences) — this is a mobile chat window, not an essay.

When the user asks for exercise suggestions, or when it's clearly useful (e.g. "what should I add", "give me a warm-up", "what pairs well with X"), name specific exercises via the suggestions field on record_reply so the app can offer to add them directly. Otherwise leave suggestions empty and just answer in reply. Always call record_reply exactly once per turn — never respond with plain text.`;

  if (!context || typeof context !== "object") return intro;

  if (context.kind === "routine") {
    return `${intro}

The user is currently building a workout routine named "${context.routineName || "(untitled)"}" in the routine editor.
Warm-up exercises so far: ${listOrNone(context.warmup ?? [])}
Main workout exercises so far: ${listOrNone(context.main ?? [])}
Cool-down exercises so far: ${listOrNone(context.cooldown ?? [])}

Suggest exercises that complement what's already there and avoid duplicating them, unless the user asks to replace something.`;
  }

  if (context.kind === "session") {
    const main = Array.isArray(context.main) ? context.main : [];
    const mainSummary = main.length
      ? main.map((e: { name: string; setsDone: number; setsTotal: number }) => `${e.name} (${e.setsDone}/${e.setsTotal} sets done)`).join(", ")
      : "none";
    return `${intro}

The user is mid-workout, ${context.elapsedMinutes ?? 0} minutes in, doing a routine named "${context.routineName || "Workout"}".
Warm-up: ${listOrNone(context.warmup ?? [])}
Main workout: ${mainSummary}
Cool-down: ${listOrNone(context.cooldown ?? [])}

Any exercise you suggest gets added directly to their in-progress workout as a new main-workout exercise, so only suggest one when they ask for it or it's clearly what they want (e.g. "give me a finisher", "what's a good superset for this").`;
  }

  return intro;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  try {
    const { messages, context } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Missing 'messages' to reply to." }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    const trimmed = messages.slice(-20);
    const last = trimmed[trimmed.length - 1];
    if (!last || last.role !== "user" || typeof last.content !== "string" || !last.content.trim()) {
      return new Response(JSON.stringify({ error: "The last message must be non-empty text from the user." }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    if (trimmed.some((m: { content?: unknown }) => typeof m.content !== "string" || m.content.length > 4000)) {
      return new Response(JSON.stringify({ error: "A message is too long (4,000 character limit)." }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Server is missing ANTHROPIC_API_KEY." }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 1200,
      output_config: { effort: "low" },
      system: buildSystemPrompt(context),
      tools: [REPLY_TOOL],
      tool_choice: { type: "auto" },
      messages: trimmed.map((m: { role: "user" | "assistant"; content: string }) => ({ role: m.role, content: m.content })),
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === "record_reply",
    );

    if (!toolUse) {
      return new Response(JSON.stringify({ error: "The assistant didn't respond. Try again." }), {
        status: 422,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(toolUse.input), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("assistant-chat error:", err);
    const message = err instanceof Anthropic.APIError ? err.message : "Unexpected error talking to the assistant.";
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
