// Tests must never reach a real Redis (or depend on what is exported in the
// developer's shell): start every test file without these variables. The tests
// that need them set them with vi.stubEnv.
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.RATE_LIMIT_SALT;
