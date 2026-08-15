export interface VideoDiscovery {
  discoverVideoPaths(): Promise<string[]>;
}
