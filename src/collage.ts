/** default import — sharp does not expose named exports */
import sharp from "sharp";

/** one slot in the composite array passed to sharp */
interface CompositeEntry {
  input: Buffer;
  left: number;
  top: number;
}

/**
 * attempt to download a single image URL and return it as a Buffer.
 * returns null when the URL is absent or the request fails.
 */
async function downloadImage(url: string | null, index: number): Promise<Buffer | null> {
  if (url === null) {
    return null;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`image download failed for slot ${index} — HTTP ${response.status}: ${url}`);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.warn(`image download threw for slot ${index} — ${String(error)}: ${url}`);
    return null;
  }
}

/**
 * compose up to 9 album art images into a 900×900 PNG collage (3×3 grid).
 * failed or missing images leave the corresponding 300×300 cell black.
 */
export async function createCollageImage(imageUrls: (string | null)[]): Promise<Buffer> {
  const slots = imageUrls.slice(0, 9);

  const downloadResults = await Promise.all(
    slots.map((url, index) => downloadImage(url, index))
  );

  const composites: CompositeEntry[] = [];

  for (let index = 0; index < downloadResults.length; index++) {
    const imageBuffer = downloadResults[index];
    if (imageBuffer === null) {
      continue;
    }

    const resized = await sharp(imageBuffer).resize(300, 300).toBuffer();

    composites.push({
      input: resized,
      left: (index % 3) * 300,
      top: Math.floor(index / 3) * 300,
    });
  }

  const canvas = sharp({
    create: {
      width: 900,
      height: 900,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  });

  return canvas.composite(composites).png().toBuffer();
}
