import { describe, it, expect } from "vitest";
import { createMemoryBlob } from "./blob";

describe("createMemoryBlob", () => {
  const bytes = (s: string) => new TextEncoder().encode(s);

  it("stores and reads back bytes, with a distinct url per put", async () => {
    const blob = createMemoryBlob();
    const a = await blob.put("shot.png", bytes("A"), "image/png");
    const b = await blob.put("shot.png", bytes("B"), "image/png");
    expect(a.url).not.toBe(b.url); // dedupe-suffix like Vercel
    expect(a.pathname).toBe("shot.png");
    expect(new TextDecoder().decode(await blob.get(a.url))).toBe("A");
    expect(new TextDecoder().decode(await blob.get(b.url))).toBe("B");
  });

  it("throws when getting a url that was never put (or was deleted)", async () => {
    const blob = createMemoryBlob();
    const { url } = await blob.put("x.png", bytes("x"), "image/png");
    await blob.del(url);
    await expect(blob.get(url)).rejects.toThrow(/not found/);
    await expect(blob.get("memory://blob/999/missing.png")).rejects.toThrow();
  });
});
