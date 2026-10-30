import React, { useState, useRef, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { CandidateVideo, RubricWeight } from '../types';
import { GENERIC_VIDEO_THUMBNAIL } from '../data/placeholders';
import { adminReviewRubric } from '../data/adminReviewRubric';
import p2pLogo from '../../assets/p2plogo.webp';

interface VideoPlayerEvaluationModalProps {
  video: CandidateVideo;
  rubricWeights: RubricWeight[];
  submissionVideos?: CandidateVideo[];
  onSelectSubmissionVideo?: (video: CandidateVideo) => void;
  onClose: () => void;
  readOnly?: boolean;
  canReviewSubmission?: boolean;
  onReviewSubmission?: (videoId: string, decision: 'accepted' | 'reupload_requested', feedback: string, scores: Record<string, number>) => Promise<CandidateVideo>;
  onSubmitEvaluation: (evaluationData: {
    videoId: string;
    scores: Record<string, number>;
    rubricWeights: RubricWeight[];
    decision: 'selected' | 'rejected';
    notes: string;
  }) => Promise<void>;
}

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
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  // Form states
  const [scores, setScores] = useState<Record<string, number>>(
    () => Object.fromEntries(rubricWeights.map((criterion) => [criterion.id, 0])),
  );
  const [ratedCriteria, setRatedCriteria] = useState<string[]>([]);
  const [decision, setDecision] = useState<'selected' | 'rejected'>('selected');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [evaluationSubmitted, setEvaluationSubmitted] = useState(false);
  const [reviewedVideoIds, setReviewedVideoIds] = useState<string[]>([]);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [adminFeedback, setAdminFeedback] = useState(video.adminFeedback || '');
  const [reviewStatus, setReviewStatus] = useState(video.adminReviewStatus || 'pending');
  const [isSavingAdminReview, setIsSavingAdminReview] = useState(false);
  const [adminReviewScores, setAdminReviewScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(adminReviewRubric.map((criterion) => [
      criterion.id,
      video.adminReviewScores?.[criterion.id] ?? 3,
    ]))
  );

  useEffect(() => {
    setCurrentTime(0);
    setDuration(video.durationSeconds || 300);
    setUseSimulationMode(false);
    setPlaybackError(null);
    setScores(Object.fromEntries(rubricWeights.map((criterion) => [criterion.id, 0])));
    setRatedCriteria([]);
    setDecision('selected');
    setNotes('');
    setEvaluationSubmitted(false);
    setSubmissionError(null);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.load();
    }
  }, [video.id, rubricWeights]);

  useEffect(() => {
    setAdminFeedback(video.adminFeedback || '');
    setReviewStatus(video.adminReviewStatus || 'pending');
    setAdminReviewScores(Object.fromEntries(adminReviewRubric.map((criterion) => [
      criterion.id,
      video.adminReviewScores?.[criterion.id] ?? 3,
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

  const overallScore = Math.round(
    rubricWeights.reduce((total, criterion) => total + (scores[criterion.id] || 1) * criterion.weight, 0) / 5
  );
  const adminOverallRating = adminReviewRubric.reduce((total, criterion) => total + (adminReviewScores[criterion.id] || 1), 0)
    / adminReviewRubric.length;
  const allRubricCriteriaRated = rubricWeights.every((criterion) => ratedCriteria.includes(criterion.id));
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

        const gradient = ctx.createLinearGradient(0, centerY - dynamicHeight, 0, centerY + dynamicHeight);
        gradient.addColorStop(0, '#D81F27');
        gradient.addColorStop(1, '#A5121A');

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
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allRubricCriteriaRated) {
      setSubmissionError('Rate every Standard Evaluation Rubric criterion before submitting.');
      return;
    }
    if (!notes.trim() || notes.trim().length > 4000) {
      setSubmissionError('Feedback is required (maximum 4,000 characters). Explain why the candidate should be recruited or rejected.');
      return;
    }
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
      setReviewedVideoIds((current) => current.includes(video.id) ? current : [...current, video.id]);

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
    const nextQuestion = submissionVideos.find((item) =>
      item.id !== video.id && !reviewedVideoIds.includes(item.id)
    );
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
        <div role="status" className="w-full max-w-md rounded-2xl border border-[#E8E5E1] bg-white p-8 text-center shadow-2xl">
          <img src={p2pLogo} alt="P2P Recruitment" className="mx-auto mb-4 h-14 w-auto object-contain" />
          <span className="material-symbols-outlined text-4xl text-emerald-700" aria-hidden="true">check_circle</span>
          <h2 className="mt-2 text-lg font-extrabold text-[#101010]">Thank you for your review!</h2>
          <p className="mt-2 text-sm text-[#5A5550]">
            Your review for “{video.questionPrompt || 'this question'}” has been submitted.
          </p>
          {nextQuestion && (
            <button
              type="button"
              onClick={() => onSelectSubmissionVideo?.(nextQuestion)}
              className="mt-6 mr-2 rounded-xl bg-red-700 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-800"
            >
              Review next question
            </button>
          )}
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
        <div className="px-6 py-4 border-b border-[#E8E5E1] flex justify-between items-center bg-gradient-to-r from-red-50/50 via-white to-red-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-rose-700 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {video.candidateName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-[#101010]">{video.candidateName}</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 uppercase border border-red-200">
                  {video.roleApplied}
                </span>
                {video.department && (
                  <span className="text-xs text-red-900/60">• {video.department}</span>
                )}
              </div>
              <p className="text-xs text-red-900/60 mt-0.5">Submitted {video.submittedTimeAgo}</p>
              <div className="mt-2 max-w-3xl rounded-lg border border-red-300 bg-red-50 px-3 py-2">
                <span className="block text-[9px] font-extrabold uppercase tracking-wider text-red-700">Question for this video</span>
                <span className="mt-0.5 block text-xs font-bold leading-4 text-[#101010]">{video.questionPrompt || 'No question was specified for this video.'}</span>
              </div>
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
                    {submissionVideo.questionPrompt || `Video ${index + 1}`}
                  </span>
                  <span className="mt-0.5 block text-[9px] text-[#8A8580]">
                    {submissionVideo.status === 'completed'
                      ? `Reviewed · ${submissionVideo.evaluation?.decision || 'scored'}`
                      : 'Awaiting review'}
                  </span>
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
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={() => {
                    setPlaybackError(null);
                    handleLoadedMetadata();
                  }}
                  onEnded={() => setIsPlaying(false)}
                  onError={handleVideoError}
                  onCanPlay={() => setPlaybackError(null)}
                  className="w-full h-full object-contain"
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

              {playbackError && !useSimulationMode && (
                <div role="alert" className="absolute inset-x-4 bottom-16 rounded-lg bg-black/80 px-3 py-2 text-center text-xs text-white">
                  {playbackError}
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
                      onClick={() => {
                        if (isMuted || volume === 0) {
                          setIsMuted(false);
                          setVolume((currentVolume) => currentVolume || 1);
                        } else {
                          setIsMuted(true);
                        }
                      }}
                      className="p-1 hover:bg-white/20 rounded-full transition-colors text-white cursor-pointer"
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
            <div className="bg-[#F5F2EE] rounded-2xl border border-[#E8E5E1] p-4 space-y-4">
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-white p-3 rounded-xl border border-[#E8E5E1]">
                  <span className="text-[10px] font-bold text-red-900/60 uppercase tracking-wider block mb-0.5">Applicant</span>
                  <p className="font-bold text-[#101010] truncate">{video.candidateName}</p>
                  <p className="text-[11px] text-[#8A8580] truncate">{video.candidateEmail}</p>
                </div>

                <div className="bg-white p-3 rounded-xl border border-[#E8E5E1]">
                  <span className="text-[10px] font-bold text-red-900/60 uppercase tracking-wider block mb-0.5">Applied Position</span>
                  <p className="font-bold text-[#101010] truncate">{video.roleApplied}</p>
                  <p className="text-[11px] text-[#8A8580]">{video.department || 'Engineering'}</p>
                </div>

                <div className="bg-white p-3 rounded-xl border border-[#E8E5E1]">
                  <span className="text-[10px] font-bold text-red-900/60 uppercase tracking-wider block mb-0.5">Experience & Batch</span>
                  <p className="font-bold text-[#101010]">{video.experienceYears ? `${video.experienceYears}+ Yrs` : 'Experienced'}</p>
                  <p className="text-[11px] text-[#8A8580] truncate">{video.batchName || 'General Queue'}</p>
                </div>
              </div>

              {video.documents && video.documents.length > 0 && (
                <div className="bg-white p-3 rounded-xl border border-[#E8E5E1] space-y-2">
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-[10px] font-bold text-red-900/60 uppercase tracking-wider">Supporting Documents</span>
                    <span className="text-[10px] text-[#8A8580]">{video.documents.length} files</span>
                  </div>
                  <div className="divide-y divide-red-50">
                    {video.documents.map((document) => (
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
                    <span className="text-xs font-semibold text-[#101010]">
                      {reviewStatus === 'accepted' || video.adminConfirmed
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
                            <option key={item.id} value={item.id}>{item.questionPrompt || `Video ${index + 1}`}</option>
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
                                  onClick={() => setAdminReviewScores((current) => ({ ...current, [criterion.id]: rating }))}
                                  className={`rounded-md p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 ${
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
                  <p className="text-[11px] text-[#8A8580]">The candidate will be emailed automatically when you submit this review.</p>
                  <label className="block text-[11px] font-semibold text-[#101010]" htmlFor="admin-review-feedback">Feedback for candidate</label>
                  <textarea
                    id="admin-review-feedback"
                    rows={3}
                    maxLength={4000}
                    value={adminFeedback}
                    onChange={(event) => setAdminFeedback(event.target.value)}
                    placeholder="Explain why the video is accepted or what needs to change..."
                    className="w-full rounded-lg border border-[#E8E5E1] p-2.5 text-xs focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none"
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => void handleAdminReview('accepted')}
                      disabled={isSavingAdminReview || !adminFeedback.trim()}
                      className="w-full rounded-lg bg-emerald-700 py-2 text-xs font-bold text-white disabled:opacity-50 hover:bg-emerald-800"
                    >
                      {isSavingAdminReview ? 'Saving...' : 'Save Rating & Approve'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleAdminReview('reupload_requested')}
                      disabled={isSavingAdminReview || !adminFeedback.trim()}
                      className="w-full rounded-lg bg-amber-700 py-2 text-xs font-bold text-white disabled:opacity-50 hover:bg-amber-800"
                    >
                      {isSavingAdminReview ? 'Saving...' : 'Request Reupload for This Question'}
                    </button>
                  </div>
                  {submissionError && <p role="alert" className="text-xs font-semibold text-red-700">{submissionError}</p>}
                </div>
              )}
            </div>
          </div>

          {!readOnly && (
          <div className={`${submissionVideos.length > 1 ? 'lg:col-span-4' : 'lg:col-span-5'} p-6 bg-[#F5F2EE]/60 flex flex-col justify-between overflow-y-auto`}>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <h4 className="font-bold text-xs text-[#101010] mb-1">Standard Evaluation Rubric</h4>
                <p className="text-xs text-red-900/60">
                  Rate this question’s video separately. Scores, decision, and feedback apply only to this video.
                </p>
              </div>

              {rubricWeights.map((criterion, index) => (
                <div key={criterion.id} className="bg-white p-3.5 rounded-2xl border border-[#E8E5E1] shadow-xs">
                  <div className="flex justify-between items-center mb-2">
                    <label htmlFor={`rubric-${criterion.id}`} className="text-xs font-semibold text-[#101010]">
                      {index + 1}. {criterion.name} <span className="text-[#8A8580]">({criterion.weight}%)</span>
                    </label>
                    <span className={`text-xs font-extrabold ${ratedCriteria.includes(criterion.id) ? 'text-red-600' : 'text-amber-700'}`}>
                      {ratedCriteria.includes(criterion.id) ? `${scores[criterion.id]} / 5` : 'Required'}
                    </span>
                  </div>
                  <input
                    id={`rubric-${criterion.id}`}
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={scores[criterion.id] || 1}
                    onChange={(e) => {
                      setScores((previous) => ({ ...previous, [criterion.id]: Number(e.target.value) }));
                      setRatedCriteria((previous) => previous.includes(criterion.id) ? previous : [...previous, criterion.id]);
                    }}
                    className="w-full accent-red-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[#8A8580] mt-1">
                    <span>Unsatisfactory</span>
                    <span>Adequate</span>
                    <span className="font-medium text-red-700">Exemplary</span>
                  </div>
                </div>
              ))}

              {/* Review Notes */}
              <div>
                <label htmlFor="employer-evaluation-feedback" className="block text-xs font-semibold text-[#101010] mb-1.5">
                Feedback for this question
                </label>
                <textarea
                  id="employer-evaluation-feedback"
                  rows={3}
                  required
                  maxLength={4000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={decision === 'selected'
                    ? 'Explain why you recommend recruiting this candidate.'
                    : 'Explain the specific reasons you recommend rejecting this candidate.'}
                  className="w-full rounded-xl border border-[#E8E5E1] p-3 text-xs text-[#101010] bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none transition-all"
                />
              </div>

              {/* Hiring Decision */}
              <div>
                <label className="block text-xs font-semibold text-[#101010] mb-2">Decision</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDecision('selected')}
                    className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      decision === 'selected'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-white border border-[#E8E5E1] text-[#5A5550] hover:bg-red-50'
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
                        : 'bg-white border border-[#E8E5E1] text-[#5A5550] hover:bg-red-50'
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
                  disabled={isSubmitting}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-red-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
                >
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  {isSubmitting ? 'Submitting review...' : 'Submit decision and review'}
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
