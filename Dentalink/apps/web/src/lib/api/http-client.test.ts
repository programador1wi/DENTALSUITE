import { describe, expect, it } from "vitest";
import { ApiError } from "./error";
import { assertApiResponseContract, http, resolveApiBaseUrl, tokenExpiresSoon } from "./http-client";

describe("http credentials", () => {
  it("sends the HttpOnly refresh cookie on cross-origin API calls", () => {
    expect(http.defaults.withCredentials).toBe(true);
  });
});

function tokenWithExpiry(exp: number) {
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${encode({ alg: "none" })}.${encode({ exp })}.signature`;
}

describe("resolveApiBaseUrl", () => {
  it("uses the IPv4 loopback address by default", () => {
    expect(resolveApiBaseUrl(undefined, true)).toBe("http://127.0.0.1:3001/api/v1");
  });

  it("avoids localhost IPv6 ambiguity for the development API", () => {
    expect(resolveApiBaseUrl("http://localhost:3001/api/v1", true)).toBe(
      "http://127.0.0.1:3001/api/v1"
    );
  });

  it("preserves explicitly configured production URLs", () => {
    expect(resolveApiBaseUrl("https://api.example.com/api/v1", false)).toBe(
      "https://api.example.com/api/v1"
    );
  });
});

describe("assertApiResponseContract", () => {
  it("accepts JSON API responses", () => {
    expect(() => assertApiResponseContract([], "application/json; charset=utf-8")).not.toThrow();
  });

  it("rejects HTML returned by a frontend server", () => {
    expect(() =>
      assertApiResponseContract("<!doctype html><html></html>", "text/html")
    ).toThrowError(ApiError);

    try {
      assertApiResponseContract("<!doctype html><html></html>", "text/html");
    } catch (error) {
      expect(error).toMatchObject({ statusCode: 502 });
    }
  });
});

describe("tokenExpiresSoon", () => {
  it("detects expired access tokens before auth/me emits a 401", () => {
    expect(tokenExpiresSoon(tokenWithExpiry(Math.floor(Date.now() / 1000) - 1))).toBe(true);
  });

  it("keeps valid access tokens without an unnecessary refresh", () => {
    expect(tokenExpiresSoon(tokenWithExpiry(Math.floor(Date.now() / 1000) + 300))).toBe(false);
  });
});
