import { useEffect, useRef, useState } from "react";
import CompressionSettings from "./components/CompressionSettings.jsx";
import ImageCard from "./components/ImageCard.jsx";
import UploadZone from "./components/UploadZone.jsx";
import { compressImage } from "./lib/compressImage.js";
import { formatFileSize } from "./lib/format.js";
import {
  MAX_BATCH_SIZE,
  validateImageFile,
  validateTargetSize,
} from "./lib/imageTypes.js";

const supportedExtensions = ".jpg, .jpeg, .png, .webp, .heic, .heif";

function App() {
  const [items, setItems] = useState([]);
  const [targetMode, setTargetMode] = useState("200");
  const [customTarget, setCustomTarget] = useState("200");
  const [outputFormat, setOutputFormat] = useState("webp");
  const [notice, setNotice] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [targetError, setTargetError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef(null);
  const itemsRef = useRef([]);
  const idRef = useRef(0);
  const mountedRef = useRef(true);

  function replaceItems(nextItems) {
    itemsRef.current = nextItems;
    setItems(nextItems);
  }

  function updateItem(id, updater) {
    const currentItems = itemsRef.current;
    if (!currentItems.some((item) => item.id === id)) {
      return false;
    }
    replaceItems(
      currentItems.map((item) => (item.id === id ? updater(item) : item)),
    );
    return true;
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      for (const item of itemsRef.current) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
      }
    };
  }, []);

  async function addFiles(fileList) {
    const incoming = Array.from(fileList ?? []);
    if (incoming.length === 0) return;

    const available = MAX_BATCH_SIZE - itemsRef.current.length;
    const selected = incoming.slice(0, Math.max(available, 0));
    if (selected.length < incoming.length) {
      setNotice(`A batch can contain up to ${MAX_BATCH_SIZE} files. The extra files were not added.`);
    } else {
      setNotice("");
    }
    if (selected.length === 0) return;

    const newItems = selected.map((file) => ({
      id: `image-${Date.now()}-${idRef.current++}`,
      file,
      format: null,
      status: "validating",
      progress: "",
      error: "",
      previewUrl: "",
      outputUrl: "",
      outputBlob: null,
      outputFormat: "",
      targetReached: false,
    }));
    replaceItems([...itemsRef.current, ...newItems]);
    setAnnouncement(`Checking ${newItems.length} selected ${newItems.length === 1 ? "image" : "images"}.`);

    for (const item of newItems) {
      try {
        const { format } = await validateImageFile(item.file);
        if (!mountedRef.current || !itemsRef.current.some((entry) => entry.id === item.id)) {
          continue;
        }
        const previewUrl = URL.createObjectURL(item.file);
        updateItem(item.id, (current) => ({
          ...current,
          format,
          status: "ready",
          previewUrl,
        }));
      } catch (error) {
        if (!mountedRef.current) return;
        updateItem(item.id, (current) => ({
          ...current,
          status: "error",
          error: error instanceof Error ? error.message : "This image could not be checked.",
        }));
      }
    }
    if (mountedRef.current) {
      setAnnouncement("File checks finished. Review any file errors before compressing.");
    }
  }

  function removeItem(id) {
    const item = itemsRef.current.find((entry) => entry.id === id);
    if (!item) return;
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
    replaceItems(itemsRef.current.filter((entry) => entry.id !== id));
    setAnnouncement(`${item.file.name} removed.`);
  }

  function resetAll() {
    if (isProcessing) return;
    for (const item of itemsRef.current) {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
    }
    replaceItems([]);
    setNotice("");
    setTargetError("");
    setAnnouncement("All images removed.");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function startCompression() {
    let targetBytes;
    try {
      targetBytes = validateTargetSize(targetMode === "custom" ? customTarget : targetMode);
      setTargetError("");
    } catch (error) {
      setTargetError(error instanceof Error ? error.message : "Enter a valid target size.");
      return;
    }

    const candidates = itemsRef.current.filter(
      (item) => item.status === "ready" || item.status === "done",
    );
    if (candidates.length === 0) {
      setNotice("Add at least one valid image before starting compression.");
      return;
    }

    setIsProcessing(true);
    setNotice("");
    setAnnouncement(`Compression started for ${candidates.length} ${candidates.length === 1 ? "image" : "images"}.`);

    let completed = 0;
    let failed = 0;
    for (const item of candidates) {
      if (!mountedRef.current || !itemsRef.current.some((entry) => entry.id === item.id)) {
        continue;
      }
      if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
      updateItem(item.id, (current) => ({
        ...current,
        status: "processing",
        progress: "Preparing image",
        error: "",
        outputUrl: "",
        outputBlob: null,
        outputFormat: "",
      }));

      try {
        const result = await compressImage(
          item.file,
          item.format,
          outputFormat,
          targetBytes,
          (progress) => {
            if (mountedRef.current) {
              updateItem(item.id, (current) => ({ ...current, progress }));
            }
          },
        );
        if (!mountedRef.current || !itemsRef.current.some((entry) => entry.id === item.id)) {
          continue;
        }
        const outputUrl = URL.createObjectURL(result.blob);
        updateItem(item.id, (current) => ({
          ...current,
          status: "done",
          progress: "",
          outputUrl,
          outputBlob: result.blob,
          outputFormat,
          targetReached: result.targetReached,
        }));
        completed += 1;
      } catch (error) {
        if (!mountedRef.current) return;
        updateItem(item.id, (current) => ({
          ...current,
          status: "error",
          progress: "",
          error: error instanceof Error
            ? error.message
            : "Compression failed. Try another image or a different output format.",
        }));
        failed += 1;
      }
    }

    if (mountedRef.current) {
      setIsProcessing(false);
      const summary = `Finished: ${completed} ${completed === 1 ? "image" : "images"} compressed${failed ? `, ${failed} ${failed === 1 ? "file needs" : "files need"} attention` : ""}.`;
      setAnnouncement(summary);
      if (failed > 0) setNotice(summary);
    }
  }

  const readyCount = items.filter((item) => item.status === "ready" || item.status === "done").length;
  const targetDescription = targetMode === "custom" ? `${customTarget || "custom"} KB` : `${targetMode} KB`;

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Image Compressor home">
          <span className="brand-mark" aria-hidden="true">IC</span>
          <span>Image Compressor</span>
        </a>
        <span className="privacy-note">
          <span className="privacy-dot" aria-hidden="true" />
          Processed on your device
        </span>
      </header>

      <main className="main-content">
        <section className="intro" aria-labelledby="page-title">
          <p className="eyebrow">Simple. Private. In your browser.</p>
          <h1 id="page-title">Smaller images, made simple.</h1>
          <p className="intro-copy">
            Compress JPG, PNG, and WebP images for easier sharing and uploads.
            Your files stay on your device.
          </p>
        </section>

        <div className="workflow">
          <UploadZone inputRef={inputRef} onFiles={addFiles} disabled={items.length >= MAX_BATCH_SIZE} />

          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          <p className="visually-hidden" aria-live="polite" aria-atomic="true">
            {announcement}
          </p>

          <CompressionSettings
            targetMode={targetMode}
            setTargetMode={setTargetMode}
            customTarget={customTarget}
            setCustomTarget={setCustomTarget}
            outputFormat={outputFormat}
            setOutputFormat={setOutputFormat}
          />
          {targetError && <p className="error-text target-error" role="alert">{targetError}</p>}

          <div className="workflow-actions">
            <button
              className="button button-primary start-button"
              type="button"
              onClick={startCompression}
              disabled={isProcessing || readyCount === 0}
            >
              {isProcessing
                ? "Compressing images…"
                : readyCount === 0
                  ? "Add an image to begin"
                  : `Compress ${readyCount} ${readyCount === 1 ? "image" : "images"}`}
            </button>
            <button
              className="text-button"
              type="button"
              onClick={resetAll}
              disabled={items.length === 0 || isProcessing}
            >
              Remove all
            </button>
            <span className="selected-count">
              {items.length} of {MAX_BATCH_SIZE} images
            </span>
          </div>

          {items.length > 0 && (
            <section className="results-section" aria-labelledby="results-heading">
              <div className="section-heading results-heading">
                <div>
                  <p className="section-kicker">Step 3</p>
                  <h2 id="results-heading">Your images</h2>
                </div>
                <span className="settings-caption">Target: {targetDescription} · {outputFormat === "jpeg" ? "JPG" : "WebP"}</span>
              </div>
              <div className="image-list">
                {items.map((item) => (
                  <ImageCard
                    key={item.id}
                    entry={item}
                    outputFormat={item.outputFormat || outputFormat}
                    onRemove={removeItem}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        <section className="privacy-card" aria-labelledby="privacy-heading">
          <div className="privacy-card-mark" aria-hidden="true">✓</div>
          <div>
            <h2 id="privacy-heading">Your photos stay yours</h2>
            <p>
              Images are processed locally in this browser. They are not uploaded to our server.
              Canvas export can remove metadata such as location and camera details.
            </p>
          </div>
        </section>

        <section className="about-section" aria-labelledby="about-heading">
          <p className="section-kicker">A little more detail</p>
          <h2 id="about-heading">Reduce image size without giving up control</h2>
          <p>
            Choose a target that fits your upload limit, then save a JPG or WebP copy.
            Compression depends on each image’s content, dimensions, and format, so a target is
            an estimate rather than a promise. Your original file is never changed.
          </p>

          <div className="faq-list">
            <details>
              <summary>Which image formats can I use?</summary>
              <p>
                JPG/JPEG, PNG, and WebP files can be compressed in supported browsers.
                HEIC/HEIF files are detected, but decoding is not enabled yet while the
                decoder’s LGPL-3.0 distribution requirements are reviewed.
              </p>
            </details>
            <details>
              <summary>Will the image always reach my target size?</summary>
              <p>
                Not always. The compressor adjusts quality and image dimensions within
                reasonable limits. If it cannot reach your target without excessive degradation,
                it gives you the best result it could create and tells you the target was missed.
              </p>
            </details>
            <details>
              <summary>Are my images uploaded or stored?</summary>
              <p>
                No. Processing and previewing happen in your browser. Files are not sent to our
                server. Close the page or remove images to release their temporary previews.
              </p>
            </details>
            <details>
              <summary>Will transparent areas remain transparent?</summary>
              <p>
                WebP output keeps transparency. JPG does not support transparency, so transparent
                areas are flattened onto white.
              </p>
            </details>
            <details>
              <summary>What happens to image metadata?</summary>
              <p>
                Canvas-based export may remove metadata such as EXIF camera information and GPS
                location. This tool does not claim to preserve metadata.
              </p>
            </details>
          </div>
        </section>

        <p className="format-footnote">
          Supported input: {supportedExtensions}. Maximum file size: {formatFileSize(25 * 1024 * 1024)} per image.
        </p>
      </main>

      <footer className="site-footer">
        <span>Image Compressor</span>
        <span>Private by design · Processed in your browser</span>
      </footer>
    </div>
  );
}

export default App;
