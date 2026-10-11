import { z } from "zod";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/** A free model that supports structured outputs. Override with OPENROUTER_MODEL. */
export const MODEL = process.env.OPENROUTER_MODEL ?? "qwen/qwen3.8-27b:free";

/** Attempts per call; a retry re-sends the previous validation error. */
const MAX_ATTEMPTS = 2;
const REQUEST_TIMEOUT_MS = 90_000;

export class LLMError extends Error {}

/** The provider replied with a non-2xx status. */
export class LLMHttpError extends LLMError {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/** Includes the upstream provider's own message, which OpenRouter nests in metadata. */
function describeError(
  data: { error?: { message?: string; metadata?: { raw?: unknown } } } | null,
  status: number,
): string {
  const raw = data?.error?.metadata?.raw;
  const base = data?.error?.message ?? `OpenRouter returned ${status}`;
  return typeof raw === "string" ? `${base}: ${raw}` : base;
}

async function chat(
  messages: ChatMessage[],
  jsonSchema: unknown,
  maxTokens: number,
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new LLMHttpError(401, "OPENROUTER_API_KEY is not set");

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_tokens: maxTokens,
      response_format: {
        type: "json_schema",
        json_schema: { name: "response", strict: true, schema: jsonSchema },
      },
      // Only route to providers that honor response_format, and that neither
      // store nor train on prompts (learner text is personal data). Do not add
      // `temperature` here: with require_parameters it leaves some models
      // (e.g. anthropic/claude-haiku-5.5) with no endpoint, a 404.
      provider: { require_parameters: true, data_collection: "deny" },
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new LLMHttpError(response.status, describeError(data, response.status));
  }
  // OpenRouter can return HTTP 200 with an error body (e.g. provider failure).
  if (data?.error) {
    throw new LLMHttpError(
      typeof data.error.code === "number" ? data.error.code : 502,
      describeError(data, 502),
    );
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new LLMError(
      `Empty response (finish_reason: ${data?.choices?.[0]?.finish_reason})`,
    );
  }
  return content;
}

/** Extra tries after a transient provider failure, with a growing delay. */
const MAX_TRANSIENT_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 1_500;
const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504, 529]);

function isTransient(error: unknown): boolean {
  if (error instanceof LLMHttpError) return TRANSIENT_STATUSES.has(error.status);
  // fetch rejects with a TypeError on network failure; timeouts are not retried.
  return error instanceof TypeError;
}

/** `chat`, retried on overload / rate limit / network errors (not on timeouts or auth). */
async function chatWithRetry(
  messages: ChatMessage[],
  jsonSchema: unknown,
  maxTokens: number,
): Promise<string> {
  for (let retry = 0; ; retry++) {
    try {
      return await chat(messages, jsonSchema, maxTokens);
    } catch (error) {
      if (retry >= MAX_TRANSIENT_RETRIES || !isTransient(error)) throw error;
      console.warn(
        `[llm] transient failure, retrying (${retry + 1}/${MAX_TRANSIENT_RETRIES}):`,
        error instanceof Error ? error.message : error,
      );
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_BASE_DELAY_MS * 2 ** retry),
      );
    }
  }
}

/** Models sometimes wrap JSON in a markdown fence despite instructions. */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced ? fenced[1] : text).trim();
}

/** One-shot call that returns output validated against `schema`. */
export async function generateStructured<S extends z.ZodType>({
  system,
  user,
  schema,
  maxTokens = 2000,
}: {
  system: string;
  user: string;
  schema: S;
  maxTokens?: number;
}): Promise<z.infer<S>> {
  const jsonSchema = z.toJSONSchema(schema);
  // Belt and braces: not every free model honors response_format.
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${system}\n\nRespond with ONLY a JSON object that matches this JSON Schema, with no other text:\n${JSON.stringify(jsonSchema)}`,
    },
    { role: "user", content: user },
  ];

  let lastProblem = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const text = await chatWithRetry(messages, jsonSchema, maxTokens);

    let problem: string;
    try {
      const result = schema.safeParse(JSON.parse(extractJson(text)));
      if (result.success) return result.data;
      problem = z.prettifyError(result.error);
    } catch {
      problem = "The response was not valid JSON.";
    }

    lastProblem = problem;
    messages.push(
      { role: "assistant", content: text },
      {
        role: "user",
        content: `That response was invalid: ${problem}\nReply again with ONLY the corrected JSON object.`,
      },
    );
  }
  throw new LLMError(`Model output failed validation: ${lastProblem}`);
}

/** Parses and validates a JSON request body; on failure returns a 400. */
export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<
  { ok: true; data: z.infer<S> } | { ok: false; response: Response }
> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return {
      ok: false,
      response: Response.json({ error: "Invalid JSON body" }, { status: 400 }),
    };
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    return {
      ok: false,
      response: Response.json({ error: "Invalid request" }, { status: 400 }),
    };
  }
  return { ok: true, data: result.data };
}

/** Maps an error from an LLM call to a safe response; logs the details. */
export function llmErrorResponse(error: unknown): Response {
  console.error("[llm]", error);

  if (error instanceof LLMHttpError) {
    if (error.status === 429) {
      return Response.json(
        { error: "The free AI model is busy or rate limited. Please try again shortly." },
        { status: 429 },
      );
    }
    if (error.status === 401 || error.status === 403) {
      return Response.json(
        { error: "The AI service is not configured on the server." },
        { status: 500 },
      );
    }
  }
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return Response.json(
      { error: "The AI model took too long to respond. Please try again." },
      { status: 504 },
    );
  }
  return Response.json(
    { error: "The AI service failed to respond. Please try again." },
    { status: 502 },
  );
}
