export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "—";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function calculateSavings(originalBytes, outputBytes) {
  if (!Number.isFinite(originalBytes) || originalBytes <= 0) {
    return 0;
  }
  return ((originalBytes - outputBytes) / originalBytes) * 100;
}

export function formatOutputName(name, format) {
  const stem = name.replace(/\.[^.]+$/, "") || "image";
  return `${stem}.${format === "jpeg" ? "jpg" : "webp"}`;
}
