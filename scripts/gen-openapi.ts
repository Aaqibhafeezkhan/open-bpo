import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildDemoApp } from "../apps/api/src/demo";

const repoRoot = path.resolve(process.cwd(), "..", "..");
const outputPath = path.join(repoRoot, "docs", "openapi.json");

async function main(): Promise<void> {
  const app = await buildDemoApp({ env: { NODE_ENV: "test" } });
  try {
    await app.ready();
    const document = app.swagger();
    document.info.title = "open-bpo API";
    const sessionsPath = document.paths?.["/v1/sessions"] ?? {};
    sessionsPath.post = {
      summary: "Queue a call session",
      security: [{ bearerAuth: [] }],
      responses: { "202": { description: "Session queued" } }
    };
    if (document.paths) document.paths["/v1/sessions"] = sessionsPath;
    if (document.paths) {
      document.paths["/v1/webhooks/call-ended"] = {
        post: {
          summary: "Ingest a completed call for QA",
          security: [{ bearerAuth: [] }],
          responses: { "202": { description: "Call queued for QA" } }
        }
      };
    }
    const generated = `${JSON.stringify(document, null, 2)}\n`;
    if (process.argv.includes("--check")) {
      const existing = await readFile(outputPath, "utf8").catch(() => "");
      if (existing !== generated) {
        throw new Error("docs/openapi.json is out of date; run pnpm openapi");
      }
    } else {
      await writeFile(outputPath, generated, "utf8");
    }
  } finally {
    await app.close();
  }
}

void main();
