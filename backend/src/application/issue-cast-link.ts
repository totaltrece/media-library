import { encodeMediaIdPath, createCastAccessToken } from "./cast-access-token.js";
import { isDefaultReceiverCompatible } from "./cast-receiver-compatibility.js";
import { fileNameFromMediaId } from "./content-disposition.js";
import type { StreamVideoUseCase } from "./stream-video.js";

export interface CastLink {
  streamPath: string;
  contentType: string;
  expiresAt: string;
  title: string;
  receiverCompatible: boolean;
}

export class IssueCastLinkUseCase {
  constructor(
    private readonly streamVideoUseCase: StreamVideoUseCase,
    private readonly secret: string,
    private readonly ttlMs: number,
  ) {}

  async execute(mediaId: string, now = new Date()): Promise<CastLink | null> {
    const video = await this.streamVideoUseCase.execute(mediaId);

    if (video === null) {
      return null;
    }

    const access = createCastAccessToken(mediaId, this.secret, now, this.ttlMs);
    const streamPath = `/api/video/${encodeMediaIdPath(mediaId)}?cast=${encodeURIComponent(access.token)}`;

    return {
      streamPath,
      contentType: video.contentType,
      expiresAt: access.expiresAt.toISOString(),
      title: fileNameFromMediaId(mediaId),
      receiverCompatible: isDefaultReceiverCompatible(video.contentType),
    };
  }
}
