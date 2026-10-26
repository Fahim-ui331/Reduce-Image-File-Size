function CompressionSettings({
  targetMode,
  setTargetMode,
  customTarget,
  setCustomTarget,
  outputFormat,
  setOutputFormat,
}) {
  return (
    <section className="settings-panel" aria-labelledby="settings-heading">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Step 2</p>
          <h2 id="settings-heading">Choose your output</h2>
        </div>
        <span className="settings-caption">A smaller file is a goal, not a guarantee</span>
      </div>

      <fieldset className="setting-group">
        <legend>Target size</legend>
        <div className="target-options">
          {[50, 100, 200, 500].map((size) => (
            <label className="radio-card" key={size}>
              <input
                type="radio"
                name="target-size"
                value={String(size)}
                checked={targetMode === String(size)}
                onChange={() => setTargetMode(String(size))}
              />
              <span>{size} KB</span>
            </label>
          ))}
          <label className="radio-card">
            <input
              type="radio"
              name="target-size"
              value="custom"
              checked={targetMode === "custom"}
              onChange={() => setTargetMode("custom")}
            />
            <span>Custom</span>
          </label>
        </div>
        {targetMode === "custom" && (
          <div className="custom-target">
            <label htmlFor="custom-target">Custom target size</label>
            <div className="input-with-unit">
              <input
                id="custom-target"
                type="number"
                min="10"
                max="25600"
                step="1"
                inputMode="numeric"
                value={customTarget}
                onChange={(event) => setCustomTarget(event.target.value)}
                aria-describedby="target-help"
              />
              <span>KB</span>
            </div>
            <p id="target-help">Enter a value from 10 to 25,600 KB.</p>
          </div>
        )}
      </fieldset>

      <fieldset className="setting-group format-group">
        <legend>Output format</legend>
        <div className="format-options">
          <label className="format-option">
            <input
              type="radio"
              name="output-format"
              value="jpeg"
              checked={outputFormat === "jpeg"}
              onChange={() => setOutputFormat("jpeg")}
            />
            <span>
              <strong>JPG</strong>
              <small>Smaller photos · no transparency</small>
            </span>
          </label>
          <label className="format-option">
            <input
              type="radio"
              name="output-format"
              value="webp"
              checked={outputFormat === "webp"}
              onChange={() => setOutputFormat("webp")}
            />
            <span>
              <strong>WebP</strong>
              <small>Modern format · keeps transparency</small>
            </span>
          </label>
        </div>
      </fieldset>
    </section>
  );
}

export default CompressionSettings;
