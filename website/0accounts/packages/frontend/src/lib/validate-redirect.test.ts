// ============================================
// TESTS: validate-redirect
//
// These tests are what stops a regression from re-opening the open-redirect
// token-exfiltration vulnerability. If any assertion here starts failing
// after a code change in validate-redirect.ts, stop and read the test
// name before "fixing" the test.
// ============================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateRedirectUrl } from "./validate-redirect";

// import.meta.env.DEV is read once per call. Tests set this via vi.stubEnv.
beforeEach(() => {
  vi.unstubAllEnvs();
});

describe("validateRedirectUrl — allowlisted zeros.design", () => {
  beforeEach(() => {
    vi.stubEnv("DEV", false);
  });

  it("accepts https://zeros.design", () => {
    expect(validateRedirectUrl("https://zeros.design/")).toMatch(
      /^https:\/\/zeros\.design\//,
    );
  });

  it("accepts https://0colors.zeros.design with path + query", () => {
    const result = validateRedirectUrl(
      "https://0colors.zeros.design/projects?highlight=1",
    );
    expect(result).toBe("https://0colors.zeros.design/projects?highlight=1");
  });

  it("accepts https://accounts.zeros.design", () => {
    expect(validateRedirectUrl("https://accounts.zeros.design/")).toBeTruthy();
  });

  it("strips an existing hash from the allowed URL", () => {
    const result = validateRedirectUrl(
      "https://0colors.zeros.design/#stale-access-token=abc",
    );
    expect(result).toBe("https://0colors.zeros.design/");
    expect(result).not.toContain("#");
  });

  it("accepts a URL-encoded value", () => {
    const encoded = encodeURIComponent("https://0colors.zeros.design/path");
    expect(validateRedirectUrl(encoded)).toBe(
      "https://0colors.zeros.design/path",
    );
  });
});

describe("validateRedirectUrl — rejects attacker URLs", () => {
  beforeEach(() => {
    vi.stubEnv("DEV", false);
  });

  it("rejects a completely unrelated domain", () => {
    expect(validateRedirectUrl("https://evil.com/")).toBeNull();
  });

  it("rejects a subdomain lookalike (zeros.design.evil.com)", () => {
    expect(
      validateRedirectUrl("https://accounts.zeros.design.evil.com/"),
    ).toBeNull();
  });

  it("rejects a prefix lookalike (evilzeros.design)", () => {
    expect(validateRedirectUrl("https://evilzeros.design/")).toBeNull();
  });

  it("rejects javascript:", () => {
    expect(validateRedirectUrl("javascript:alert(1)")).toBeNull();
  });

  it("rejects data:", () => {
    expect(validateRedirectUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("rejects file:", () => {
    expect(validateRedirectUrl("file:///etc/passwd")).toBeNull();
  });

  it("rejects a protocol-relative URL", () => {
    expect(validateRedirectUrl("//evil.com/path")).toBeNull();
  });

  it("rejects a URL with userinfo", () => {
    expect(
      validateRedirectUrl(
        "https://attacker:pass@0colors.zeros.design/",
      ),
    ).toBeNull();
  });

  it("rejects http:// in production", () => {
    expect(validateRedirectUrl("http://0colors.zeros.design/")).toBeNull();
  });

  it("rejects a non-default port on a zeros.design domain in production", () => {
    expect(
      validateRedirectUrl("https://0colors.zeros.design:8443/"),
    ).toBeNull();
  });

  it("rejects garbage that isn't a URL", () => {
    expect(validateRedirectUrl("not a url")).toBeNull();
  });

  it("rejects null and empty input", () => {
    expect(validateRedirectUrl(null)).toBeNull();
    expect(validateRedirectUrl("")).toBeNull();
    expect(validateRedirectUrl(undefined)).toBeNull();
  });

  it("rejects a malformed URL-encoded string", () => {
    expect(validateRedirectUrl("%")).toBeNull();
  });
});

describe("validateRedirectUrl — localhost (dev only)", () => {
  it("allows http://localhost:3000 in dev", () => {
    vi.stubEnv("DEV", true);
    expect(validateRedirectUrl("http://localhost:3000/projects")).toBe(
      "http://localhost:3000/projects",
    );
  });

  it("allows http://127.0.0.1:5173 in dev", () => {
    vi.stubEnv("DEV", true);
    expect(validateRedirectUrl("http://127.0.0.1:5173/")).toBe(
      "http://127.0.0.1:5173/",
    );
  });

  it("rejects localhost in production builds", () => {
    vi.stubEnv("DEV", false);
    expect(validateRedirectUrl("http://localhost:3000/")).toBeNull();
  });
});
