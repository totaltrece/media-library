import { describe, expect, it } from "vitest";

import { applyUntaggedFilter, countUntaggedVideos } from "../src/utils/admin-videos.js";
import type { SearchResultItem } from "../src/api/types.js";

const videos: SearchResultItem[] = [
  {
    id: "untagged-a.mp4",
    name: "20260801_untagged.mp4",
    thumbnail: "/api/thumbnail/untagged-a.mp4",
    video: "/api/video/untagged-a.mp4",
    tags: [],
    recordedAt: null,
  },
  {
    id: "salsa/first.mp4",
    name: "first.mp4",
    thumbnail: "/api/thumbnail/salsa/first.mp4",
    video: "/api/video/salsa/first.mp4",
    tags: ["salsa", "isa"],
    recordedAt: null,
  },
  {
    id: "untagged-b.mp4",
    name: "20260815_new.mp4",
    thumbnail: "/api/thumbnail/untagged-b.mp4",
    video: "/api/video/untagged-b.mp4",
    tags: [],
    recordedAt: null,
  },
];

describe("applyUntaggedFilter", () => {
  it("returns every video when the untagged filter is off", () => {
    expect(applyUntaggedFilter(videos, false)).toEqual(videos);
  });

  it("keeps only videos whose tag list is empty", () => {
    expect(applyUntaggedFilter(videos, true).map((video) => video.id)).toEqual([
      "untagged-a.mp4",
      "untagged-b.mp4",
    ]);
  });
});

describe("countUntaggedVideos", () => {
  it("counts videos whose tag list is empty", () => {
    expect(countUntaggedVideos(videos)).toBe(2);
  });
});
