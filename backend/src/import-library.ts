import { config } from "./config.js";
import { WorkspaceLibraryIndexer } from "./adapters/indexer/workspace-library-indexer.js";
import { openSqliteLibraryStore } from "./adapters/sqlite/sqlite-library-store.js";
import { ImportLibraryUseCase } from "./application/import-library.js";

async function main(): Promise<void> {
  const libraryStore = openSqliteLibraryStore(config.sqlitePath);

  try {
    const result = await new ImportLibraryUseCase(
      new WorkspaceLibraryIndexer(config.libraryPath),
      libraryStore,
      config.libraryPath,
    ).execute();

    const videos = libraryStore.listVideosWithTags();
    const relationCount = videos.reduce((count, video) => count + video.tags.length, 0);

    console.log(`Library: ${config.libraryPath}`);
    console.log(`SQLite:  ${config.sqlitePath}`);
    console.log("");
    console.log(`Videos discovered:     ${result.discovered}`);
    console.log(`Videos imported:       ${result.imported}`);
    console.log(`Videos without metadata: ${result.withoutMetadata}`);
    console.log(`Videos without tags:   ${result.withoutTags}`);
    console.log(`Tags created:          ${result.tagsCreated}`);
    console.log(`Import errors:         ${result.errors.length}`);
    console.log("");
    console.log(`SQLite videos:     ${videos.length}`);
    console.log(`SQLite tags:       ${libraryStore.listTags().length}`);
    console.log(`SQLite relations:  ${relationCount}`);

    if (videos.length > 0) {
      console.log("");
      console.log("Sample videos:");

      for (const video of videos.slice(0, 10)) {
        const tags = video.tags.length > 0 ? video.tags.join(", ") : "(none)";
        console.log(`- ${video.id}: ${tags}`);
      }
    }

    if (result.errors.length > 0) {
      console.log("");
      console.log("Errors:");

      for (const error of result.errors) {
        console.log(`- ${error.videoId}: ${error.message}`);
      }

      process.exitCode = 1;
    }
  } finally {
    libraryStore.close();
  }
}

void main();
