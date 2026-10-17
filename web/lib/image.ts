/**
 * Client-side image cleaning: redraw on a canvas (strips EXIF/XMP/timestamps
 * and normalizes encoding) and enforce the contract's limits BEFORE sending.
 * The contract re-validates everything; a bypassed client cannot smuggle
 * metadata past it.
 */

import { CONTRACT_LIMITS } from "./config";

export interface CleanedImage {
  bytes: Uint8Array;
  mediaType: "image/png" | "image/jpeg";
  width: number;
  height: number;
}

export async function cleanImage(file: File): Promise<CleanedImage> {
  if (file.size > CONTRACT_LIMITS.imageBytes) {
    throw new Error(
      `Image is ${file.size} bytes; the contract accepts at most ${CONTRACT_LIMITS.imageBytes}.`
    );
  }
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  if (width < 16 || height < 16 || width > 4096 || height > 4096) {
    throw new Error(`Image is ${width}x${height}; each side must be 16–4096 px.`);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable in this browser.");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  // Re-encode: PNG unless the source was JPEG (canvas strips all metadata).
  const wantJpeg = /jpe?g$/i.test(file.type) || /\.jpe?g$/i.test(file.name);
  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, wantJpeg ? "image/jpeg" : "image/png", 0.92)
  );
  if (!blob) throw new Error("Could not re-encode the image.");
  const buf = new Uint8Array(await blob.arrayBuffer());
  if (buf.length > CONTRACT_LIMITS.imageBytes) {
    throw new Error(
      `Re-encoded image is ${buf.length} bytes; the limit is ${CONTRACT_LIMITS.imageBytes}. Shrink it and retry.`
    );
  }
  return {
    bytes: buf,
    mediaType: wantJpeg ? "image/jpeg" : "image/png",
    width,
    height,
  };
}

export function toBytesArg(bytes: Uint8Array): Uint8Array {
  // genlayer-js encodes a Uint8Array as calldata bytes. The "b#" form is the
  // CLI's convention and would be encoded as ordinary text, so the raw bytes
  // are passed through (and no Node-only Buffer is used, since this runs in
  // the browser).
  return bytes;
}
