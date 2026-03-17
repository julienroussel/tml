import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedExecSync = vi.fn();
const mockedExistsSync = vi.fn();

vi.mock("node:child_process", () => ({
  default: { execSync: mockedExecSync },
  execSync: mockedExecSync,
}));

vi.mock("node:fs", () => ({
  default: { existsSync: mockedExistsSync },
  existsSync: mockedExistsSync,
}));

// Suppress console.log from main() running at import time
const noop = (): void => undefined;
const logSpy = vi.spyOn(console, "log").mockImplementation(noop);
// Prevent process.exit from killing the test runner
vi.spyOn(process, "exit").mockImplementation(noop as never);

const { generateAll, runGenerator } = await import("./generate-docs");

beforeEach(() => {
  mockedExecSync.mockReset();
  mockedExistsSync.mockReset();
  logSpy.mockClear();
});

describe("runGenerator", () => {
  it("returns failure when script does not exist", () => {
    mockedExistsSync.mockReturnValue(false);

    const result = runGenerator("test", "scripts/missing.ts", "/project");

    expect(result).toEqual({
      name: "test",
      success: false,
      message: "Script not found: scripts/missing.ts",
    });
  });

  it("returns success when execSync succeeds", () => {
    mockedExistsSync.mockReturnValue(true);
    mockedExecSync.mockReturnValue("");

    const result = runGenerator("test", "scripts/ok.ts", "/project");

    expect(result).toEqual({
      name: "test",
      success: true,
      message: "Generated",
    });
    expect(mockedExecSync).toHaveBeenCalledWith(
      "npx tsx /project/scripts/ok.ts",
      { encoding: "utf-8", cwd: "/project", stdio: "pipe" }
    );
  });

  it("returns failure with error message when execSync throws", () => {
    mockedExistsSync.mockReturnValue(true);
    mockedExecSync.mockImplementation(() => {
      throw new Error("exec failed");
    });

    const result = runGenerator("test", "scripts/bad.ts", "/project");

    expect(result).toEqual({
      name: "test",
      success: false,
      message: "exec failed",
    });
  });

  it("returns 'Unknown error' for non-Error throws", () => {
    mockedExistsSync.mockReturnValue(true);
    mockedExecSync.mockImplementation(() => {
      // biome-ignore lint/style/useThrowOnlyError: testing non-Error throw handling
      throw "string error";
    });

    const result = runGenerator("test", "scripts/bad.ts", "/project");

    expect(result).toEqual({
      name: "test",
      success: false,
      message: "Unknown error",
    });
  });
});

describe("generateAll", () => {
  it("runs all generators and returns results", () => {
    mockedExistsSync.mockReturnValue(true);
    mockedExecSync.mockReturnValue("");

    const results = generateAll("/project");

    expect(results).toHaveLength(2);
    expect(results[0]?.name).toBe("llms.txt");
    expect(results[1]?.name).toBe("Route map");
    expect(results.every((r) => r.success)).toBe(true);
  });

  it("includes failures in results without stopping", () => {
    mockedExistsSync.mockReturnValue(true);
    mockedExecSync.mockReturnValueOnce("").mockImplementationOnce(() => {
      throw new Error("route map failed");
    });

    const results = generateAll("/project");

    expect(results).toHaveLength(2);
    expect(results[0]?.success).toBe(true);
    expect(results[1]?.success).toBe(false);
    expect(results[1]?.message).toBe("route map failed");
  });

  it("logs output for each generator", () => {
    mockedExistsSync.mockReturnValue(true);
    mockedExecSync.mockReturnValue("");

    generateAll("/project");

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("[OK] llms.txt")
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("[OK] Route map")
    );
  });
});
