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

test("runProcess forwards stdout chunks while the process is running", async () => {
  const directory = await mkdtemp(join(tmpdir(), "media-library-run-process-stdout-"));
  const scriptPath = join(directory, "write-progress.js");
  const chunks: string[] = [];

  try {
    await writeFile(
      scriptPath,
      "process.stdout.write('out_time_us=1000000\\n'); process.stdout.write('out_time_us=2000000\\n');",
    );

    const result = await runProcess(process.execPath, [scriptPath], {
      onStdout: (chunk) => chunks.push(chunk),
    });

    assert.equal(result.exitCode, 0);
    assert.equal(chunks.join(""), "out_time_us=1000000\nout_time_us=2000000\n");
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
