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

const SET_TARGET_SCHEMA = {
  type: "object",
  properties: {
    targetReps: { type: ["integer", "null"], description: "Target reps for this set, if specified." },
    targetWeightKg: { type: ["number", "null"], description: "Target weight in kilograms. Convert lb to kg (divide by 2.2046) if the notes use pounds." },
    targetDurationSeconds: { type: ["integer", "null"], description: "Target duration in seconds, for timed exercises like planks." },
    targetDistanceMeters: { type: ["number", "null"], description: "Target distance in meters, for cardio exercises." },
  },
  required: ["targetReps", "targetWeightKg", "targetDurationSeconds", "targetDistanceMeters"],
  additionalProperties: false,
};

const EXERCISE_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "The exercise name, cleaned up to standard title case (e.g. 'Barbell Bench Press')." },
    section: { type: "string", enum: ["warmup", "main", "cooldown"], description: "Which part of the routine this exercise belongs to. Default to 'main' unless the notes clearly mark it as a warm-up or cool-down/stretch." },
    category: { type: "string", enum: EXERCISE_CATEGORIES, description: "Best-guess exercise category." },
    primaryMuscles: { type: "array", items: { type: "string", enum: MUSCLE_GROUPS }, description: "Best-guess primary muscle groups worked, most relevant first." },
    equipment: { type: "array", items: { type: "string", enum: EQUIPMENT }, description: "Best-guess equipment used. Use ['none'] for pure bodyweight moves." },
    sets: { type: "array", items: SET_TARGET_SCHEMA, description: "One entry per planned set, in order. If the notes say '3x10' produce three set entries each with targetReps 10." },
    restSeconds: { type: ["integer", "null"], description: "Rest between sets in seconds, if mentioned." },
    notes: { type: ["string", "null"], description: "Any extra instruction for this exercise from the notes (tempo, cues, superset info) that doesn't fit the other fields." },
  },
  required: ["name", "section", "category", "primaryMuscles", "equipment", "sets", "restSeconds", "notes"],
  additionalProperties: false,
};

const ROUTINE_TOOL = {
  name: "record_routine",
  description: "Record a structured workout routine extracted from the user's free-text notes.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "A short name for the routine, e.g. 'Push Day' or 'Full Body A'. Infer one if the notes don't give it a title." },
      description: { type: ["string", "null"], description: "One-sentence summary of the routine, or null if there's nothing worth adding beyond the name." },
      notes: { type: ["string", "null"], description: "General notes about the whole routine that don't belong to a single exercise, or null." },
      exercises: { type: "array", items: EXERCISE_SCHEMA, description: "Every exercise found in the notes, in the order they appear." },
    },
    required: ["name", "description", "notes", "exercises"],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = `You turn a person's free-text workout notes (often messy, shorthand, copy-pasted from a phone notes app) into a structured routine.

Rules:
- Parse set/rep shorthand like "3x10", "4 sets of 8-12", "5x5 @ 60kg" into individual set entries.
- If a rep range is given (e.g. 8-12), use the lower number as targetReps.
- If weight is in pounds (lb/lbs), convert to kilograms.
- If no explicit set count is given for an exercise, produce 3 sets as a reasonable default.
- Classify each exercise into a warmup/main/cooldown section based on context (headings like "Warm-up", "Stretch", "Cool down", or position in the notes). Default to "main".
- Skip pure prose/commentary that isn't naming an exercise.
- Always call the record_routine tool exactly once with your best extraction. Never respond with plain text.`;

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
    const { notes } = await req.json();
    if (typeof notes !== "string" || !notes.trim()) {
      return new Response(JSON.stringify({ error: "Missing 'notes' text to parse." }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    if (notes.length > 20000) {
      return new Response(JSON.stringify({ error: "Notes are too long (20,000 character limit)." }), {
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
      max_tokens: 8000,
      output_config: { effort: "low" },
      system: SYSTEM_PROMPT,
      tools: [ROUTINE_TOOL],
      tool_choice: { type: "auto" },
      messages: [
        {
          role: "user",
          content: `Extract a workout routine from these notes, and call the record_routine tool with the result:\n\n${notes}`,
        },
      ],
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === "record_routine",
    );

    if (!toolUse) {
      return new Response(
        JSON.stringify({ error: "Could not extract a routine from these notes. Try adding more detail (exercise names, sets/reps)." }),
        { status: 422, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ routine: toolUse.input }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("parse-workout error:", err);
    const message = err instanceof Anthropic.APIError ? err.message : "Unexpected error parsing workout notes.";
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
