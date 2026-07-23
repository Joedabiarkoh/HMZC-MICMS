// Requested directly in the offline-sync material: "Photos are
// compressed [before being] stored in IndexedDB." Previously photos were
// stored at whatever resolution the phone's camera captured them at
// (often 3-4000px / several MB each) — fine for one photo, but a
// lifeboat inspection requires 6+ and they all ride along inside the
// certificate's JSON payload (see inspection.types.ts), so uncompressed
// photos multiply both IndexedDB usage and what has to transfer on
// reconnect. Resizes to a max dimension and re-encodes as JPEG at a
// reasonable quality — enough to still clearly show equipment condition
// and nameplate text, not so much that a full inspection's worth of
// photos becomes tens of megabytes.

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.75;

export function compressImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            if (width >= height) {
              height = Math.round((height * MAX_DIMENSION) / width);
              width = MAX_DIMENSION;
            } else {
              width = Math.round((width * MAX_DIMENSION) / height);
              height = MAX_DIMENSION;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(reader.result as string); // fall back to the uncompressed original
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
        } catch {
          resolve(reader.result as string); // compression failed — better to keep the photo than drop it
        }
      };
      img.onerror = () => resolve(reader.result as string);
      img.src = reader.result as string;
    };
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

export async function compressImages(files: FileList | File[]): Promise<string[]> {
  return Promise.all(Array.from(files).map(compressImage));
}
