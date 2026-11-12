import React, { useState, useRef, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { CandidateDocument, CandidateVideo } from '../types';
import { GENERIC_VIDEO_THUMBNAIL } from '../data/placeholders';
import { adminReviewRubric, standardEvaluationRubric } from '../data/adminReviewRubric';
import p2pLogo from '../../assets/p2plogo.webp';

interface VideoPlayerEvaluationModalProps {
  video: CandidateVideo;
  submissionVideos?: CandidateVideo[];
  onSelectSubmissionVideo?: (video: CandidateVideo) => void;
  onClose: () => void;
  readOnly?: boolean;
  canReviewSubmission?: boolean;
  onReviewSubmission?: (videoId: string, decision: 'accepted' | 'reupload_requested', feedback: string, scores: Record<string, number>) => Promise<CandidateVideo>;
  onFinalSubmitReview?: (submissionId: string) => Promise<void>;
  onSubmitEvaluation: (evaluationData: {
    decision: 'selected' | 'rejected';
    scores: Record<string, number>;
    notes: string;
  }) => Promise<void>;
}

export const VideoPlayerEvaluationModal: React.FC<VideoPlayerEvaluationModalProps> = ({
  video,
  submissionVideos = [],
  onSelectSubmissionVideo,
  onClose,
  readOnly = false,
  canReviewSubmission = false,
  onReviewSubmission,
  onFinalSubmitReview,
  onSubmitEvaluation,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simTimerRef = useRef<number | null>(null);
  const submissionDocumentList: CandidateDocument[] = submissionVideos.length
    ? submissionVideos.flatMap((item) => item.documents || [])
    : video.documents || [];
  const submissionDocuments = Array.from(new Map(
    submissionDocumentList.map((document): [string, CandidateDocument] => [[
        document.name.trim().toLocaleLowerCase(),
        document.mimeType.trim().toLocaleLowerCase(),
        document.size,
      ].join(':'), document] as const),
  ).values());
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(Number.isFinite(video.durationSeconds) && video.durationSeconds > 0
    ? video.durationSeconds
    : 300);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [useSimulationMode, setUseSimulationMode] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(standardEvaluationRubric.map((criterion) => [criterion.id, 0])),
  );
  const [ratedCriteria, setRatedCriteria] = useState<string[]>([]);
  const [decision, setDecision] = useState<'selected' | 'rejected'>('selected');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [evaluationSubmitted, setEvaluationSubmitted] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [adminFeedback, setAdminFeedback] = useState(video.adminFeedback || '');
  const [reviewStatus, setReviewStatus] = useState(video.adminReviewStatus || 'pending');
  const [isSavingAdminReview, setIsSavingAdminReview] = useState(false);
  const [adminReviewScores, setAdminReviewScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(adminReviewRubric.map((criterion) => [
      criterion.id,
      video.adminReviewScores?.[criterion.id] ?? 0,
    ]))
  );
  const [isFinalSubmitting, setIsFinalSubmitting] = useState(false);

  useEffect(() => {
    setCurrentTime(0);
    setDuration(Number.isFinite(video.durationSeconds) && video.durationSeconds > 0
      ? video.durationSeconds
      : 300);
    setUseSimulationMode(false);
    setPlaybackError(null);
    setEvaluationSubmitted(false);
    setSubmissionError(null);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.load();
    }
  }, [video.id]);

  useEffect(() => {
    setAdminFeedback(video.adminFeedback || '');
    setReviewStatus(video.adminReviewStatus || 'pending');
    setAdminReviewScores(Object.fromEntries(adminReviewRubric.map((criterion) => [
      criterion.id,
      video.adminReviewScores?.[criterion.id] ?? 0,
    ])));
  }, [video.id, video.adminConfirmed, video.adminFeedback, video.adminReviewStatus]);

  useEffect(() => {
    setIsMuted(false);
    setVolume(1);
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.volume = 1;
    }
  }, [video.id]);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = isMuted || volume === 0;
    videoRef.current.volume = volume;
  }, [isMuted, volume, video.id]);

  const adminOverallRating = adminReviewRubric.reduce((total, criterion) => total + (adminReviewScores[criterion.id] ?? 0), 0)
    / adminReviewRubric.length;
  const allAdminRatingsSet = adminReviewRubric.every((criterion) => adminReviewScores[criterion.id] >= 1);
  const employerOverallRating = standardEvaluationRubric.reduce(
    (total, criterion) => total + (scores[criterion.id] ?? 0),
    0,
  ) / standardEvaluationRubric.length;
  const allEmployerRatingsSet = standardEvaluationRubric.every((criterion) => ratedCriteria.includes(criterion.id));
  const hasVideoPicker = (canReviewSubmission || !readOnly) && submissionVideos.length > 1;
  const adminReviewLocked = reviewStatus !== 'pending' || Boolean(video.adminConfirmed);
  const allSubmissionVideosReviewed = submissionVideos.length > 0
    && submissionVideos.every((item) => item.adminReviewStatus && item.adminReviewStatus !== 'pending');
  const overallReviewSubmitted = submissionVideos.length > 0
    && submissionVideos.every((item) => Boolean(item.adminReviewSubmittedAt));
  const submissionId = video.submissionId || video.submissionBatchId || video.id;

  // Simulation timer loop
  useEffect(() => {
    if (useSimulationMode && isPlaying) {
      const interval = 100 / playbackRate;
      simTimerRef.current = window.setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= duration) {
            setIsPlaying(false);
            return duration;
          }
          return Math.min(duration, prev + 0.1);
        });
      }, interval);
    } else {
      if (simTimerRef.current) {
        clearInterval(simTimerRef.current);
        simTimerRef.current = null;
      }
    }
    return () => {
      if (simTimerRef.current) clearInterval(simTimerRef.current);
    };
  }, [useSimulationMode, isPlaying, playbackRate, duration]);

  // Canvas visualizer animation for simulation mode
  useEffect(() => {
    if (!useSimulationMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let phase = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Dark studio background
      ctx.fillStyle = '#101010';
      ctx.fillRect(0, 0, width, height);

      // Draw subtle grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw Audio Waveform / Frequency Bars at bottom center
      const barCount = 36;
      const barWidth = 6;
      const spacing = 4;
      const totalBarWidth = barCount * (barWidth + spacing);
      const startX = (width - totalBarWidth) / 2;
      const centerY = height - 60;

      for (let i = 0; i < barCount; i++) {
        const x = startX + i * (barWidth + spacing);
        const dynamicHeight = isPlaying
          ? Math.sin(phase + i * 0.35) * 20 + Math.cos(phase * 1.5 + i * 0.2) * 15 + 30
          : 6;

        ctx.fillStyle = '#DC2626';
        ctx.beginPath();
        ctx.roundRect(x, centerY - dynamicHeight / 2, barWidth, dynamicHeight, 3);
        ctx.fill();
      }

      phase += isPlaying ? 0.08 * playbackRate : 0.01;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [useSimulationMode, isPlaying, playbackRate]);

  const handleVideoError = () => {
    const mediaError = videoRef.current?.error;
    console.error(`Could not play the submitted video for ${video.candidateName}.`, mediaError);
    setPlaybackError('This uploaded video could not be played. Try refreshing the page or re-uploading it.');
    setIsPlaying(false);
  };

  const togglePlay = () => {
    if (useSimulationMode) {
      setIsPlaying((prev) => !prev);
    } else if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setPlaybackError(null);
              setIsPlaying(true);
            })
            .catch((error: unknown) => {
              console.error('Could not start playback for the submitted video.', error);
              setPlaybackError('Could not start video playback. Use the player controls to try again.');
            });
        }
      }
    } else {
      setIsPlaying((prev) => !prev);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && !useSimulationMode) {
      const time = videoRef.current.currentTime;
      setCurrentTime(Number.isFinite(time) && time >= 0 ? time : 0);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current && !useSimulationMode) {
      const metadataDuration = videoRef.current.duration;
      const fallbackDuration = video.durationSeconds;
      setDuration(Number.isFinite(metadataDuration) && metadataDuration > 0
        ? metadataDuration
        : Number.isFinite(fallbackDuration) && fallbackDuration > 0 ? fallbackDuration : 300);
    }
  };

  const seekTo = (seconds: number) => {
    const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.min(duration, seconds)) : 0;
    setCurrentTime(safeSeconds);
    if (!useSimulationMode && videoRef.current) {
      videoRef.current.currentTime = safeSeconds;
      if (!isPlaying) {
        videoRef.current.play().then(() => {
          setPlaybackError(null);
          setIsPlaying(true);
        }).catch((error: unknown) => {
          console.error('Could not seek and play the submitted video.', error);
          setPlaybackError('Could not start video playback. Use the player controls to try again.');
        });
      }
    } else {
      if (!isPlaying) setIsPlaying(true);
    }
  };

  const changeSpeed = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current && !useSimulationMode) {
      videoRef.current.playbackRate = rate;
    }
  };

  const formatSeconds = (sec: number) => {
    const safeSeconds = Number.isFinite(sec) && sec >= 0 ? Math.floor(sec) : 0;
    const m = Math.floor(safeSeconds / 60);
    const s = Math.floor(safeSeconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allEmployerRatingsSet) {
      setSubmissionError('Rate every Standard Evaluation Rubric criterion before submitting.');
      return;
    }
    if (!notes.trim() || notes.trim().length > 4000) {
      setSubmissionError('Add overall feedback (maximum 4,000 characters) before submitting.');
      return;
    }
    setIsSubmitting(true);
    setSubmissionError(null);
    try {
      await onSubmitEvaluation({ decision, scores, notes: notes.trim() });

      // Confetti celebration
      try {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
        });
      } catch {
        // ignore
      }

      setEvaluationSubmitted(true);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Could not submit the evaluation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (evaluationSubmitted) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
        <div role="status" className="w-full max-w-md rounded-2xl border border-[#E8E5E1] bg-white p-8 text-center shadow-2xl">
          <img src={p2pLogo} alt="P2P Recruitment" className="mx-auto mb-4 h-14 w-auto object-contain" />
          <span className="material-symbols-outlined text-4xl text-emerald-700" aria-hidden="true">check_circle</span>
          <h2 className="mt-2 text-lg font-extrabold text-[#101010]">
            Overall review submitted
            <span className="mt-1 block">{video.candidateName}</span>
          </h2>
          <button type="button" onClick={onClose} className="mt-6 rounded-xl bg-[#101010] px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700">
            Done
          </button>
        </div>
      </div>
    );
  }

  const toggleFullscreen = async () => {
    const mediaContainer = mediaContainerRef.current;
    if (!mediaContainer) return;
    if (document.fullscreenElement === mediaContainer) {
      await document.exitFullscreen();
    } else {
      await mediaContainer.requestFullscreen();
    }
  };

  const handleAdminReview = async (decision: 'accepted' | 'reupload_requested') => {
    if (!onReviewSubmission) return;
    if (!adminFeedback.trim()) {
      setSubmissionError('Add feedback before submitting this review.');
      return;
    }
    setIsSavingAdminReview(true);
    setSubmissionError(null);
    try {
      const reviewedVideo = await onReviewSubmission(video.id, decision, adminFeedback.trim(), adminReviewScores);
      setReviewStatus(reviewedVideo.adminReviewStatus || decision);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Could not save this review.');
    } finally {
      setIsSavingAdminReview(false);
    }
  };

  return (
    <div
      id="video-evaluation-modal"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-[#E8E5E1] animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#E8E5E1] flex justify-between items-center bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {video.candidateName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-[#101010]">{video.candidateName}</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 uppercase border border-red-200">
                  {video.roleApplied}
                </span>
              </div>
              <p className="text-xs text-red-900/60 mt-0.5">Submitted {video.submittedTimeAgo}</p>
              <div className="mt-2 max-w-3xl rounded-lg border border-red-300 bg-red-50 px-3 py-2">
                <span className="block text-[9px] font-extrabold uppercase tracking-wider text-red-700">Question {video.questionNumber || submissionVideos.findIndex((item) => item.id === video.id) + 1}</span>
                <span className="mt-0.5 block text-xs font-bold leading-4 text-[#101010]">{video.questionPrompt || 'No question was specified for this video.'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 text-[#8A8580] hover:text-red-700 hover:bg-red-50 rounded-full transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        </div>

        {/* Modal Body: 2 Columns (Left Video Player & Candidate Profile, Right Evaluation Rubric) */}
        <div className={`flex-1 grid grid-cols-1 ${hasVideoPicker || !readOnly ? 'lg:grid-cols-12' : ''} overflow-y-auto`}>
          {hasVideoPicker && (
            <aside className="lg:col-span-2 border-r border-[#E8E5E1] bg-red-50/30 p-3 space-y-2">
              <h4 className="px-1 text-[10px] font-bold uppercase tracking-wider text-red-900/60">Submission videos</h4>
              {submissionVideos.map((submissionVideo, index) => (
                <button
                  key={submissionVideo.id}
                  type="button"
                  onClick={() => onSelectSubmissionVideo?.(submissionVideo)}
                  className={`w-full rounded-xl border p-2 text-left ${
                    submissionVideo.id === video.id
                      ? 'border-red-500 bg-white shadow-xs'
                      : 'border-transparent bg-white/60 hover:border-red-200'
                  }`}
                >
                  <span className="block text-[10px] font-bold text-[#101010]">
                    Question {submissionVideo.questionNumber || index + 1}
                  </span>
                  <span className="mt-0.5 block text-[9px] leading-4 text-[#5A5550]">
                    {submissionVideo.questionPrompt || 'Question not specified'}
                  </span>
                  {canReviewSubmission && <span className="mt-0.5 block text-[9px] text-[#8A8580]">
                    <span className={
                      submissionVideo.adminReviewStatus === 'accepted'
                        ? 'font-semibold text-emerald-700'
                        : submissionVideo.adminReviewStatus === 'reupload_requested'
                          ? 'font-semibold text-red-700'
                          : ''
                    }>
                      {submissionVideo.adminReviewStatus === 'accepted'
                        ? 'Approved'
                        : submissionVideo.adminReviewStatus === 'reupload_requested'
                          ? 'Reupload requested'
                          : submissionVideo.status === 'completed'
                            ? `Reviewed · ${submissionVideo.evaluation?.decision || 'scored'}`
                            : 'Awaiting review'}
                    </span>
                  </span>}
                </button>
              ))}
            </aside>
          )}
          {/* Left Column: Video Player + Candidate Profile (7 cols) */}
          <div className={`${readOnly ? hasVideoPicker ? 'lg:col-span-10' : '' : submissionVideos.length > 1 ? 'lg:col-span-6' : 'lg:col-span-7'} p-6 ${readOnly ? '' : 'border-r border-[#E8E5E1]'} flex flex-col gap-5 bg-white`}>
            {/* Video Player Card */}
            <div ref={mediaContainerRef} className="relative rounded-2xl overflow-hidden bg-black aspect-video flex flex-col justify-end shadow-xs group select-none">
              {!useSimulationMode ? (
                <video
                  ref={videoRef}
                  src={video.videoUrl}
                  poster={video.thumbnailUrl || GENERIC_VIDEO_THUMBNAIL}
                  onClick={togglePlay}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={() => {
                    setPlaybackError(null);
                    handleLoadedMetadata();
                  }}
                  onEnded={() => setIsPlaying(false)}
                  onError={handleVideoError}
                  onCanPlay={() => setPlaybackError(null)}
                  className="w-full h-full object-contain"
                  aria-label={`Video response for question ${video.questionNumber || 1}`}
                  playsInline
                  muted={isMuted}
                />
              ) : (
                <div className="relative w-full h-full">
                  <canvas ref={canvasRef} width={640} height={360} className="w-full h-full object-cover" />
                  <div className="absolute inset-x-4 top-4 rounded-lg bg-black/80 px-3 py-2 text-center text-xs font-semibold text-white">
                    Demo animation — this is not the candidate&apos;s submitted video.
                  </div>
                </div>
              )}

              {!isPlaying && !useSimulationMode && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    togglePlay();
                  }}
                  aria-label="Play video"
                  className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow-lg transition-colors hover:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <span className="material-symbols-outlined text-6xl" aria-hidden="true">play_arrow</span>
                </button>
              )}

              {playbackError && !useSimulationMode && (
                <div role="alert" className="absolute inset-x-4 bottom-16 rounded-lg bg-black/80 px-3 py-2 text-center text-xs text-white">
                  {playbackError}
                </div>
              )}

              {/* Video Overlay Controls */}
              <div className="absolute inset-x-0 bottom-0 bg-black/80 p-4 flex flex-col gap-2">
                {/* Scrubber */}
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={(e) => seekTo(Number(e.target.value))}
                  className="w-full h-1.5 bg-white/30 accent-white rounded-lg cursor-pointer"
                />

                <div className="flex items-center justify-between text-white text-xs">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={togglePlay}
                      className="p-1.5 hover:bg-white/20 transition-colors flex items-center justify-center cursor-pointer"
                      title={isPlaying ? 'Pause' : 'Play'}
                      aria-label={isPlaying ? 'Pause video' : 'Play video'}
                      aria-pressed={isPlaying}
                    >
                      <span className="material-symbols-outlined text-2xl">
                        {isPlaying ? 'pause' : 'play_arrow'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (isMuted || volume === 0) {
                          setIsMuted(false);
                          setVolume((currentVolume) => currentVolume || 1);
                        } else {
                          setIsMuted(true);
                        }
                      }}
                      className="p-1 hover:bg-white/20 transition-colors text-white cursor-pointer"
                      title={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
                    >
                      <span className="material-symbols-outlined text-lg">
                        {isMuted || volume === 0 ? 'volume_off' : 'volume_up'}
                      </span>
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      aria-label="Video volume"
                      title="Video volume"
                      onChange={(event) => {
                        const nextVolume = Number(event.target.value);
                        setVolume(nextVolume);
                        setIsMuted(nextVolume === 0);
                      }}
                      className="w-16 accent-white"
                    />

                    <span className="font-mono text-xs">
                      {formatSeconds(currentTime)} / {formatSeconds(duration)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleFullscreen}
                      className="p-1 hover:bg-white/20 rounded-full transition-colors text-white cursor-pointer"
                      title="Toggle full screen"
                    >
                      <span className="material-symbols-outlined text-lg">fullscreen</span>
                    </button>
                    {/* Switch Mode Button */}
                    <button
                      type="button"
                      onClick={() => {
                        if (!useSimulationMode) videoRef.current?.pause();
                        setIsPlaying(false);
                        setPlaybackError(null);
                        setUseSimulationMode((current) => !current);
                      }}
                      aria-pressed={useSimulationMode}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer mr-1 hidden sm:inline-flex items-center gap-1"
                      title="Show a demo animation instead of the candidate's submitted video"
                    >
                      <span className="material-symbols-outlined text-[12px]">tune</span>
                      {useSimulationMode ? 'Exit demo' : 'Demo animation'}
                    </button>

                    <span className="text-[11px] text-gray-300">Speed:</span>
                    {[1, 1.25, 1.5, 2].map((spd) => (
                      <button
                        type="button"
                        key={spd}
                        onClick={() => changeSpeed(spd)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                          playbackRate === spd ? 'bg-white text-black' : 'bg-white/20 hover:bg-white/30 text-white'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Candidate Submission Profile & Assessment Overview */}
            <div className="bg-[#FFFFFF] rounded-2xl border border-[#E8E5E1] p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-[#E8E5E1] pb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-red-600 text-lg">badge</span>
                  <h4 className="font-bold text-xs text-[#101010] uppercase tracking-wider">Candidate Submission Overview</h4>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-white border border-[#E8E5E1] text-red-700 text-[10px] font-bold">
                  {video.submissionType === 'self_introduction' ? 'Self-Introduction Video' : 'Video Assessment'}
                </span>
              </div>

              {/* Candidate Info Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-white p-3 rounded-xl border border-[#E8E5E1]">
                  <span className="text-[10px] font-bold text-red-900/60 uppercase tracking-wider block mb-0.5">Applicant</span>
                  <p className="font-bold text-[#101010] truncate">{video.candidateName}</p>
                  <p className="text-[11px] text-[#8A8580] truncate">{video.candidateEmail}</p>
                </div>

                <div className="bg-white p-3 rounded-xl border border-[#E8E5E1]">
                  <span className="text-[10px] font-bold text-red-900/60 uppercase tracking-wider block mb-0.5">Applied Position</span>
                  <p className="font-bold text-[#101010] truncate">{video.roleApplied}</p>
                </div>
              </div>

              {submissionDocuments.length > 0 && (
                <div className="bg-white p-3 rounded-xl border border-[#E8E5E1] space-y-2">
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-[10px] font-bold text-red-900/60 uppercase tracking-wider">Supporting Documents</span>
                    <span className="text-[10px] text-[#8A8580]">{submissionDocuments.length} files</span>
                  </div>
                  <div className="divide-y divide-red-50">
                    {submissionDocuments.map((document) => (
                      <div key={document.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                        <span className="text-[11px] font-medium text-[#101010] truncate">{document.name}</span>
                        <span className="flex items-center gap-3 shrink-0">
                          <a href={document.url} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-red-700 hover:underline">View</a>
                          <a href={document.downloadUrl || document.url} download={document.name} className="text-[11px] font-semibold text-red-700 hover:underline">Download</a>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {canReviewSubmission && (
                <div className="rounded-xl border border-[#E8E5E1] bg-white p-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`text-xs font-semibold ${
                      reviewStatus === 'accepted' || video.adminConfirmed
                        ? 'text-emerald-700'
                        : reviewStatus === 'reupload_requested' ? 'text-red-700' : 'text-[#101010]'
                    }`}>
                      {overallReviewSubmitted
                        ? 'Overall review submitted'
                        : reviewStatus === 'accepted' || video.adminConfirmed
                        ? 'Approved for Manager / Employer verification'
                        : reviewStatus === 'reupload_requested' ? 'Reupload requested' : 'Awaiting admin review'}
                    </span>
                  </div>
                  {submissionVideos.length > 1 && (
                    <label className="block text-[11px] font-semibold text-[#101010]">
                        Question to review or request reupload
                        <select
                          value={video.id}
                          onChange={(event) => {
                            const nextVideo = submissionVideos.find((item) => item.id === event.target.value);
                            if (nextVideo) onSelectSubmissionVideo?.(nextVideo);
                          }}
                          className="mt-1 w-full rounded-lg border border-[#E8E5E1] bg-white px-2.5 py-2 text-xs font-normal text-[#101010] focus:border-red-500 focus:outline-none"
                        >
                          {submissionVideos.map((item, index) => (
                            <option key={item.id} value={item.id}>Question {item.questionNumber || index + 1}: {item.questionPrompt || 'Question not specified'}</option>
                          ))}
                        </select>
                    </label>
                  )}
                  <div className="rounded-lg border border-red-200 bg-red-50/50 p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <div>
                          <h5 className="text-xs font-extrabold text-[#101010]">Admin question rating</h5>
                          <p className="text-[10px] text-[#5A5550]">Rate each area from 1 to 5.</p>
                        </div>
                        <span className="rounded-lg bg-[#101010] px-2.5 py-1 text-[11px] font-extrabold text-white">
                          Overall {adminOverallRating.toFixed(1)} / 5
                        </span>
                    </div>
                    {!allAdminRatingsSet && (
                      <p className="mb-2 text-[10px] text-[#5A5550]">Ratings start at 0. Select at least 1 star for each area before saving.</p>
                    )}
                    <div className="space-y-2">
                        {adminReviewRubric.map((criterion) => (
                          <div key={criterion.id} className="rounded-lg bg-white px-2.5 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-semibold text-[#101010]">{criterion.name}</span>
                              <span className="text-[10px] font-extrabold text-red-700">{adminReviewScores[criterion.id]} / 5</span>
                            </div>
                            <div className="mt-1.5 flex items-center gap-1" role="group" aria-label={`${criterion.name} star rating`}>
                              {[1, 2, 3, 4, 5].map((rating) => (
                                <button
                                  key={rating}
                                  type="button"
                                  aria-label={`${criterion.name}: rate ${rating} out of 5`}
                                  aria-pressed={adminReviewScores[criterion.id] >= rating}
                                  title={`${rating} out of 5`}
                                  disabled={adminReviewLocked}
                                  onClick={() => setAdminReviewScores((current) => ({ ...current, [criterion.id]: rating }))}
                                  className={`rounded-md p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:cursor-not-allowed ${
                                    adminReviewScores[criterion.id] >= rating
                                      ? 'text-amber-400'
                                      : 'text-[#C8C4C0] hover:text-amber-300'
                                  }`}
                                >
                                  <span className="material-symbols-outlined block text-[20px] leading-5" aria-hidden="true">star</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-[#8A8580]">
                    Save each question review, then use final submit to apply the review statuses.
                  </p>
                  <label className="block text-[11px] font-semibold text-[#101010]" htmlFor="admin-review-feedback">Feedback for candidate</label>
                  <textarea
                    id="admin-review-feedback"
                    rows={3}
                    maxLength={4000}
                    value={adminFeedback}
                    onChange={(event) => setAdminFeedback(event.target.value)}
                    disabled={adminReviewLocked}
                    placeholder="Explain why the video is accepted or what needs to change..."
                    className="w-full rounded-lg border border-[#E8E5E1] p-2.5 text-xs focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => void handleAdminReview('accepted')}
                      disabled={isSavingAdminReview || adminReviewLocked || !allAdminRatingsSet || !adminFeedback.trim()}
                      className="w-full rounded-lg bg-emerald-700 py-2 text-xs font-bold text-white disabled:opacity-50 hover:bg-emerald-800"
                    >
                      {isSavingAdminReview ? 'Saving...' : adminReviewLocked ? 'Review saved' : 'Save Rating & Approve'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleAdminReview('reupload_requested')}
                      disabled={isSavingAdminReview || adminReviewLocked || !allAdminRatingsSet || !adminFeedback.trim()}
                      className="w-full rounded-lg bg-red-700 py-2 text-xs font-bold text-white disabled:opacity-50 hover:bg-red-800"
                    >
                      {isSavingAdminReview ? 'Saving...' : 'Request Reupload for This Question'}
                    </button>
                  </div>
                  {allSubmissionVideosReviewed && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!onFinalSubmitReview) return;
                        setIsFinalSubmitting(true);
                        setSubmissionError(null);
                        void onFinalSubmitReview(submissionId)
                          .catch((error: unknown) => {
                            setSubmissionError(error instanceof Error ? error.message : 'Could not submit the overall review.');
                          })
                          .finally(() => setIsFinalSubmitting(false));
                      }}
                      disabled={isFinalSubmitting || overallReviewSubmitted || !onFinalSubmitReview}
                      className="w-full rounded-lg bg-red-600 py-2.5 text-xs font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isFinalSubmitting ? 'Submitting overall review...' : overallReviewSubmitted ? 'Overall review submitted' : 'Final submit'}
                    </button>
                  )}
                  {submissionError && <p role="alert" className="text-xs font-semibold text-red-700">{submissionError}</p>}
                </div>
              )}
            </div>
          </div>

          {!readOnly && (
          <div className={`${submissionVideos.length > 1 ? 'lg:col-span-4' : 'lg:col-span-5'} p-6 bg-[#FFFFFF]/60 flex flex-col justify-between overflow-y-auto`}>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <h4 className="font-bold text-xs text-[#101010] mb-1">Overall candidate review</h4>
                <p className="text-xs text-red-900/60">
                  Rate the complete submission once. The same rubric applies to all videos.
                </p>
              </div>

              <section className="rounded-2xl border border-[#E8E5E1] bg-white p-3.5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h5 className="text-xs font-bold text-[#101010]">Standard Evaluation Rubric</h5>
                    <p className="text-[10px] text-[#8A8580]">One rating per criterion for the full submission.</p>
                  </div>
                  <span className="text-[11px] font-extrabold text-[#5A5550]">{employerOverallRating.toFixed(1)} / 5</span>
                </div>
                <div className="space-y-2.5">
                  {standardEvaluationRubric.map((criterion) => (
                    <div key={criterion.id} className="rounded-xl border border-[#E8E5E1] p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-[#101010]">{criterion.name}</span>
                        <span className="text-[10px] font-bold text-[#5A5550]">
                          {ratedCriteria.includes(criterion.id) ? `${scores[criterion.id]} / 5` : 'Required'}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1" role="group" aria-label={`${criterion.name} star rating`}>
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            aria-label={`${criterion.name}: rate ${rating} out of 5`}
                            aria-pressed={scores[criterion.id] >= rating}
                            onClick={() => {
                              setScores((previous) => ({ ...previous, [criterion.id]: rating }));
                              setRatedCriteria((previous) => previous.includes(criterion.id)
                                ? previous
                                : [...previous, criterion.id]);
                            }}
                            className={`rounded-md p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 ${
                              scores[criterion.id] >= rating ? 'text-amber-400' : 'text-[#C8C4C0] hover:text-amber-300'
                            }`}
                          >
                            <span className="material-symbols-outlined block text-[20px] leading-5" aria-hidden="true">star</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDecision('selected')}
                  aria-pressed={decision === 'selected'}
                  className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    decision === 'selected'
                      ? 'border-2 border-emerald-700 bg-emerald-700 text-white shadow-md ring-2 ring-emerald-200'
                      : 'bg-white border border-[#E8E5E1] text-[#5A5550] hover:bg-emerald-50'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">check_circle</span>
                  Recruit Candidate
                </button>

                <button
                  type="button"
                  onClick={() => setDecision('rejected')}
                  aria-pressed={decision === 'rejected'}
                  className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    decision === 'rejected'
                      ? 'border-2 border-red-700 bg-red-700 text-white shadow-md ring-2 ring-red-200'
                      : 'bg-white border border-[#E8E5E1] text-[#5A5550] hover:bg-red-50'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">cancel</span>
                  Reject Candidate
                </button>
              </div>

              <label className="block text-xs font-semibold text-[#101010]" htmlFor="employer-overall-feedback">
                Overall feedback
                <textarea
                  id="employer-overall-feedback"
                  rows={6}
                  required
                  maxLength={4000}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder={decision === 'selected'
                    ? 'Explain why you recommend recruiting this candidate.'
                    : 'Explain why you recommend rejecting this candidate.'}
                  className="mt-1.5 w-full rounded-xl border border-[#E8E5E1] bg-white p-3 text-xs text-[#101010] focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </label>

              <div className="pt-2">
                {!allEmployerRatingsSet && (
                  <p className="mb-2 text-xs text-[#8A8580]">Rate every rubric criterion before submitting.</p>
                )}
                {submissionError && <p role="alert" className="mb-2 text-xs font-semibold text-red-700">{submissionError}</p>}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-xl bg-red-600 py-3 text-xs font-bold text-white shadow-sm shadow-red-500/20 transition-all hover:bg-red-700 active:scale-[0.99] disabled:opacity-75"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
          )}
        </div>
      </div>
    </div>
  );
};
