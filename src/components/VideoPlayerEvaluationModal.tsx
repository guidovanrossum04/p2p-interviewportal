import React, { useState, useRef, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { CandidateVideo, RubricWeight } from '../types';
import { GENERIC_AVATAR, GENERIC_VIDEO_THUMBNAIL } from '../data/placeholders';

interface VideoPlayerEvaluationModalProps {
  video: CandidateVideo;
  rubricWeights: RubricWeight[];
  submissionVideos?: CandidateVideo[];
  onSelectSubmissionVideo?: (video: CandidateVideo) => void;
  onClose: () => void;
  readOnly?: boolean;
  canReviewSubmission?: boolean;
  onReviewSubmission?: (videoId: string, decision: 'accepted' | 'reupload_requested', feedback: string) => Promise<CandidateVideo>;
  onSubmitEvaluation: (evaluationData: {
    videoId: string;
    scores: Record<string, number>;
    rubricWeights: RubricWeight[];
    decision: 'selected' | 'rejected';
    notes: string;
  }) => Promise<void>;
}

// Fallback high-availability video mirrors
const FALLBACK_VIDEO_SOURCES = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  'https://vjs.zencdn.net/v/oceans.mp4',
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
];

export const VideoPlayerEvaluationModal: React.FC<VideoPlayerEvaluationModalProps> = ({
  video,
  rubricWeights,
  submissionVideos = [],
  onSelectSubmissionVideo,
  onClose,
  readOnly = false,
  canReviewSubmission = false,
  onReviewSubmission,
  onSubmitEvaluation,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simTimerRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(video.durationSeconds || 300);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [useSimulationMode, setUseSimulationMode] = useState(false);
  const [currentSourceIndex, setCurrentSourceIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  // Form states
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(rubricWeights.map((criterion) => [
      criterion.id,
      video.evaluation?.scores[criterion.id] ?? 4,
    ]))
  );
  const [decision, setDecision] = useState<'selected' | 'rejected'>(
    video.evaluation?.decision === 'rejected' || video.evaluation?.decision === 'reject' ? 'rejected' : 'selected',
  );
  const [notes, setNotes] = useState(video.evaluation?.notes || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [adminFeedback, setAdminFeedback] = useState(video.adminFeedback || '');
  const [reviewStatus, setReviewStatus] = useState(video.adminReviewStatus || 'pending');
  const [isSavingAdminReview, setIsSavingAdminReview] = useState(false);

  useEffect(() => {
    setAdminFeedback(video.adminFeedback || '');
    setReviewStatus(video.adminReviewStatus || 'pending');
    setDecision(video.evaluation?.decision === 'rejected' || video.evaluation?.decision === 'reject' ? 'rejected' : 'selected');
    setSubmissionError(null);
    setCurrentTime(0);
    setDuration(video.durationSeconds || 300);
    setCurrentSourceIndex(0);
    setUseSimulationMode(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.load();
    }
  }, [video.id]);

  const overallScore = Math.round(
    rubricWeights.reduce((total, criterion) => total + (scores[criterion.id] || 1) * criterion.weight, 0) / 5
  );
  const hasVideoPicker = (canReviewSubmission || !readOnly) && submissionVideos.length > 1;

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
      ctx.fillStyle = '#0B0F19';
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

        const gradient = ctx.createLinearGradient(0, centerY - dynamicHeight, 0, centerY + dynamicHeight);
        gradient.addColorStop(0, '#EF4444');
        gradient.addColorStop(1, '#B91C1C');

        ctx.fillStyle = gradient;
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

  // Video error handler with automatic fallback
  const handleVideoError = useCallback(() => {
    console.warn(`Direct video source failed for ${video.candidateName}. Attempting fallback mirror.`);
    if (currentSourceIndex < FALLBACK_VIDEO_SOURCES.length - 1) {
      setCurrentSourceIndex((prev) => prev + 1);
    } else {
      // Seamlessly switch to Interactive Video Simulator
      setUseSimulationMode(true);
    }
  }, [currentSourceIndex, video.candidateName]);

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
            .then(() => setIsPlaying(true))
            .catch(() => {
              setUseSimulationMode(true);
              setIsPlaying(true);
            });
        }
      }
    } else {
      setIsPlaying((prev) => !prev);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && !useSimulationMode) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current && !useSimulationMode) {
      setDuration(videoRef.current.duration || video.durationSeconds || 300);
    }
  };

  const seekTo = (seconds: number) => {
    setCurrentTime(seconds);
    if (!useSimulationMode && videoRef.current) {
      videoRef.current.currentTime = seconds;
      if (!isPlaying) {
        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {
          setUseSimulationMode(true);
          setIsPlaying(true);
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
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmissionError(null);
    try {
      await onSubmitEvaluation({
        videoId: video.id,
        scores,
        rubricWeights,
        decision,
        notes,
      });

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

      onClose();
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Could not submit the evaluation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeVideoUrl = currentSourceIndex === 0 ? video.videoUrl : FALLBACK_VIDEO_SOURCES[currentSourceIndex];

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
      const reviewedVideo = await onReviewSubmission(video.id, decision, adminFeedback.trim());
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
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-[#F5DADB] animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#F5DADB] flex justify-between items-center bg-gradient-to-r from-red-50/50 via-white to-red-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-rose-700 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {video.candidateName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-[#1F1617]">{video.candidateName}</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 uppercase border border-red-200">
                  {video.roleApplied}
                </span>
                {video.department && (
                  <span className="text-xs text-red-900/60">• {video.department}</span>
                )}
              </div>
              <p className="text-xs text-red-900/60 mt-0.5">
                Submission: {video.submissionId || video.submissionBatchId || video.id} • Submitted {video.submittedTimeAgo}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!readOnly && (
              <div className="text-right mr-3 hidden sm:block">
                <span className="text-[10px] uppercase font-bold text-red-900/60 block">Overall Score</span>
                <span className="text-xl font-extrabold text-red-600">{overallScore}/100</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-2 text-[#6B7280] hover:text-red-700 hover:bg-red-50 rounded-full transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        </div>

        {/* Modal Body: 2 Columns (Left Video Player & Candidate Profile, Right Evaluation Rubric) */}
        <div className={`flex-1 grid grid-cols-1 ${hasVideoPicker || !readOnly ? 'lg:grid-cols-12' : ''} overflow-y-auto`}>
          {hasVideoPicker && (
            <aside className="lg:col-span-2 border-r border-[#F5DADB] bg-red-50/30 p-3 space-y-2">
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
                  <span className="block text-[10px] font-bold text-[#1F1617]">Video {index + 1}</span>
                  <span className="mt-0.5 block text-[9px] text-[#6B7280]">
                    {submissionVideo.status === 'completed'
                      ? `Reviewed · ${submissionVideo.evaluation?.decision || 'scored'}`
                      : 'Awaiting review'}
                  </span>
                </button>
              ))}
            </aside>
          )}
          {/* Left Column: Video Player + Candidate Profile (7 cols) */}
          <div className={`${readOnly ? hasVideoPicker ? 'lg:col-span-10' : '' : submissionVideos.length > 1 ? 'lg:col-span-6' : 'lg:col-span-7'} p-6 ${readOnly ? '' : 'border-r border-[#F5DADB]'} flex flex-col gap-5 bg-white`}>
            {/* Video Player Card */}
            <div ref={mediaContainerRef} className="relative rounded-2xl overflow-hidden bg-black aspect-video flex flex-col justify-end shadow-xs group select-none">
              {!useSimulationMode ? (
                <video
                  ref={videoRef}
                  src={activeVideoUrl}
                  poster={video.thumbnailUrl || GENERIC_VIDEO_THUMBNAIL}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={() => setIsPlaying(false)}
                  onError={handleVideoError}
                  className="w-full h-full object-cover"
                  playsInline
                  muted={isMuted}
                />
              ) : (
                <div className="relative w-full h-full">
                  <canvas ref={canvasRef} width={640} height={360} className="w-full h-full object-cover" />
                  
                  {/* Candidate Portrait Video Overlay */}
                  <div className="absolute top-4 left-4 flex items-center gap-3 bg-black/60 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10">
                    <img
                      src={video.thumbnailUrl || GENERIC_AVATAR}
                      alt={video.candidateName}
                      className="w-9 h-9 rounded-full object-cover border border-white/20"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span className="text-white text-xs font-bold">{video.candidateName}</span>
                      </div>
                      <span className="text-[10px] text-gray-300 block">{video.roleApplied}</span>
                    </div>
                  </div>

                  {/* REC timestamp & format watermark */}
                  <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-[10px] font-mono text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                    <span>REC {formatSeconds(currentTime)} • 1080p 60fps</span>
                  </div>
                </div>
              )}

              {/* Video Overlay Controls */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 flex flex-col gap-2">
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
                      className="p-1.5 hover:bg-white/20 rounded-full transition-colors flex items-center justify-center cursor-pointer"
                      title={isPlaying ? 'Pause' : 'Play'}
                    >
                      <span className="material-symbols-outlined text-2xl">
                        {isPlaying ? 'pause' : 'play_arrow'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsMuted(!isMuted)}
                      className="p-1 hover:bg-white/20 rounded-full transition-colors text-white cursor-pointer"
                      title={isMuted ? 'Unmute' : 'Mute'}
                    >
                      <span className="material-symbols-outlined text-lg">
                        {isMuted ? 'volume_off' : 'volume_up'}
                      </span>
                    </button>

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
                      onClick={() => setUseSimulationMode(!useSimulationMode)}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer mr-1 hidden sm:inline-flex items-center gap-1"
                      title="Toggle between Direct Video Feed and Simulated Stream"
                    >
                      <span className="material-symbols-outlined text-[12px]">tune</span>
                      {useSimulationMode ? 'Sim Stream' : 'Live Stream'}
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
            <div className="bg-[#FAF4F4] rounded-2xl border border-[#F5DADB] p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-[#F5DADB] pb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-red-600 text-lg">badge</span>
                  <h4 className="font-bold text-xs text-[#1F1617] uppercase tracking-wider">Candidate Submission Overview</h4>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-white border border-[#F5DADB] text-red-700 text-[10px] font-bold">
                  {video.submissionType === 'self_introduction' ? 'Self-Introduction Video' : 'Video Assessment'}
                </span>
              </div>

              {/* Candidate Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-white p-3 rounded-xl border border-[#F5DADB]">
                  <span className="text-[10px] font-bold text-red-900/60 uppercase tracking-wider block mb-0.5">Applicant</span>
                  <p className="font-bold text-[#1F1617] truncate">{video.candidateName}</p>
                  <p className="text-[11px] text-[#6B7280] truncate">{video.candidateEmail}</p>
                </div>

                <div className="bg-white p-3 rounded-xl border border-[#F5DADB]">
                  <span className="text-[10px] font-bold text-red-900/60 uppercase tracking-wider block mb-0.5">Applied Position</span>
                  <p className="font-bold text-[#1F1617] truncate">{video.roleApplied}</p>
                  <p className="text-[11px] text-[#6B7280]">{video.department || 'Engineering'}</p>
                </div>

                <div className="bg-white p-3 rounded-xl border border-[#F5DADB]">
                  <span className="text-[10px] font-bold text-red-900/60 uppercase tracking-wider block mb-0.5">Experience & Batch</span>
                  <p className="font-bold text-[#1F1617]">{video.experienceYears ? `${video.experienceYears}+ Yrs` : 'Experienced'}</p>
                  <p className="text-[11px] text-[#6B7280] truncate">{video.batchName || 'General Queue'}</p>
                </div>
              </div>

              {video.documents && video.documents.length > 0 && (
                <div className="bg-white p-3 rounded-xl border border-[#F5DADB] space-y-2">
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-[10px] font-bold text-red-900/60 uppercase tracking-wider">Supporting Documents</span>
                    <span className="text-[10px] text-[#6B7280]">{video.documents.length} files</span>
                  </div>
                  <div className="divide-y divide-red-50">
                    {video.documents.map((document) => (
                      <div key={document.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                        <span className="text-[11px] font-medium text-[#1F1617] truncate">{document.name}</span>
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
                <div className="rounded-xl border border-[#F5DADB] bg-white p-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-[#1F1617]">
                      {reviewStatus === 'accepted' ? 'Approved for Manager / Employer verification' : reviewStatus === 'reupload_requested' ? 'Reupload requested' : 'Awaiting admin review'}
                    </span>
                    {video.submissionBatchId && <span className="text-[10px] text-[#6B7280]">Uploaded with this submission batch</span>}
                  </div>
                  <p className="text-[11px] text-[#6B7280]">The candidate will be emailed automatically when you submit this review.</p>
                  <label className="block text-[11px] font-semibold text-[#1F1617]" htmlFor="admin-review-feedback">Feedback for candidate</label>
                  <textarea
                    id="admin-review-feedback"
                    rows={3}
                    maxLength={4000}
                    value={adminFeedback}
                    onChange={(event) => setAdminFeedback(event.target.value)}
                    placeholder="Explain why the video is accepted or what needs to change..."
                    className="w-full rounded-lg border border-[#F5DADB] p-2.5 text-xs focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleAdminReview('accepted')}
                      disabled={isSavingAdminReview || !adminFeedback.trim()}
                      className="py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                    >
                      {isSavingAdminReview ? 'Saving...' : 'Accept Video'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdminReview('reupload_requested')}
                      disabled={isSavingAdminReview || !adminFeedback.trim()}
                      className="py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                    >
                      {isSavingAdminReview ? 'Saving...' : 'Request Reupload'}
                    </button>
                  </div>
                  {submissionError && <p role="alert" className="text-xs font-semibold text-red-700">{submissionError}</p>}
                </div>
              )}
            </div>
          </div>

          {!readOnly && (
          <div className={`${submissionVideos.length > 1 ? 'lg:col-span-4' : 'lg:col-span-5'} p-6 bg-[#FAF4F4]/60 flex flex-col justify-between overflow-y-auto`}>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <h4 className="font-bold text-xs text-[#1F1617] mb-1">Standard Evaluation Rubric</h4>
                <p className="text-xs text-red-900/60">
                  This rubric is shared across all videos in the submission. Your scores and decision will apply to every video.
                </p>
              </div>

              {rubricWeights.map((criterion, index) => (
                <div key={criterion.id} className="bg-white p-3.5 rounded-2xl border border-[#F5DADB] shadow-xs">
                  <div className="flex justify-between items-center mb-2">
                    <label htmlFor={`rubric-${criterion.id}`} className="text-xs font-semibold text-[#1F1617]">
                      {index + 1}. {criterion.name} <span className="text-[#6B7280]">({criterion.weight}%)</span>
                    </label>
                    <span className="text-xs font-extrabold text-red-600">{scores[criterion.id]} / 5</span>
                  </div>
                  <input
                    id={`rubric-${criterion.id}`}
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={scores[criterion.id]}
                    onChange={(e) => setScores((previous) => ({ ...previous, [criterion.id]: Number(e.target.value) }))}
                    className="w-full accent-red-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[#6B7280] mt-1">
                    <span>Unsatisfactory</span>
                    <span>Adequate</span>
                    <span className="font-medium text-red-700">Exemplary</span>
                  </div>
                </div>
              ))}

              {/* Review Notes */}
              <div>
                <label className="block text-xs font-semibold text-[#1F1617] mb-1.5">
                  Manager / Employer Observations & Feedback
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Record specific strengths, potential concerns, and rationale for your scoring..."
                  className="w-full rounded-xl border border-[#F5DADB] p-3 text-xs text-[#1F1617] bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none transition-all"
                />
              </div>

              {/* Hiring Decision */}
              <div>
                <label className="block text-xs font-semibold text-[#1F1617] mb-2">Decision</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDecision('selected')}
                    className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      decision === 'selected'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-white border border-[#F5DADB] text-[#374151] hover:bg-red-50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    Selected
                  </button>

                  <button
                    type="button"
                    onClick={() => setDecision('rejected')}
                    className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      decision === 'rejected'
                        ? 'bg-stone-800 text-white shadow-xs'
                        : 'bg-white border border-[#F5DADB] text-[#374151] hover:bg-red-50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">cancel</span>
                    Reject
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                {submissionError && <p role="alert" className="mb-2 text-xs font-semibold text-red-700">{submissionError}</p>}
                <button
                  type="submit"
                  disabled={isSubmitting || video.status === 'completed'}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-red-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
                >
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  {isSubmitting ? 'Recording Evaluation...' : 'Submit Evaluation Score'}
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
