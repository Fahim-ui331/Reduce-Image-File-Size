export const MAX_FILE_SIZE = 25 * 1024 * 1024;
export const MAX_BATCH_SIZE = 10;
export const MAX_TARGET_KB = 25_600;
export const MIN_TARGET_KB = 10;
export const MAX_IMAGE_PIXELS = 40_000_000;

const extensions = new Map([
  [".jpg", "jpeg"],
  [".jpeg", "jpeg"],
  [".png", "png"],
  [".webp", "webp"],
  [".heic", "heif"],
  [".heif", "heif"],
]);

const mimeTypes = {
  jpeg: ["image/jpeg", "image/jpg"],
  png: ["image/png"],
  webp: ["image/webp"],
  heif: ["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"],
};

const heifBrands = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "mif1",
  "msf1",
  "heim",
  "heis",
  "hevm",
  "hevs",
  "miaf",
]);

function ascii(bytes, start, end) {
  return String.fromCharCode(...bytes.slice(start, end));
}

export function detectImageFormat(bytes) {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "jpeg";
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    ascii(bytes, 1, 4) === "PNG" &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }

  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 12) === "WEBP"
  ) {
    return "webp";
  }

  if (bytes.length >= 16 && ascii(bytes, 4, 8) === "ftyp") {
    if (heifBrands.has(ascii(bytes, 8, 12))) {
      return "heif";
    }
    for (let offset = 16; offset + 4 <= bytes.length; offset += 4) {
      if (heifBrands.has(ascii(bytes, offset, offset + 4))) {
        return "heif";
      }
    }
  }

  return null;
}

export async function validateImageFile(file) {
  if (!file || typeof file.slice !== "function") {
    throw new Error("This item is not a readable file.");
  }

  if (file.size === 0) {
    throw new Error("This file is empty.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("This file is larger than the 25 MB limit.");
  }

  const extension = file.name.match(/\.[^.]+$/)?.[0]?.toLowerCase();
  const extensionFormat = extension ? extensions.get(extension) : undefined;

  if (!extensionFormat) {
    throw new Error("Use a JPG, PNG, WebP, HEIC, or HEIF image.");
  }

  const mime = file.type?.toLowerCase() ?? "";
  if (mime && !mimeTypes[extensionFormat].includes(mime)) {
    throw new Error("The file extension and image type do not match.");
  }

  const header = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  const contentFormat = detectImageFormat(header);

  if (!contentFormat) {
    throw new Error("The file content is not a supported image or is corrupted.");
  }

  if (contentFormat !== extensionFormat) {
    throw new Error("The file extension does not match its image content.");
  }

  return { format: contentFormat };
}

export function validateTargetSize(value) {
  const targetKb = Number(value);
  if (
    !Number.isFinite(targetKb) ||
    targetKb < MIN_TARGET_KB ||
    targetKb > MAX_TARGET_KB
  ) {
    throw new Error(`Enter a target between ${MIN_TARGET_KB} and ${MAX_TARGET_KB.toLocaleString()} KB.`);
  }
  return Math.round(targetKb * 1024);
}
