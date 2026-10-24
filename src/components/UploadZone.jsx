function UploadZone({ inputRef, onFiles, disabled }) {
  function handleDrop(event) {
    event.preventDefault();
    if (!disabled) {
      onFiles(event.dataTransfer.files);
    }
  }

  return (
    <div
      className={`upload-zone${disabled ? " upload-zone-disabled" : ""}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        className="visually-hidden"
        id="image-files"
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        disabled={disabled}
        onChange={(event) => {
          onFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <div className="upload-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 15v4h14v-4" />
        </svg>
      </div>
      <h2>Choose images to compress</h2>
      <p>Drag and drop images here, or browse files on your device.</p>
      <label className="button button-secondary browse-button" htmlFor="image-files">
        Browse images
      </label>
      <p className="upload-hint">
        JPG, PNG, and WebP · Up to 25 MB each · 10 images per batch
      </p>
      <p className="upload-hint format-support-note">
        HEIC/HEIF is recognized, but decoding is not enabled yet.
      </p>
    </div>
  );
}

export default UploadZone;
