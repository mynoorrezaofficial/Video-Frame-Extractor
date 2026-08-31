# Video Frame Extractor

A modern tool for extracting frames from videos with a React frontend and Node.js backend powered by FFmpeg.

## Features

- Upload any video file (MP4, MOV, MKV, AVI)
- Set custom start and end time
- Extract frames by FPS or by target frame count
- Download extracted frames as a ZIP file
- Live video preview

## Project Structure

```
Video Extactor/
├── frontend/          # React + Vite app
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── backend/           # Node.js API + FFmpeg
│   ├── server.js
│   └── package.json
└── README.md
```

## Prerequisites

- Node.js (v18 or higher)
- npm

## Run

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Opens at `http://localhost:8080`

### Backend

```bash
cd backend
npm install
npm run dev
```

Runs at `http://localhost:3001`

## How It Works

1. Select a video file
2. Set start and end time
3. Choose extraction mode (FPS or frame count)
4. Click Extract Frames
5. Download the ZIP with all extracted frames
