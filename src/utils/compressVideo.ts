export async function compressVideo(file: File): Promise<File> {
  if (!HTMLCanvasElement.prototype.captureStream || typeof MediaRecorder === 'undefined') {
    throw new Error('Could not process this video. Try another file or browser.');
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
    throw new Error('Could not process this video. Try another file or browser.');
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
      video.addEventListener('error', () => reject(new Error('Could not process this video. Try another file.')), { once: true });
      video.load();
    });

    const scale = Math.min(1, 1280 / video.videoWidth, 720 / video.videoHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(2, Math.floor(video.videoWidth * scale / 2) * 2);
    canvas.height = Math.max(2, Math.floor(video.videoHeight * scale / 2) * 2);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not process this video. Try another file.');

    canvasStream = canvas.captureStream(24);
    audioStream = getAudioStream();
    audioStream?.getAudioTracks().forEach((track) => canvasStream?.addTrack(track));

    const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/mp4']
      .find((type) => MediaRecorder.isTypeSupported(type));
    if (!mimeType) throw new Error('Could not process this video. Try another file or browser.');

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
        reject(new Error('Could not process this video. Try another file.'));
        return;
      }
      recorder.addEventListener('stop', () => resolve(new Blob(chunks, { type: mimeType })), { once: true });
      recorder.addEventListener('error', () => reject(new Error('Could not process this video. Try another file.')), { once: true });
    });

    const drawFrame = () => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && !video.ended) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      if (!video.ended) frameId = window.requestAnimationFrame(drawFrame);
    };

    video.addEventListener('ended', () => {
      if (recorder?.state === 'recording') recorder.stop();
    }, { once: true });

    recorder.start(1000);
    drawFrame();
    await video.play();
    const compressedBlob = await recordingFinished;

    if (!compressedBlob.size) throw new Error('Could not process this video. Try another file.');

    const extension = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
    const baseName = file.name.replace(/\.[^.]+$/, '');
    return new File([compressedBlob], `${baseName}.${extension}`, { type: mimeType });
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
