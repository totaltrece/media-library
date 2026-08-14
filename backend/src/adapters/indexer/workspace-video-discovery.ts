import { discoverVideoPaths } from "@media-library/indexer";

import type { VideoDiscovery } from "../../ports/video-discovery.js";

export class WorkspaceVideoDiscovery implements VideoDiscovery {
  constructor(private readonly libraryPath: string) {}

  async discoverVideoPaths(): Promise<string[]> {
    return discoverVideoPaths(this.libraryPath);
  }
}
