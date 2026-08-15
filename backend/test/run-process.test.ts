import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { runProcess } from "../src/adapters/ffmpeg/run-process.js";

test("runProcess passes arguments with spaces without a shell", async () => {
  const directory = await mkdtemp(join(tmpdir(), "media-library-run-process-"));
  const scriptPath = join(directory, "echo-args.js");

  try {
    await writeFile(
      scriptPath,
      "process.stdout.write(JSON.stringify(process.argv.slice(2)));",
    );

    const result = await runProcess(process.execPath, [scriptPath, "path with spaces.mp4", "a&b|c"]);

    assert.equal(result.exitCode, 0);
    assert.deepEqual(JSON.parse(result.stdout), ["path with spaces.mp4", "a&b|c"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("runProcess reports a missing executable", async () => {
  await assert.rejects(
    () => runProcess("media-library-missing-ffmpeg-binary", ["-version"]),
    /Executable not found: media-library-missing-ffmpeg-binary/,
  );
});
