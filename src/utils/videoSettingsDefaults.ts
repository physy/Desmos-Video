import type { VideoExportSettings } from "../types/timeline";

// VideoExportSettingsのデフォルト値
export const DEFAULT_VIDEO_SETTINGS: VideoExportSettings = {
  durationFrames: 300,
  fps: 30,
  resolution: {
    width: 1920,
    height: 1080,
    preset: "1080p",
  },
  quality: { bitrate: 5000, preset: "standard" },
  format: { container: "mp4", codec: "h264" },
  advanced: {
    targetPixelRatio: 1,
    backgroundColor: "#ffffff",
    antialias: true,
    motionBlur: false,
    frameInterpolation: false,
  },
  graphPlacement: {
    scale: 1.0,
    offsetX: 0,
    offsetY: 0,
  },
  metadata: { title: "Desmos Animation", description: "", author: "", tags: [] },
};
