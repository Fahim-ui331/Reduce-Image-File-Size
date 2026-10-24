import { useState } from "react";
import { calculateSavings, formatFileSize, formatOutputName } from "../lib/format.js";

const statusLabels = {
  validating: "Checking file",
  ready: "Ready",
  processing: "Processing",
  done: "Complete",
  error: "Needs attention",
};

function Preview({ src, alt, fallback }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <div className="preview-fallback">{fallback}</div>;
  }
  return <img src={src} alt={alt} onError={() => setFailed(true)} />;
}

function ImageCard({ entry, outputFormat, onRemove }) {
  const hasOutput = Boolean(entry.outputUrl);
  const savings = hasOutput
    ? calculateSavings(entry.file.size, entry.outputBlob.size)
    : 0;
  const isTransparentSource = entry.format === "png" || entry.format === "webp";

  return (
    <article className="image-card">
      <div className="image-card-heading">
        <div className="image-name-wrap">
          <h3 title={entry.file.name}>{entry.file.name}</h3>
          <span className={`status-badge status-${entry.status}`}>
            {statusLabels[entry.status]}
          </span>
        </div>
        <button
          className="icon-button remove-button"
          type="button"
          aria-label={`Remove ${entry.file.name}`}
          onClick={() => onRemove(entry.id)}
        >
          Remove
        </button>
      </div>

      <div className="image-previews">
        <figure className="preview-panel">
          <Preview
            src={entry.previewUrl}
            alt={`Original preview of ${entry.file.name}`}
            fallback={entry.format === "heif" ? "HEIC/HEIF preview unavailable" : "Preview unavailable"}
          />
          <figcaption>
            <span>Original</span>
            <strong>{formatFileSize(entry.file.size)}</strong>
          </figcaption>
        </figure>
        <figure className={`preview-panel${hasOutput ? "" : " preview-pending"}`}>
          {hasOutput ? (
            <Preview
              src={entry.outputUrl}
              alt={`Compressed ${outputFormat === "jpeg" ? "JPG" : "WebP"} preview of ${entry.file.name}`}
              fallback="Output preview unavailable"
            />
          ) : (
            <div className="preview-fallback">
              {entry.status === "processing" ? entry.progress : "Output appears here"}
            </div>
          )}
          <figcaption>
            <span>{outputFormat === "jpeg" ? "JPG output" : "WebP output"}</span>
            <strong>{hasOutput ? formatFileSize(entry.outputBlob.size) : "—"}</strong>
          </figcaption>
        </figure>
      </div>

      <div className="image-card-details">
        <div className="image-message" aria-live="polite">
          {entry.status === "error" && <p className="error-text">{entry.error}</p>}
          {entry.status === "processing" && <p>{entry.progress}</p>}
          {hasOutput && (
            <>
              <p className={savings >= 0 ? "success-text" : "warning-text"}>
                {savings >= 0
                  ? `${savings.toFixed(1)}% smaller`
                  : `${Math.abs(savings).toFixed(1)}% larger than the original`}
                {!entry.targetReached && " · Target not reached"}
              </p>
              {outputFormat === "jpeg" && isTransparentSource && (
                <p className="subtle-note">
                  JPG has no transparency; the image is drawn onto a white background.
                </p>
              )}
            </>
          )}
          {entry.status === "done" && entry.targetReached && (
            <p className="subtle-note">Target size reached. The target is a goal, not a guarantee.</p>
          )}
        </div>
        {hasOutput && (
          <a
            className="button button-primary download-button"
            href={entry.outputUrl}
            download={formatOutputName(entry.file.name, outputFormat)}
          >
            Download {outputFormat === "jpeg" ? "JPG" : "WebP"}
          </a>
        )}
      </div>
    </article>
  );
}

export default ImageCard;
