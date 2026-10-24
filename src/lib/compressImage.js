import { MAX_IMAGE_PIXELS } from "./imageTypes.js";
import { decodeHeifFile } from "./heicAdapter.js";

const MIN_QUALITY = 0.45;
const MAX_QUALITY = 0.94;
const QUALITY_SEARCH_STEPS = 5;
const MAX_RESIZE_STEPS = 5;
const MIN_EDGE = 640;

export function nextDimensions(width, height, targetBytes, currentBytes) {
  if (currentBytes <= targetBytes || width <= MIN_EDGE || height <= MIN_EDGE) {
    return null;
  }

  const minimumSafeFactor = MIN_EDGE / Math.min(width, height);
  if (minimumSafeFactor > 0.88) {
    return null;
  }
  const factor = Math.max(
    minimumSafeFactor,
    Math.min(0.88, Math.max(0.58, Math.sqrt(targetBytes / currentBytes) * 0.92)),
  );
  const nextWidth = Math.round(width * factor);
  const nextHeight = Math.round(height * factor);

  if (nextWidth >= width && nextHeight >= height) {
    return null;
  }
  if (nextWidth < MIN_EDGE || nextHeight < MIN_EDGE) {
    return null;
  }

  return { width: nextWidth, height: nextHeight };
}

function decodeWithImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        close: () => {
          image.src = "";
        },
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode failed"));
    };
    image.src = url;
  });
}

async function decodeImage(file, sourceFormat) {
  if (sourceFormat === "heif") {
    return decodeHeifFile(file);
  }

  try {
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(file);
      return {
        image: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    }
    return await decodeWithImageElement(file);
  } catch {
    throw new Error(
      "The image could not be decoded or there was not enough memory. It may be corrupted, unsupported, or too large to process.",
    );
  }
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size === 0) {
            reject(new Error("The browser could not create an output image."));
            return;
          }
          if (blob.type !== mimeType) {
            reject(new Error(`This browser cannot export ${mimeType === "image/webp" ? "WebP" : "JPG"} images.`));
            return;
          }
          resolve(blob);
        },
        mimeType,
        quality,
      );
    } catch {
      reject(new Error("The browser could not export this image. Try a smaller file."));
    }
  });
}

function drawImage(context, image, width, height, mimeType) {
  context.clearRect(0, 0, width, height);
  if (mimeType === "image/jpeg") {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(image, 0, 0, width, height);
}

async function findBestQuality(canvas, context, image, width, height, mimeType, targetBytes, onProgress) {
  drawImage(context, image, width, height, mimeType);
  onProgress?.(`Encoding at ${Math.round(MAX_QUALITY * 100)}% quality`);
  const highestQuality = await canvasToBlob(canvas, mimeType, MAX_QUALITY);
  if (highestQuality.size <= targetBytes) {
    return {
      bestUnderTarget: { blob: highestQuality, quality: MAX_QUALITY },
      lowestQualityBlob: { blob: highestQuality, quality: MAX_QUALITY },
    };
  }

  drawImage(context, image, width, height, mimeType);
  onProgress?.(`Encoding at ${Math.round(MIN_QUALITY * 100)}% quality`);
  const minimumBlob = await canvasToBlob(canvas, mimeType, MIN_QUALITY);
  if (minimumBlob.size > targetBytes) {
    return {
      bestUnderTarget: null,
      lowestQualityBlob: { blob: minimumBlob, quality: MIN_QUALITY },
    };
  }

  let bestUnderTarget = { blob: minimumBlob, quality: MIN_QUALITY };
  let low = MIN_QUALITY;
  let high = MAX_QUALITY;
  for (let step = 0; step < QUALITY_SEARCH_STEPS; step += 1) {
    const quality = (low + high) / 2;
    drawImage(context, image, width, height, mimeType);
    onProgress?.(`Encoding at ${Math.round(quality * 100)}% quality`);
    const blob = await canvasToBlob(canvas, mimeType, quality);
    if (blob.size <= targetBytes) {
      bestUnderTarget = { blob, quality };
      low = quality;
    } else {
      high = quality;
    }
  }

  return {
    bestUnderTarget,
    lowestQualityBlob: { blob: minimumBlob, quality: MIN_QUALITY },
  };
}

export async function compressImage(file, sourceFormat, outputFormat, targetBytes, onProgress) {
  const mimeType = outputFormat === "jpeg" ? "image/jpeg" : "image/webp";
  const decoded = await decodeImage(file, sourceFormat);
  let canvas;

  try {
    if (!decoded.width || !decoded.height) {
      throw new Error("The image has invalid dimensions.");
    }
    if (decoded.width * decoded.height > MAX_IMAGE_PIXELS) {
      throw new Error("This image is too large to process safely (over 40 megapixels).");
    }

    canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: outputFormat === "webp" });
    if (!context) {
      throw new Error("Your browser could not prepare an image canvas.");
    }

    let width = decoded.width;
    let height = decoded.height;
    let closestResult = null;

    for (let resizeStep = 0; resizeStep <= MAX_RESIZE_STEPS; resizeStep += 1) {
      canvas.width = width;
      canvas.height = height;
      const { bestUnderTarget, lowestQualityBlob } = await findBestQuality(
        canvas,
        context,
        decoded.image,
        width,
        height,
        mimeType,
        targetBytes,
        onProgress,
      );

      if (bestUnderTarget) {
        return {
          blob: bestUnderTarget.blob,
          width,
          height,
          quality: bestUnderTarget.quality,
          targetReached: true,
          mimeType,
        };
      }

      if (!closestResult || lowestQualityBlob.blob.size < closestResult.blob.size) {
        closestResult = { ...lowestQualityBlob, width, height };
      }
      if (resizeStep === MAX_RESIZE_STEPS) {
        break;
      }

      const next = nextDimensions(width, height, targetBytes, lowestQualityBlob.blob.size);
      if (!next) {
        break;
      }
      onProgress?.(`Resizing to ${next.width} × ${next.height}`);
      width = next.width;
      height = next.height;
    }

    if (!closestResult) {
      throw new Error("The browser could not create an output image.");
    }

    return {
      ...closestResult,
      targetReached: false,
      mimeType,
    };
  } finally {
    decoded.close();
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}
