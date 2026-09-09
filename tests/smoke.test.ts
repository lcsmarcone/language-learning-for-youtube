import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("fundação do projeto", () => {
  it("mantém o mecanismo de retomada versionado", () => {
    expect(readFileSync("PROGRESS.md", "utf8")).toContain("Etapa 0");
    expect(readFileSync("CLAUDE.md", "utf8")).toContain("PROGRESS.md");
  });

  it("não versiona segredos no template de ambiente", () => {
    const env = readFileSync(".env.example", "utf8");
    expect(env).toContain("ANTHROPIC_API_KEY");
    expect(env).toMatch(/ANTHROPIC_API_KEY=""/);
  });
});
