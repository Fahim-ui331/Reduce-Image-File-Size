import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateSavings, formatFileSize, formatOutputName } from "../src/lib/format.js";
import { nextDimensions } from "../src/lib/compressImage.js";
import {
  detectImageFormat,
  MAX_FILE_SIZE,
  validateImageFile,
  validateTargetSize,
} from "../src/lib/imageTypes.js";
import { defaultPage, landingPages } from "../src/lib/seoPages.js";

function signatureFile(name, type, signature, size = signature.length) {
  const bytes = new Uint8Array(size);
  bytes.set(signature);
  return new File([bytes], name, { type });
}

const jpegSignature = [0xff, 0xd8, 0xff, 0xe0];
const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const webpSignature = [
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
];
const heifSignature = [
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63,
  0x00, 0x00, 0x00, 0x00, 0x6d, 0x69, 0x66, 0x31,
];

test("formats file sizes using readable units", () => {
  assert.equal(formatFileSize(0), "0 B");
  assert.equal(formatFileSize(1024), "1.0 KB");
  assert.equal(formatFileSize(1024 * 1024), "1.00 MB");
  assert.equal(formatFileSize(-1), "—");
});

test("calculates real savings and accounts for larger outputs", () => {
  assert.equal(calculateSavings(1000, 750), 25);
  assert.equal(calculateSavings(1000, 1250), -25);
  assert.equal(calculateSavings(0, 10), 0);
});

test("creates output names with the selected extension", () => {
  assert.equal(formatOutputName("photo.original.png", "jpeg"), "photo.original.jpg");
  assert.equal(formatOutputName("photo", "webp"), "photo.webp");
});

test("detects supported image signatures from file content", () => {
  assert.equal(detectImageFormat(new Uint8Array(jpegSignature)), "jpeg");
  assert.equal(detectImageFormat(new Uint8Array(pngSignature)), "png");
  assert.equal(detectImageFormat(new Uint8Array(webpSignature)), "webp");
  assert.equal(detectImageFormat(new Uint8Array(heifSignature)), "heif");
  assert.equal(
    detectImageFormat(new Uint8Array([
      0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66,
      0x68, 0x65, 0x69, 0x63, 0x61, 0x76, 0x69, 0x66,
    ])),
    null,
  );
  assert.equal(detectImageFormat(new Uint8Array([1, 2, 3])), null);
});

test("accepts recognized files when the extension, MIME type, and bytes agree", async () => {
  const cases = [
    ["photo.jpg", "image/jpeg", jpegSignature, "jpeg"],
    ["photo.png", "image/png", pngSignature, "png"],
    ["photo.webp", "image/webp", webpSignature, "webp"],
    ["photo.heic", "image/heic", heifSignature, "heif"],
  ];
  for (const [name, type, signature, format] of cases) {
    assert.deepEqual(await validateImageFile(signatureFile(name, type, signature)), { format });
  }
});

test("rejects empty, oversized, unknown, mismatched, and corrupted files", async () => {
  await assert.rejects(
    validateImageFile(new File([], "empty.png", { type: "image/png" })),
    /empty/,
  );
  await assert.rejects(
    validateImageFile(signatureFile("large.jpg", "image/jpeg", jpegSignature, MAX_FILE_SIZE + 1)),
    /25 MB/,
  );
  await assert.rejects(
    validateImageFile(signatureFile("script.exe", "application/octet-stream", [1, 2, 3])),
    /Use a JPG/,
  );
  await assert.rejects(
    validateImageFile(signatureFile("photo.jpg", "image/jpeg", pngSignature)),
    /extension does not match its image content/,
  );
  await assert.rejects(
    validateImageFile(signatureFile("photo.png", "image/jpeg", pngSignature)),
    /extension and image type do not match/,
  );
  await assert.rejects(
    validateImageFile(signatureFile("broken.webp", "image/webp", [1, 2, 3])),
    /corrupted/,
  );
});

test("validates target sizes and converts KB to bytes", () => {
  assert.equal(validateTargetSize("50"), 51200);
  assert.equal(validateTargetSize("100"), 102400);
  assert.equal(validateTargetSize("10.5"), 10752);
  assert.throws(() => validateTargetSize("9"), /between 10 and 25,600 KB/);
  assert.throws(() => validateTargetSize("25601"), /between 10 and 25,600 KB/);
  assert.throws(() => validateTargetSize("not a number"), /between 10 and 25,600 KB/);
});

test("defines unique SEO metadata and correct defaults for landing pages", () => {
  assert.deepEqual(
    Object.keys(landingPages).sort(),
    [
      "/compress-image-to-100kb",
      "/compress-image-to-200kb",
      "/compress-image-to-500kb",
      "/compress-image-to-50kb",
      "/heic-to-jpg-converter",
    ].sort(),
  );

  const titles = Object.values(landingPages).map((page) => page.title);
  assert.equal(new Set(titles).size, titles.length);
  assert.equal(landingPages["/compress-image-to-200kb"].targetMode, "200");
  assert.equal(landingPages["/compress-image-to-500kb"].targetMode, "500");
  assert.equal(landingPages["/compress-image-to-50kb"].targetMode, "50");
  assert.equal(landingPages["/heic-to-jpg-converter"].outputFormat, "jpeg");
  assert.equal(landingPages["/heic-to-jpg-converter"].conversionMode, true);
  assert.equal(defaultPage.targetMode, "200");
});

test("resizes toward the target while keeping proportions and safe bounds", () => {
  const next = nextDimensions(2400, 1600, 200_000, 1_000_000);
  assert.ok(next.width < 2400);
  assert.ok(next.height < 1600);
  assert.ok(Math.abs(next.width / next.height - 1.5) < 0.002);
  const later = nextDimensions(next.width, next.height, 10_000, 2_000_000);
  if (later) {
    assert.ok(Math.abs(later.width / later.height - 1.5) < 0.002);
  }
  assert.equal(nextDimensions(700, 1000, 100, 200_000), null);
  assert.equal(nextDimensions(600, 800, 100, 200_000), null);
  assert.equal(nextDimensions(1600, 1000, 200_000, 100_000), null);
});
