import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";

const execFileAsync = promisify(execFile);

/** minimum buffer size — anything smaller is likely an error page or corrupt audio */
const MIN_AUDIO_BYTES = 10 * 1024;

/**
 * download the best available audio for a given artist + track using yt-dlp.
 * searches YouTube via ytsearch1 and writes to a temp file to avoid pipe reliability issues.
 * returns the raw audio buffer on success, or null if download fails or yields unusable data.
 */
export async function downloadTrack(artist: string, track: string): Promise<Buffer | null> {
  const searchQuery = `ytsearch1:${artist} - ${track}`;
  const tempPath = join(tmpdir(), `tg-scrobbler-${randomUUID()}.m4a`);

  const args = [
    "-f", "bestaudio[ext=m4a]/bestaudio",
    "--no-playlist",
    "-o", tempPath,
    searchQuery,
  ];

  try {
    await execFileAsync("yt-dlp", args, { timeout: 60000 });

    let audioBuffer: Buffer;
    try {
      audioBuffer = await readFile(tempPath);
    } catch (readError) {
      console.warn(`yt-dlp: temp file missing after download for "${artist} - ${track}"`, readError);
      return null;
    }

    if (audioBuffer.length < MIN_AUDIO_BYTES) {
      console.warn(
        `yt-dlp: audio too small (${audioBuffer.length} bytes) for "${artist} - ${track}" — skipping`
      );
      return null;
    }

    return audioBuffer;
  } catch (error) {
    console.warn(`yt-dlp: download failed for "${artist} - ${track}"`, error);
    return null;
  } finally {
    /** clean up temp file regardless of outcome — unlink is best-effort */
    await unlink(tempPath).catch(() => undefined);
  }
}
