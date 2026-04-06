import { parseBuffer } from "music-metadata";

export interface TrackMetadata {
  artist: string;
  title: string;
  album: string | null;
}

/**
 * extract artist, title, and album tags from an audio buffer.
 * returns null if the artist or title tags are absent — both are required to scrobble.
 */
export async function extractTrackMetadata(
  buffer: Buffer,
  mimeType?: string
): Promise<TrackMetadata | null> {
  let parsedMetadata;
  try {
    parsedMetadata = await parseBuffer(buffer, { mimeType });
  } catch (error) {
    console.warn(`music-metadata failed to parse buffer — ${error}`);
    return null;
  }

  const { common } = parsedMetadata;
  const artist = common.artist;
  const title = common.title;

  if (!artist || !title) {
    return null;
  }

  return {
    artist,
    title,
    album: common.album ?? null,
  };
}
