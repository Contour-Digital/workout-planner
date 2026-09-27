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

const EXERCISE_DETAILS_TOOL = {
  name: "record_exercise_details",
  description: "Record researched library details for a single gym exercise.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "The exercise's standardized title, title case (e.g. 'Hammer Strength Chest Press'). Fold in the equipment/brand hints if that's how the movement is normally referred to; otherwise keep the given name, cleaned up.",
      },
      category: { type: "string", enum: EXERCISE_CATEGORIES, description: "Single best-fit category." },
      primaryMuscles: {
        type: "array",
        items: { type: "string", enum: MUSCLE_GROUPS },
        description: "Muscles this exercise primarily, meaningfully targets, most relevant first. Don't pad the list — only real primary targets.",
      },
      secondaryMuscles: {
        type: "array",
        items: { type: "string", enum: MUSCLE_GROUPS },
        description: "Secondary/stabilizer muscles worked. Empty array if there genuinely aren't any worth noting.",
      },
      equipment: {
        type: "array",
        items: { type: "string", enum: EQUIPMENT },
        description: "Equipment required to perform it. Use ['none'] for pure bodyweight moves.",
      },
      instructions: {
        type: "array",
        items: { type: "string" },
        description: "3-6 concise, ordered steps for how to perform the exercise correctly.",
      },
      techniqueTips: {
        type: "array",
        items: { type: "string" },
        description: "1-3 short cues that help with good form.",
      },
      commonMistakes: {
        type: "array",
        items: { type: "string" },
        description: "1-3 common mistakes people make with this exercise.",
      },
      notes: {
        type: ["string", "null"],
        description: "Any equipment-specific detail worth keeping (e.g. plate-loaded vs. selectorized, independent/iso-lateral arms, a distinctive pressing angle for a named brand's machine), or null if there's nothing beyond the other fields.",
      },
    },
    required: ["name", "category", "primaryMuscles", "secondaryMuscles", "equipment", "instructions", "techniqueTips", "commonMistakes", "notes"],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = `You research a gym exercise and produce structured exercise-library data for it, given its name and optional equipment/machine name and brand.

Rules:
- Use real, accurate exercise-science knowledge for muscle targeting, category, and instructions — reflect the actual movement, not a surface-level guess from the name alone.
- If an equipment/machine name and/or brand is given, use it to identify the specific equipment and movement pattern precisely — named brands often have a distinctive pressing angle, grip, or plate-loaded-vs-selectorized design that changes what's worth noting — and fold it into the standardized name if that's how the movement is normally referred to.
- primaryMuscles/secondaryMuscles: only include muscles the exercise actually, meaningfully works.
- Always call record_exercise_details exactly once with your best research. Never respond with plain text, and never ask a clarifying question — make the best call from what's given.`;

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
    const { name, equipmentName, brand } = await req.json();
    if (typeof name !== "string" || !name.trim()) {
      return new Response(JSON.stringify({ error: "Missing exercise name." }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    if (name.length > 200 || (typeof equipmentName === "string" && equipmentName.length > 200) || (typeof brand === "string" && brand.length > 200)) {
      return new Response(JSON.stringify({ error: "Input is too long (200 character limit per field)." }), {
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

    const promptLines = [`Exercise name: ${name.trim()}`];
    if (typeof equipmentName === "string" && equipmentName.trim()) promptLines.push(`Equipment/machine name: ${equipmentName.trim()}`);
    if (typeof brand === "string" && brand.trim()) promptLines.push(`Brand: ${brand.trim()}`);

    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 4000,
      output_config: { effort: "low" },
      system: SYSTEM_PROMPT,
      tools: [EXERCISE_DETAILS_TOOL],
      tool_choice: { type: "auto" },
      messages: [
        {
          role: "user",
          content: `Research this exercise and call record_exercise_details with the result:\n\n${promptLines.join("\n")}`,
        },
      ],
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === "record_exercise_details",
    );

    if (!toolUse) {
      return new Response(
        JSON.stringify({ error: "Could not research this exercise. Try a more specific name." }),
        { status: 422, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ exercise: toolUse.input }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-exercise-details error:", err);
    const message = err instanceof Anthropic.APIError ? err.message : "Unexpected error researching this exercise.";
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
