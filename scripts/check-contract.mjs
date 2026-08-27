import { readFile } from "node:fs/promises";

const REQUIRED_PREFIX = "/api/v1";
const source = JSON.parse(await readFile(new URL("../openapi.json", import.meta.url), "utf8"));
const paths = Object.keys(source.paths ?? {});

if (!paths.length || paths.some((path) => !path.startsWith(REQUIRED_PREFIX))) {
  console.error("AC-T6-OPENAPI-PREFIX: OpenAPI paths must stay under /api/v1");
  process.exit(1);
}

const generated = await readFile(
  new URL("../src/api/generated/schema.d.ts", import.meta.url),
  "utf8",
);
if (!generated.includes("export interface paths")) {
  console.error("AC-T6-OPENAPI-PREFIX: generated TypeScript contract is missing");
  process.exit(1);
}

console.log(`contract ok: ${paths.length} paths under ${REQUIRED_PREFIX}`);
