
interface ModelDownloadOverlayProps {
  progress: number;
  text: string;
  modelId: string;
}

export function ModelDownloadOverlay({ progress, text, modelId }: ModelDownloadOverlayProps) {
  return (
    <div className="mdo-container">
      <span className="mdo-orb">✦</span>
      <h2 className="mdo-title">Downloading AI model</h2>
      <code className="mdo-model">{modelId}</code>
      <div className="mdo-progress-wrap">
        <div
          className="mdo-progress-bar"
          style={{ width: progress * 100 + '%' }}
        />
      </div>
      <span className="mdo-percent">{Math.round(progress * 100) + '%'}</span>
      <p className="mdo-text">{text}</p>
      <p className="mdo-note">Downloaded once, cached forever — no re-download needed</p>
    </div>
  );
}
