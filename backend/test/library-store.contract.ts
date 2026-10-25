import assert from "node:assert/strict";
import { test } from "node:test";

import type { LibraryStore } from "../src/ports/library-store.js";

export function defineLibraryStoreContract(engine: string, openStore: () => Promise<LibraryStore>): void {
  async function withStore(run: (store: LibraryStore) => Promise<void>): Promise<void> {
    const store = await openStore();

    try {
      await run(store);
    } finally {
      await store.close();
    }
  }

  async function assignTagType(store: LibraryStore, tagName: string, typeName: string): Promise<void> {
    const tag = await store.findTagByName(tagName);
    const type = (await store.listTagTypes()).find((item) => item.name === typeName);

    if (tag === null || type === undefined) {
      throw new Error(`Unable to assign ${tagName} to ${typeName}`);
    }

    await store.updateTag(tag.id, tag.name, type.id);
  }

  test(`${engine}: videos can be upserted without creating duplicates`, async () => {
    await withStore(async (store) => {
      const first = await store.upsertVideo("salsa/first.mp4");
      const second = await store.upsertVideo("salsa/first.mp4");

      assert.deepEqual(first, second);
      assert.deepEqual(await store.listVideos(), [{ id: "salsa/first.mp4", recordedAt: null }]);
    });
  });

  test(`${engine}: tags keep their original names and reject exact duplicates`, async () => {
    await withStore(async (store) => {
      const salsa = await store.upsertTag("salsa");
      const sameSalsa = await store.upsertTag("salsa");
      const capitalized = await store.upsertTag("Salsa");

      assert.strictEqual(salsa.id, sameSalsa.id);
      assert.notEqual(capitalized.id, salsa.id);
      assert.deepEqual(
        (await store.listTags()).map((tag) => tag.name),
        ["Salsa", "salsa"],
      );
    });
  });

  test(`${engine}: video tags are listed by type then name`, async () => {
    await withStore(async (store) => {
      await store.upsertVideo("salsa/first.mp4");
      await store.setVideoTags("salsa/first.mp4", ["isa", "bufanda", "salsa", "linea"]);
      await assignTagType(store, "salsa", "type");
      await assignTagType(store, "linea", "style");
      await assignTagType(store, "isa", "teacher");

      assert.deepEqual(await store.getVideoTags("salsa/first.mp4"), ["salsa", "linea", "isa", "bufanda"]);
    });
  });

  test(`${engine}: setVideoTags rolls back when a later tag is invalid`, async () => {
    await withStore(async (store) => {
      await store.upsertVideo("salsa/first.mp4");
      await store.setVideoTags("salsa/first.mp4", ["salsa", "isa"]);

      await assert.rejects(async () => store.setVideoTags("salsa/first.mp4", ["jota", ""]), /Tag name must not be empty/);
      assert.deepEqual(await store.getVideoTags("salsa/first.mp4"), ["isa", "salsa"]);
      assert.equal(await store.findTagByName("jota"), null);
    });
  });

  test(`${engine}: recorded_at is kept on duplicate upsert`, async () => {
    await withStore(async (store) => {
      const created = await store.upsertVideo("clip.mp4", "2026-03-14T19:04:31.123Z");
      const duplicate = await store.upsertVideo("clip.mp4", "2020-01-01T00:00:00.000Z");

      assert.equal(created.recordedAt, "2026-03-14T19:04:31.123Z");
      assert.equal(duplicate.recordedAt, "2026-03-14T19:04:31.123Z");
    });
  });

  test(`${engine}: new tags use the default resource type`, async () => {
    await withStore(async (store) => {
      const salsa = await store.upsertTag("salsa");
      const resource = await store.findDefaultTagType();

      assert.equal(resource?.name, "resource");
      assert.equal(salsa.typeName, "resource");
    });
  });

  test(`${engine}: default and in-use tag types cannot be deleted`, async () => {
    await withStore(async (store) => {
      const resource = await store.findDefaultTagType();
      const teacher = (await store.listTagTypes()).find((type) => type.name === "teacher");

      assert.notEqual(resource, null);
      assert.notEqual(teacher, undefined);
      await store.upsertTag("jota");
      await store.updateTag((await store.findTagByName("jota"))!.id, "jota", teacher!.id);

      await assert.rejects(async () => store.deleteTagType(resource!.id), /Default tag type cannot be deleted/);
      await assert.rejects(async () => store.deleteTagType(teacher!.id), /Tag type is in use: teacher/);
    });
  });
}
