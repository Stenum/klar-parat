import request from "supertest";
import { describe, expect, it } from "vitest";
import { createServer } from "./server";

const app = createServer();

describe("server", () => {
  it("returns OK for health check", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.text).toBe("OK");
  });

  it("returns canned message from fake LLM", async () => {
    const response = await request(app).post("/api/dev/fake-llm");
    expect(response.status).toBe(200);
    expect(response.body.content).toContain("Way to go");
  });

  it("returns fake TTS audio", async () => {
    const response = await request(app).get("/api/dev/fake-tts");
    expect(response.status).toBe(200);
    expect(response.header["content-type"]).toMatch(/audio\/mpeg/);
    expect(Buffer.isBuffer(response.body)).toBe(true);
    expect((response.body as Buffer).length).toBeGreaterThan(0);
  });
});
