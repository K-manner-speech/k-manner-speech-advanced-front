import { readFile } from "node:fs/promises";

const REQUIRED_PREFIX = "/api/v1";
const REQUIRED_VOICE_PATH = "/api/v1/rooms/{room_id}/voice-messages";
const source = JSON.parse(await readFile(new URL("../openapi.json", import.meta.url), "utf8"));
const paths = Object.keys(source.paths ?? {});

if (!paths.length || paths.some((path) => !path.startsWith(REQUIRED_PREFIX))) {
  console.error("AC-T6-OPENAPI-PREFIX: OpenAPI paths must stay under /api/v1");
  process.exit(1);
}

if (!paths.includes(REQUIRED_VOICE_PATH)) {
  console.error(`AC-T6-VOICE-CONTRACT: OpenAPI is missing ${REQUIRED_VOICE_PATH}`);
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

if (!generated.includes(`\"${REQUIRED_VOICE_PATH}\"`)) {
  console.error("AC-T6-VOICE-CONTRACT: generated TypeScript contract is missing the voice upload path");
  process.exit(1);
}

console.log(`contract ok: ${paths.length} paths under ${REQUIRED_PREFIX}`);
