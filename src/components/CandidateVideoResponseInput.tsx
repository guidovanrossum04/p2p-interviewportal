import React, { useEffect, useRef, useState } from 'react';
import { Camera, CircleStop, RotateCcw, Upload, Video } from 'lucide-react';
import { CandidateAnswerMode } from '../types';

interface CandidateVideoResponseInputProps {
  answerMode: CandidateAnswerMode;
  questionNumber: number;
  answer: File | null;
  onChange: (file: File | null) => void;
}

export const CandidateVideoResponseInput: React.FC<CandidateVideoResponseInputProps> = ({
  answerMode,
  questionNumber,
  answer,
  onChange,
}) => {
  const [recording, setRecording] = useState(false);
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setRecordedSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    const preview = previewRef.current;
    if (!preview || !stream) return;
    preview.srcObject = stream;
    preview.play().catch((playError: unknown) => {
      console.error('Could not start the live candidate recording preview.', playError);
      setPreviewError('Recording is active, but the live preview could not start.');
    });
    return () => {
      preview.pause();
      preview.srcObject = null;
    };
  }, [stream]);

  useEffect(() => () => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  };

  const startRecording = async () => {
    setError(null);
    setPreviewError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Video recording is not supported by this browser. Contact the recruitment team for help.');
      return;
    }

    let requestedStream: MediaStream | null = null;
    try {
      requestedStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (!requestedStream.getVideoTracks().length || !requestedStream.getAudioTracks().length) {
        requestedStream.getTracks().forEach((track) => track.stop());
        throw new Error('A camera and microphone are both required to record.');
      }

      const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/mp4']
        .find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(requestedStream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => setError('Recording failed. Check camera and microphone permissions, then try again.');
      recorder.onstop = () => {
        const recordedType = recorder.mimeType || mimeType || 'video/webm';
        const extension = recordedType.split(';', 1)[0].toLowerCase() === 'video/mp4' ? 'mp4' : 'webm';
        const blob = new Blob(chunksRef.current, { type: recordedType });
        if (blob.size) {
          const file = new File([blob], `question-${questionNumber}.${extension}`, { type: recordedType });
          if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
          const nextPreviewUrl = URL.createObjectURL(blob);
          previewUrlRef.current = nextPreviewUrl;
          setPreviewUrl(nextPreviewUrl);
          onChange(file);
          setError(null);
        } else {
          setError('No video was captured. Please record your response again.');
        }
        requestedStream?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setStream(null);
        setRecording(false);
      };

      recorderRef.current = recorder;
      streamRef.current = requestedStream;
      recorder.start(1000);
      setStream(requestedStream);
      setRecordedSeconds(0);
      setRecording(true);
    } catch (recordingError) {
      requestedStream?.getTracks().forEach((track) => track.stop());
      setError(recordingError instanceof Error ? recordingError.message : 'Could not access your camera and microphone.');
    }
  };

  const replaceRecording = () => {
    onChange(null);
    setRecordedSeconds(0);
    setError(null);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
  };

  return (
    <div className="space-y-2">
      {answerMode === 'upload' ? (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            aria-label={`Upload video response for question ${questionNumber}`}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0] || null;
              event.currentTarget.value = '';
              onChange(file);
              setError(null);
            }}
            className="sr-only"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-red-600 bg-white px-3 py-2 text-[11px] font-semibold text-red-700 hover:bg-red-50"
          >
            <Upload aria-hidden="true" className="h-4 w-4" />
            {answer ? 'Replace video' : 'Choose video to upload'}
          </button>
          {answer && (
            <p className="flex items-center gap-2 text-[11px] text-emerald-700">
              <Video aria-hidden="true" className="h-4 w-4 shrink-0" />
              Ready to upload: {answer.name}
            </p>
          )}
        </>
      ) : (
        <>
          {recording ? (
            <div className="space-y-2">
              <video ref={previewRef} autoPlay muted playsInline className="w-full max-w-md rounded-lg bg-black aspect-video" />
              {previewError && <p role="alert" className="text-[11px] text-red-700">{previewError}</p>}
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] text-[#101010]">
                  {String(Math.floor(recordedSeconds / 60)).padStart(2, '0')}:{String(recordedSeconds % 60).padStart(2, '0')}
                </span>
                <button type="button" onClick={stopRecording} className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-3 py-2 text-[11px] font-semibold text-white">
                  <CircleStop aria-hidden="true" className="h-4 w-4" />
                  Stop recording
                </button>
              </div>
            </div>
          ) : answer ? (
            <div className="space-y-2">
              {previewUrl && <video src={previewUrl} controls playsInline className="w-full max-w-md rounded-lg bg-black aspect-video" />}
              <p className="text-[11px] text-emerald-700">Recording ready to submit: {answer.name}</p>
              <button type="button" onClick={replaceRecording} className="inline-flex items-center gap-2 rounded-lg border border-[#E8E5E1] px-3 py-2 text-[11px] font-semibold text-red-700">
                <RotateCcw aria-hidden="true" className="h-4 w-4" />
                Record again
              </button>
            </div>
          ) : (
            <button type="button" onClick={startRecording} className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-3 py-2 text-[11px] font-semibold text-white">
              <Camera aria-hidden="true" className="h-4 w-4" />
              Start recording
            </button>
          )}
        </>
      )}
      {error && <p role="alert" className="text-[11px] font-medium text-red-700">{error}</p>}
    </div>
  );
};
