import { describe, expect, it } from "vitest";
import { ApiError } from "./error";
import { assertApiResponseContract, resolveApiBaseUrl } from "./http-client";

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
