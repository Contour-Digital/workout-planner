import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EFFORT_LABELS = ["very_light", "light", "moderate", "hard", "very_hard", "maximal"];

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

const SUMMARY_TOOL = {
  name: "record_summary",
  description: "Record the workout recap, perceived-effort estimate, and any forward-looking suggestions.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description:
          "A short (3-5 sentence) natural-language recap of the workout, written in second person ('You...'). Reference exercises actually performed, weave in any achievements and any missed exercises/sets naturally and honestly — don't just cheerlead if sets were missed.",
      },
      perceivedEffort: {
        type: "object",
        properties: {
          score: {
            type: "integer",
            description:
              "Estimated RPE-style perceived effort for the whole session, 1 (very light) to 10 (maximal effort), based on how much was completed, how actuals compared to targets, and any PBs hit.",
          },
          label: { type: "string", enum: EFFORT_LABELS },
          reasoning: { type: "string", description: "One short phrase on why (e.g. 'hit new PBs on 2 lifts and completed every set')." },
        },
        required: ["score", "label", "reasoning"],
        additionalProperties: false,
      },
      tips: {
        type: "array",
        description:
          "1-3 short, general, non-exercise-specific coaching tips for future sessions — pacing, rest periods, recovery, consistency. Leave empty if nothing genuinely stands out; don't pad it.",
        items: { type: "string" },
      },
      exerciseSuggestions: {
        type: "array",
        description:
          "0-2 specific exercises worth adding next time — e.g. a missing warm-up/cooldown, or balancing push/pull volume. Leave empty unless something concrete stands out from the actual data; don't suggest for the sake of it.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Exercise name, cleaned up to standard title case (e.g. 'Face Pull')." },
            section: { type: "string", enum: ["warmup", "main", "cooldown"], description: "Which part of the routine this belongs in." },
            category: { type: "string", enum: EXERCISE_CATEGORIES, description: "Best-guess exercise category." },
            primaryMuscles: { type: "array", items: { type: "string", enum: MUSCLE_GROUPS }, description: "Best-guess primary muscle groups worked, most relevant first." },
            equipment: { type: "array", items: { type: "string", enum: EQUIPMENT }, description: "Best-guess equipment used. Use ['none'] for pure bodyweight moves." },
            reason: { type: "string", description: "One short phrase on why (e.g. 'balances the pushing volume from today')." },
          },
          required: ["name", "section", "category", "primaryMuscles", "equipment", "reason"],
          additionalProperties: false,
        },
      },
    },
    required: ["summary", "perceivedEffort", "tips", "exerciseSuggestions"],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = `You write short, honest post-workout recaps for users of Workout Planner, a workout tracking app. You're given the exact facts of a just-finished session — you never invent numbers or exercises not listed. Be encouraging but truthful: if sets were missed, say so plainly rather than glossing over it. Only offer tips or exercise suggestions when something genuinely stands out from the data (don't pad them out for the sake of it — empty is a fine answer). You are not a medical professional — never give medical advice. Always call record_summary exactly once.`;

interface ExerciseFact {
  name: string;
  setsDone: number;
  setsTotal: number;
  bestSet: string | null;
}

function listOrNone(items: string[]): string {
  return items.length ? items.map((i) => `- ${i}`).join("\n") : "(none)";
}

function buildUserMessage(body: {
  sessionName: string;
  durationMinutes: number;
  exercises: ExerciseFact[];
  missedExercises: { exerciseName: string; missedCount: number; totalCount: number }[];
  achievements: { message: string }[];
}): string {
  const exerciseLines = body.exercises
    .map((e) => `- ${e.name}: ${e.setsDone}/${e.setsTotal} sets completed${e.bestSet ? `, best set ${e.bestSet}` : ""}`)
    .join("\n");
  const missedLines = body.missedExercises.map((m) => `${m.exerciseName} (${m.missedCount} of ${m.totalCount} sets missed)`);
  const achievementLines = body.achievements.map((a) => a.message);

  return `Workout: "${body.sessionName}", ${body.durationMinutes} minutes.

Exercises:
${exerciseLines || "(none)"}

Missed sets/exercises:
${listOrNone(missedLines)}

Achievements (verified — lifted/moved more than last time):
${listOrNone(achievementLines)}

Write the recap, the perceived-effort estimate, and any tips/exercise suggestions that genuinely stand out, then call record_summary.`;
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
    const body = await req.json();

    if (typeof body?.sessionName !== "string" || !Array.isArray(body?.exercises)) {
      return new Response(JSON.stringify({ error: "Missing session data to summarize." }), {
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
      system: SYSTEM_PROMPT,
      tools: [SUMMARY_TOOL],
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content: buildUserMessage(body) }],
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === "record_summary",
    );

    if (!toolUse) {
      return new Response(JSON.stringify({ error: "Could not generate a summary. Try again." }), {
        status: 422,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(toolUse.input), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("workout-summary error:", err);
    const message = err instanceof Anthropic.APIError ? err.message : "Unexpected error generating the workout summary.";
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
