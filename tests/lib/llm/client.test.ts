import { z } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LLMError,
  LLMHttpError,
  generateStructured,
  llmErrorResponse,
} from "@/lib/llm/client";

const schema = z.object({ a: z.number() });
const call = () => generateStructured({ system: "s", user: "u", schema });

const completion = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
  });
const ok = () => completion('{"a":1}');
const httpError = (status: number) =>
  new Response(JSON.stringify({ error: { message: "overloaded" } }), { status });

/** Stubs fetch to return each response in turn (the last one repeats). */
function mockFetch(...responses: Array<() => Response | Promise<Response>>) {
  const fetchMock = vi.fn(async () => {
    const next = responses[Math.min(fetchMock.mock.calls.length - 1, responses.length - 1)];
    return next();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Runs `promise` to completion, advancing fake timers through any backoff. */
async function settle<T>(promise: Promise<T>) {
  const outcome = promise.then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  await vi.runAllTimersAsync();
  return outcome;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("transient provider failures", () => {
  it.each([429, 500, 502, 503, 504, 529])("retries HTTP %i and recovers", async (status) => {
    const fetchMock = mockFetch(() => httpError(status), ok);
    expect(await settle(call())).toEqual({ value: { a: 1 } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("recovers on the last allowed attempt (503, 503, ok)", async () => {
    const fetchMock = mockFetch(() => httpError(503), () => httpError(503), ok);
    expect(await settle(call())).toEqual({ value: { a: 1 } });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("gives up after 3 attempts and surfaces the provider error", async () => {
    const fetchMock = mockFetch(() => httpError(503));
    const result = await settle(call());
    expect(result).toMatchObject({ error: expect.any(LLMHttpError) });
    expect((result as { error: LLMHttpError }).error.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("retries a network failure (fetch rejects with TypeError)", async () => {
    const fetchMock = mockFetch(() => {
      throw new TypeError("fetch failed");
    }, ok);
    expect(await settle(call())).toEqual({ value: { a: 1 } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries an HTTP 200 whose body carries a provider error", async () => {
    const fetchMock = mockFetch(
      () => new Response(JSON.stringify({ error: { code: 503, message: "down" } })),
      ok,
    );
    expect(await settle(call())).toEqual({ value: { a: 1 } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("waits 1.5s then 3s between attempts", async () => {
    const fetchMock = mockFetch(() => httpError(503), () => httpError(503), ok);
    const outcome = call();

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_499);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(2_999);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    expect(await outcome).toEqual({ a: 1 });
  });
});

describe("failures that are not retried", () => {
  it.each([400, 401, 403, 404])("does not retry HTTP %i", async (status) => {
    const fetchMock = mockFetch(() => httpError(status));
    const result = await settle(call());
    expect((result as { error: LLMHttpError }).error.status).toBe(status);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry a timeout", async () => {
    const fetchMock = mockFetch(() => {
      throw new DOMException("timed out", "TimeoutError");
    });
    const result = await settle(call());
    expect(result).toMatchObject({ error: expect.any(DOMException) });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails without calling the provider when the API key is missing", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const fetchMock = mockFetch(ok);
    const result = await settle(call());
    expect((result as { error: LLMHttpError }).error.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("invalid model output", () => {
  it("re-asks once with the validation error, then returns valid output", async () => {
    const fetchMock = mockFetch(() => completion('{"a":"nope"}'), ok);
    expect(await settle(call())).toEqual({ value: { a: 1 } });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const secondBody = JSON.parse(
      (fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body as string,
    );
    const last = secondBody.messages.at(-1);
    expect(last.role).toBe("user");
    expect(last.content).toContain("That response was invalid");
  });

  it("throws an LLMError after two invalid responses", async () => {
    const fetchMock = mockFetch(() => completion("not json"));
    const result = await settle(call());
    const error = (result as { error: Error }).error;
    expect(error).toBeInstanceOf(LLMError);
    expect(error.message).toContain("failed validation");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("accepts JSON wrapped in a markdown fence", async () => {
    mockFetch(() => completion('```json\n{"a":1}\n```'));
    expect(await settle(call())).toEqual({ value: { a: 1 } });
  });

  it("treats an empty completion as an error", async () => {
    mockFetch(() => completion("   "));
    const result = await settle(call());
    expect((result as { error: Error }).error).toBeInstanceOf(LLMError);
  });
});

describe("llmErrorResponse", () => {
  it.each([
    [new LLMHttpError(429, "x"), 429],
    [new LLMHttpError(401, "x"), 500],
    [new LLMHttpError(403, "x"), 500],
    [new LLMHttpError(503, "x"), 502],
    [new DOMException("t", "TimeoutError"), 504],
    [new LLMError("bad output"), 502],
    [new Error("boom"), 502],
  ])("maps %s to HTTP %i", async (error, status) => {
    const response = llmErrorResponse(error);
    expect(response.status).toBe(status);
    // Never leaks the underlying error message to the client.
    expect(JSON.stringify(await response.json())).not.toMatch(/boom|bad output|"x"/);
  });
});

describe("request options", () => {
  it("asks for a JSON schema from providers that keep no data, and sends no temperature", async () => {
    const fetchMock = mockFetch(ok);
    await settle(call());
    const body = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    );
    expect(body.response_format).toMatchObject({
      type: "json_schema",
      json_schema: { strict: true },
    });
    expect(body.provider).toEqual({ require_parameters: true, data_collection: "deny" });
    // temperature + require_parameters finds no endpoint for some models (404).
    expect(body).not.toHaveProperty("temperature");
  });
});

describe("model selection", () => {
  const sentModel = (fetchMock: ReturnType<typeof mockFetch>) =>
    JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string).model;

  it("uses the configured model by default, and another one only when asked", async () => {
    const { MODEL } = await import("@/lib/llm/client");
    let fetchMock = mockFetch(ok);
    await settle(call());
    expect(sentModel(fetchMock)).toBe(MODEL);

    fetchMock = mockFetch(ok);
    await settle(generateStructured({ system: "s", user: "u", schema, model: "judge/model" }));
    expect(sentModel(fetchMock)).toBe("judge/model");
  });
});
