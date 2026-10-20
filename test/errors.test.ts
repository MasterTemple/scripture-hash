import { LogoxideErrorException, ToposErrorException } from "logoxide";
import { describe, expect, it } from "vitest";
import { describeError } from "@/bible/errors";

describe("describeError", () => {
  it("reads what logoxide's and topos's errors say, not their class", () => {
    expect(describeError(new LogoxideErrorException({ tag: "NotFound", message: "no such book" }))).toBe("no such book");
    expect(describeError(new ToposErrorException({ tag: "InvalidQuery", message: "bad query" }))).toBe("bad query");
  });

  it("falls back to an Error's message, then to the value", () => {
    expect(describeError(new Error("Download failed"))).toBe("Download failed");
    expect(describeError({ value: null })).toBe("[object Object]");
    expect(describeError("plain")).toBe("plain");
  });
});
