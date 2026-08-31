import { useEffect, useMemo, useRef, useState } from 'react';

const defaultSegments = [
  { time: '00:00:12', label: 'Scene intro' },
  { time: '00:00:48', label: 'Primary action' },
  { time: '00:01:26', label: 'Highlight frame' }
];

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

export default function App() {
  const defaults = {
    videoName: 'sample-video.mp4',
    startTime: '00:00:10',
    endTime: '00:00:45',
    mode: 'fps',
    fps: 5,
    frameCount: 100
  };

  const [videoName, setVideoName] = useState('sample-video.mp4');
  const [startTime, setStartTime] = useState('00:00:10');
  const [endTime, setEndTime] = useState('00:00:45');
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

  const duration = useMemo(() => {
    const start = parseTime(startTime);
    const end = parseTime(endTime);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return NaN;
    return end - start;
  }, [startTime, endTime]);

  const estimatedFrames = useMemo(() => {
    if (!Number.isFinite(duration)) return NaN;
    if (mode === 'fps') return duration * Number(fps);
    return Number(frameCount);
  }, [duration, mode, fps, frameCount]);

  const onPickFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setSelectedFile(file);
    setVideoName(file.name);
    setVideoUrl(URL.createObjectURL(file));
    setStatus(`Loaded ${file.name}.`);
  };

  const onExtract = () => {
    if (!selectedFile) {
      setStatus('Please choose a video file first.');
      return;
    }

    if (!Number.isFinite(duration)) {
      setStatus('Please enter a valid start and end time.');
      return;
    }

    const detail = mode === 'fps' ? `${fps} FPS` : `${frameCount} frames`;

    const run = async () => {
      try {
        setIsExtracting(true);
        setStatus('Uploading video and extracting frames...');

        const formData = new FormData();
        formData.append('video', selectedFile);
        formData.append('startTime', startTime);
        formData.append('endTime', endTime);
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

        setStatus(`Downloaded ${formatCount(estimatedFrames)} frames at ${detail}.`);
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
    setVideoName(defaults.videoName);
    setStartTime(defaults.startTime);
    setEndTime(defaults.endTime);
    setMode(defaults.mode);
    setFps(defaults.fps);
    setFrameCount(defaults.frameCount);
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

            <div className="field-row">
              <label>
                <span>Start time</span>
                <input value={startTime} onChange={(e) => setStartTime(e.target.value)} placeholder="00:00:00" />
              </label>
              <label>
                <span>End time</span>
                <input value={endTime} onChange={(e) => setEndTime(e.target.value)} placeholder="00:00:00" />
              </label>
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
                  <span>Mode</span>
                  <strong>{mode === 'fps' ? 'Frames per second' : 'Frame count'}</strong>
                </div>
                <div>
                  <span>Start</span>
                  <strong>{startTime}</strong>
                </div>
                <div>
                  <span>End</span>
                  <strong>{endTime}</strong>
                </div>
                <div>
                  <span>Frames</span>
                  <strong>{formatCount(estimatedFrames)}</strong>
                </div>
              </div>

            <h3>Quick Picks</h3>
            <div className="chips">
              {defaultSegments.map((segment) => (
                <button key={segment.time} type="button" className="chip" onClick={() => setStartTime(segment.time)}>
                  <strong>{segment.time}</strong>
                  <span>{segment.label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
