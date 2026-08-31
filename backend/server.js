import cors from 'cors';
import express from 'express';
import multer from 'multer';
import archiver from 'archiver';
import { spawn } from 'child_process';
import { createWriteStream } from 'fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import ffmpegPath from 'ffmpeg-static';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const port = process.env.PORT || 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());

function parseTime(value) {
  const parts = String(value).split(':').map(Number);
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return NaN;
  const [hours, minutes, seconds] = parts;
  return hours * 3600 + minutes * 60 + seconds;
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let errorOutput = '';

    child.stderr.on('data', (chunk) => {
      errorOutput += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(errorOutput || `ffmpeg exited with code ${code}`));
    });
  });
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/extract', upload.single('video'), async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'Video file is required.' });
    return;
  }

  const startTime = String(req.body.startTime ?? '00:00:00');
  const endTime = String(req.body.endTime ?? '00:00:00');
  const mode = String(req.body.mode ?? 'fps');
  const fps = Number(req.body.fps ?? 1);
  const frameCount = Number(req.body.frameCount ?? 1);

  const startSeconds = parseTime(startTime);
  const endSeconds = parseTime(endTime);

  if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) || endSeconds <= startSeconds) {
    res.status(400).json({ error: 'Start time must be before end time.' });
    return;
  }

  const duration = endSeconds - startSeconds;
  const captureFps = mode === 'count' ? frameCount / duration : fps;

  if (!Number.isFinite(captureFps) || captureFps <= 0) {
    res.status(400).json({ error: 'Frame rate must be greater than zero.' });
    return;
  }

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'frame-extractor-'));
  const inputPath = path.join(tempRoot, file.originalname || 'input-video');
  const outputDir = path.join(tempRoot, 'frames');
  const zipPath = path.join(tempRoot, 'frames.zip');

  try {
    await mkdir(outputDir, { recursive: true });
    await writeFile(inputPath, file.buffer);

    const outputPattern = path.join(outputDir, 'frame-%04d.jpg');
    await runFfmpeg([
      '-y',
      '-ss', startTime,
      '-to', endTime,
      '-i', inputPath,
      '-vf', `fps=${captureFps}`,
      '-q:v', '2',
      outputPattern
    ]);

    const archive = archiver('zip', { zlib: { level: 9 } });
    const output = createWriteStream(zipPath);

    await new Promise((resolve, reject) => {
      output.on('close', resolve);
      output.on('error', reject);
      archive.on('error', reject);
      archive.pipe(output);
      archive.directory(outputDir, false);
      archive.finalize();
    });

    res.download(zipPath, 'extracted-frames.zip', async (error) => {
      await rm(tempRoot, { recursive: true, force: true });
      if (error) {
        console.error(error);
      }
    });
  } catch (error) {
    await rm(tempRoot, { recursive: true, force: true });
    res.status(500).json({ error: error.message || 'Failed to extract frames.' });
  }
});

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
