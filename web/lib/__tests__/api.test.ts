import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

let api: (typeof import("@/lib/api"))["api"];
let ApiError: (typeof import("@/lib/api"))["ApiError"];

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
  const mod = await import("@/lib/api");
  api = mod.api;
  ApiError = mod.ApiError;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildUrl (tested via apiFetch)", () => {
  it("uses relative path on the client side (window defined)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 1 }),
    });

    await api.auth.me();

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/auth/me",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("uses API_URL on the server side (window undefined)", async () => {
    const origWindow = globalThis.window;
    // @ts-expect-error - simulating server environment
    delete globalThis.window;
    process.env.API_URL = "http://backend:8000";

    vi.resetModules();
    vi.stubGlobal("fetch", mockFetch);
    const mod = await import("@/lib/api");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 1 }),
    });

    await mod.api.auth.me();

    expect(mockFetch).toHaveBeenCalledWith(
      "http://backend:8000/api/auth/me",
      expect.objectContaining({ credentials: "include" }),
    );

    globalThis.window = origWindow;
    delete process.env.API_URL;
  });
});

describe("apiFetch", () => {
  it("returns parsed JSON on success", async () => {
    const data = { id: 1, email: "a@b.com", display_name: "A" };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(data),
    });

    const result = await api.auth.me();
    expect(result).toEqual(data);
  });

  it("returns undefined for 204 responses", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: () => Promise.resolve(null),
    });

    const result = await api.leagues.delete(1);
    expect(result).toBeUndefined();
  });

  it("throws ApiError on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: () => Promise.resolve({ detail: "Not authenticated" }),
    });

    await expect(api.auth.me()).rejects.toThrow("Not authenticated");
    try {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: () => Promise.resolve({ detail: "Not authenticated" }),
      });
      await api.auth.me();
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(401);
    }
  });

  it("falls back to statusText when JSON parse fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.reject(new Error("bad json")),
    });

    await expect(api.auth.me()).rejects.toThrow("Internal Server Error");
  });

  it("forwards cookie header when provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({ id: 1, email: "a@b.com", display_name: null }),
    });

    await api.auth.me("session=abc123");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Cookie: "session=abc123" }),
      }),
    );
  });

  it("sets Content-Type to application/json", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({ id: 1, email: "a@b.com", display_name: null }),
    });

    await api.auth.me();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
  });
});
