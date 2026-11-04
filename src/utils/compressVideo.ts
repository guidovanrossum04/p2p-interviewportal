export interface VideoCompressionResult {
  file: File;
  compressed: boolean;
}

export async function compressVideo(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<VideoCompressionResult> {
  if (!HTMLCanvasElement.prototype.captureStream || typeof MediaRecorder === 'undefined') {
    throw new Error('Video compression is not supported by this browser. Turn off compression or use another browser.');
  }

  const sourceUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  const captureStreamElement = video as HTMLVideoElement & {
    captureStream?: () => MediaStream;
    webkitCaptureStream?: () => MediaStream;
  };
  const getAudioStream = captureStreamElement.captureStream?.bind(video)
    || captureStreamElement.webkitCaptureStream?.bind(video);
  if (!getAudioStream) {
    URL.revokeObjectURL(sourceUrl);
    throw new Error('Video compression is not supported by this browser. Turn off compression or use another browser.');
  }
  video.preload = 'auto';
  video.playsInline = true;
  video.src = sourceUrl;

  let canvasStream: MediaStream | null = null;
  let audioStream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let frameId = 0;

  try {
    await new Promise<void>((resolve, reject) => {
      video.addEventListener('loadedmetadata', () => resolve(), { once: true });
      video.addEventListener('error', () => reject(new Error('Could not read this video for compression.')), { once: true });
      video.load();
    });

    const scale = Math.min(1, 1280 / video.videoWidth, 720 / video.videoHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(2, Math.floor(video.videoWidth * scale / 2) * 2);
    canvas.height = Math.max(2, Math.floor(video.videoHeight * scale / 2) * 2);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare this video for compression.');

    canvasStream = canvas.captureStream(24);
    audioStream = getAudioStream();
    audioStream?.getAudioTracks().forEach((track) => canvasStream?.addTrack(track));

    const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/mp4']
      .find((type) => MediaRecorder.isTypeSupported(type));
    if (!mimeType) throw new Error('This browser does not support a format for compressed video.');

    recorder = new MediaRecorder(canvasStream, {
      mimeType,
      videoBitsPerSecond: 1_500_000,
      audioBitsPerSecond: 96_000,
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };

    const recordingFinished = new Promise<Blob>((resolve, reject) => {
      if (!recorder) {
        reject(new Error('Could not start video compression.'));
        return;
      }
      recorder.addEventListener('stop', () => resolve(new Blob(chunks, { type: mimeType })), { once: true });
      recorder.addEventListener('error', () => reject(new Error('Video compression failed.')), { once: true });
    });

    const drawFrame = () => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && !video.ended) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      if (!video.ended) frameId = window.requestAnimationFrame(drawFrame);
    };

    const updateProgress = () => {
      if (video.duration > 0) onProgress?.(Math.min(99, Math.round((video.currentTime / video.duration) * 100)));
    };
    video.addEventListener('timeupdate', updateProgress);
    video.addEventListener('ended', () => {
      if (recorder?.state === 'recording') recorder.stop();
    }, { once: true });

    recorder.start(1000);
    drawFrame();
    await video.play();
    const compressedBlob = await recordingFinished;
    onProgress?.(100);

    if (!compressedBlob.size) throw new Error('Video compression produced an empty file.');
    if (compressedBlob.size >= file.size) return { file, compressed: false };

    const extension = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
    const baseName = file.name.replace(/\.[^.]+$/, '');
    return {
      file: new File([compressedBlob], `${baseName}.${extension}`, { type: mimeType }),
      compressed: true,
    };
  } finally {
    window.cancelAnimationFrame(frameId);
    if (recorder?.state === 'recording') recorder.stop();
    canvasStream?.getTracks().forEach((track) => track.stop());
    audioStream?.getTracks().forEach((track) => track.stop());
    video.pause();
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(sourceUrl);
  }
}
