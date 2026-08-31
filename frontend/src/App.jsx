import { useEffect, useMemo, useRef, useState } from 'react';

function parseTime(value) {
  const parts = value.split(':').map(Number);
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return NaN;
  const [hours, minutes, seconds] = parts;
  return hours * 3600 + minutes * 60 + seconds;
}

function formatCount(value) {
  if (!Number.isFinite(value)) return '--';
  return Math.round(value).toLocaleString();
}

let segmentId = 0;

function createSegment(start = '00:00:00', end = '00:00:05') {
  segmentId += 1;
  return { id: segmentId, start, end };
}

export default function App() {
  const [videoName, setVideoName] = useState('sample-video.mp4');
  const [segments, setSegments] = useState([createSegment('00:00:10', '00:00:45')]);
  const [mode, setMode] = useState('fps');
  const [fps, setFps] = useState(5);
  const [frameCount, setFrameCount] = useState(100);
  const [selectedFile, setSelectedFile] = useState(null);
  const [status, setStatus] = useState('Ready to configure extraction.');
  const [isExtracting, setIsExtracting] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const totalDuration = useMemo(() => {
    let total = 0;
    for (const seg of segments) {
      const start = parseTime(seg.start);
      const end = parseTime(seg.end);
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
        total += end - start;
      }
    }
    return total;
  }, [segments]);

  const estimatedFrames = useMemo(() => {
    if (!Number.isFinite(totalDuration) || totalDuration === 0) return NaN;
    if (mode === 'fps') return totalDuration * Number(fps);
    return Number(frameCount);
  }, [totalDuration, mode, fps, frameCount]);

  const onPickFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setSelectedFile(file);
    setVideoName(file.name);
    setVideoUrl(URL.createObjectURL(file));
    setStatus(`Loaded ${file.name}.`);
  };

  const addSegment = () => {
    setSegments((prev) => [...prev, createSegment()]);
  };

  const removeSegment = (id) => {
    setSegments((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((s) => s.id !== id);
    });
  };

  const updateSegment = (id, field, value) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const onExtract = () => {
    if (!selectedFile) {
      setStatus('Please choose a video file first.');
      return;
    }

    const validSegments = segments.filter((s) => {
      const start = parseTime(s.start);
      const end = parseTime(s.end);
      return Number.isFinite(start) && Number.isFinite(end) && end > start;
    });

    if (validSegments.length === 0) {
      setStatus('Please add at least one valid time segment.');
      return;
    }

    const run = async () => {
      try {
        setIsExtracting(true);
        setStatus('Uploading video and extracting frames...');

        const formData = new FormData();
        formData.append('video', selectedFile);
        formData.append('segments', JSON.stringify(validSegments.map((s) => ({ start: s.start, end: s.end }))));
        formData.append('mode', mode);
        formData.append('fps', String(fps));
        formData.append('frameCount', String(frameCount));

        const response = await fetch('/api/extract', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'Extraction failed.');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'extracted-frames.zip';
        link.click();
        URL.revokeObjectURL(url);

        setStatus(`Downloaded frames from ${validSegments.length} segment(s).`);
      } catch (error) {
        setStatus(error.message || 'Something went wrong during extraction.');
      } finally {
        setIsExtracting(false);
      }
    };

    run();
  };

  const onReset = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoName('sample-video.mp4');
    setSegments([createSegment('00:00:10', '00:00:45')]);
    setMode('fps');
    setFps(5);
    setFrameCount(100);
    setSelectedFile(null);
    setVideoUrl(null);
    setStatus('Ready to configure extraction.');
  };

  return (
    <div className="app-shell">
      <div className="glow glow-a" />
      <div className="glow glow-b" />

      <main className="container">
        <section className="video-panel card">
          {videoUrl ? (
            <video
              ref={videoRef}
              className="video-player"
              src={videoUrl}
              controls
              preload="metadata"
            />
          ) : (
            <div className="video-placeholder">
              <div className="placeholder-icon">▶</div>
              <p>Select a video to preview it here</p>
            </div>
          )}
        </section>

        <section className="grid">
          <div className="card panel">
            <h2>Source Video</h2>
            <label className="upload">
              <input key={selectedFile ? selectedFile.name : 'empty'} type="file" accept="video/*" onChange={onPickFile} />
              <span className="upload-title">Drop or choose a video file</span>
              <span className="upload-subtitle">
                {selectedFile ? selectedFile.name : 'MP4, MOV, MKV, AVI supported'}
              </span>
            </label>

            <div className="segments-header">
              <h3>Time Segments</h3>
              <button className="add-btn" type="button" onClick={addSegment}>+ Add Segment</button>
            </div>

            <div className="segments-list">
              {segments.map((seg, index) => (
                <div key={seg.id} className="segment-row">
                  <span className="segment-label">Segment {index + 1}</span>
                  <div className="segment-fields">
                    <label>
                      <span>Start</span>
                      <input value={seg.start} onChange={(e) => updateSegment(seg.id, 'start', e.target.value)} placeholder="00:00:00" />
                    </label>
                    <label>
                      <span>End</span>
                      <input value={seg.end} onChange={(e) => updateSegment(seg.id, 'end', e.target.value)} placeholder="00:00:00" />
                    </label>
                  </div>
                  {segments.length > 1 && (
                    <button className="remove-btn" type="button" onClick={() => removeSegment(seg.id)}>✕</button>
                  )}
                </div>
              ))}
            </div>

            <div className="mode-switch">
              <button className={mode === 'fps' ? 'active' : ''} onClick={() => setMode('fps')} type="button">
                By FPS
              </button>
              <button className={mode === 'count' ? 'active' : ''} onClick={() => setMode('count')} type="button">
                By Frame Count
              </button>
            </div>

            {mode === 'fps' ? (
              <label>
                <span>Frames per second</span>
                <input type="number" min="1" step="1" value={fps} onChange={(e) => setFps(Number(e.target.value))} />
              </label>
            ) : (
              <label>
                <span>Target frame count</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={frameCount}
                  onChange={(e) => setFrameCount(Number(e.target.value))}
                />
              </label>
            )}

            <div className="actions">
              <button className="primary" type="button" onClick={onExtract} disabled={isExtracting}>
                {isExtracting ? 'Extracting...' : 'Extract Frames'}
              </button>
              <button className="secondary" type="button" onClick={onReset}>
                Reset
              </button>
            </div>

            <p className="status">{status}</p>
          </div>

          <div className="card panel">
            <h2>Extraction Preview</h2>
              <div className="preview-meta">
                <div>
                  <span>Segments</span>
                  <strong>{segments.length}</strong>
                </div>
                <div>
                  <span>Total Duration</span>
                  <strong>{Number.isFinite(totalDuration) ? `${totalDuration}s` : '--'}</strong>
                </div>
                <div>
                  <span>Mode</span>
                  <strong>{mode === 'fps' ? 'Frames per second' : 'Frame count'}</strong>
                </div>
                <div>
                  <span>Frames</span>
                  <strong>{formatCount(estimatedFrames)}</strong>
                </div>
              </div>
          </div>
        </section>
      </main>
    </div>
  );
}
