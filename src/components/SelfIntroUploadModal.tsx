import React, { useState, useRef, useEffect } from 'react';
import { CandidateDocument, CandidateVideo, User } from '../types';

interface SelfIntroUploadModalProps {
  currentUser: User;
  linkToken?: string;
  reuploadVideo?: CandidateVideo;
  onClose: () => void;
  onSubmit: (videos: CandidateVideo[], emailNotice?: string) => void;
}

export const SelfIntroUploadModal: React.FC<SelfIntroUploadModalProps> = ({
  currentUser,
  linkToken,
  reuploadVideo,
  onClose,
  onSubmit,
}) => {
  const [activeMode, setActiveMode] = useState<'upload' | 'record'>('upload');
  
  // Form fields
  const [candidateName, setCandidateName] = useState(currentUser.name);
  const [candidateEmail, setCandidateEmail] = useState(currentUser.email);
  const [roleApplied, setRoleApplied] = useState(currentUser.title?.replace(/^Candidate for /, '') || 'Senior Frontend Engineer');
  const [submissionType, setSubmissionType] = useState<'self_introduction' | 'technical_interview' | 'portfolio_walkthrough'>('self_introduction');
  const [bio, setBio] = useState('');
  const [selectedVideos, setSelectedVideos] = useState<File[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Recording mode states
  const [isRecording, setIsRecording] = useState(false);
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const [hasRecorded, setHasRecorded] = useState(false);
  const [activePromptIndex, setActivePromptIndex] = useState(0);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<number | null>(null);

  const prompts = [
    '1. Introduce yourself, your technical journey, and key areas of expertise.',
    '2. Highlight your most impactful recent project and architectural decisions.',
    '3. What motivates you about this role and how do you collaborate within engineering teams?',
  ];

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = window.setInterval(() => {
        setRecordedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const handleStartRecord = () => {
    setIsRecording(true);
    setHasRecorded(true);
  };

  const handleStopRecord = () => {
    setIsRecording(false);
  };

  const handleRetake = () => {
    setIsRecording(false);
    setRecordedSeconds(0);
    setHasRecorded(false);
  };

  const handleVideosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(e.currentTarget.files || []);
    if (files.length > 6) {
      setUploadError('Select no more than six videos.');
      e.target.value = '';
      return;
    }
    setSelectedVideos(files);
    setUploadError(null);
  };

  const handleDocumentsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(e.currentTarget.files || []);
    if (files.length > 20) {
      setUploadError('Select no more than 20 supporting documents.');
      e.target.value = '';
      return;
    }
    if (files.some((file) => file.size > 25 * 1024 * 1024)) {
      setUploadError('Each supporting document must be 25 MB or smaller.');
      e.target.value = '';
      return;
    }
    setSelectedDocuments(files);
    setUploadError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reuploadVideo ? selectedVideos.length !== 1 : selectedVideos.length < 1 || selectedVideos.length > 6) {
      setUploadError(reuploadVideo ? 'Choose exactly one replacement video.' : 'Choose between one and six video files.');
      return;
    }
    setIsSubmitting(true);

    try {
      let newVideos: CandidateVideo[];
      let emailNotice = '';
      if (linkToken) {
        const formData = new FormData();
        formData.append('candidateName', candidateName);
        formData.append('candidateEmail', candidateEmail);
        formData.append('roleApplied', roleApplied);
        formData.append('department', '');
        formData.append('submissionType', submissionType);
        formData.append('bio', bio);
        formData.append('keySkills', '');
        selectedVideos.forEach((file) => formData.append('videos', file));
        selectedDocuments.forEach((file) => formData.append('documents', file));
        const uploadPath = reuploadVideo
          ? `/api/public/links/${encodeURIComponent(linkToken)}/reupload/${encodeURIComponent(reuploadVideo.id)}`
          : `/api/public/links/${encodeURIComponent(linkToken)}/upload`;
        const response = await fetch(uploadPath, {
          method: 'POST',
          body: formData,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Video upload failed.');
        if (reuploadVideo) {
          if (!result.video) throw new Error('The server did not confirm the replacement upload.');
          newVideos = [result.video as CandidateVideo];
        } else {
          if (!Array.isArray(result.videos) || result.videos.length === 0) {
            throw new Error('The server did not confirm the video upload.');
          }
          newVideos = result.videos as CandidateVideo[];
        }
        emailNotice = typeof result.emailNotice === 'string' ? result.emailNotice : '';
      } else {
        const submittedAt = new Date().toISOString();
        const documents: CandidateDocument[] = selectedDocuments.map((file, index) => {
          const url = URL.createObjectURL(file);
          return { id: `doc-${Date.now()}-${index}`, name: file.name, mimeType: file.type, size: file.size, url, downloadUrl: url };
        });
        newVideos = selectedVideos.map((file, index) => ({
          id: `vid-${Date.now()}-${index}`,
          candidateName,
          candidateEmail,
          roleApplied,
          department: '',
          submittedAt,
          submittedTimeAgo: 'Just now',
          status: 'pending',
          submissionType,
          keySkills: [],
          bio,
          videoUrl: URL.createObjectURL(file),
          videoDuration: '00:00',
          durationSeconds: 0,
          batchName: 'Candidate Self-Introductions',
          documents,
        }));
      }
      setIsSubmitting(false);
      onSubmit(newVideos, emailNotice);
      onClose();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Video upload failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div
      id="self-intro-upload-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-[#F5DADB] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden text-[#1F1617]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-[#F5DADB] flex justify-between items-center shrink-0 bg-gradient-to-r from-red-50/40 via-white to-red-50/20">
          <div>
            <h3 className="text-base font-bold text-[#1F1617]">{reuploadVideo ? 'Replace Requested Video' : 'Upload Videos & Documents'}</h3>
            <p className="text-xs text-red-900/60 mt-0.5">
              {reuploadVideo ? 'Replace this video using the administrator’s feedback.' : 'Submit up to six videos and attach supporting documents for the hiring team.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6B7280] hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Mode Selector */}
          <div className="flex border border-[#F5DADB] rounded-xl p-1 bg-red-50/30">
            <button
              type="button"
              onClick={() => setActiveMode('upload')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeMode === 'upload'
                  ? 'bg-white text-red-700 font-bold shadow-xs border border-red-100'
                  : 'text-[#6B7280] hover:text-[#1F1617]'
              }`}
            >
              <span className="material-symbols-outlined text-base">upload_file</span>
              Upload Video Files
            </button>
          </div>

          {/* Upload Area */}
          {activeMode === 'upload' ? (
            <div className="border-2 border-dashed border-[#F5DADB] hover:border-red-400 rounded-2xl p-6 text-center transition-colors bg-red-50/15 flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white border border-[#F5DADB] flex items-center justify-center text-red-600 shadow-xs">
                <span className="material-symbols-outlined text-2xl">video_camera_front</span>
              </div>
              <div>
                <p className="font-semibold text-xs text-[#1F1617]">
                  {selectedVideos.length > 0 ? (
                    <span className="text-red-700 font-bold">
                      {selectedVideos.length} video{selectedVideos.length === 1 ? '' : 's'} selected
                    </span>
                  ) : (
                    'Choose up to six video files'
                  )}
                </p>
                <p className="text-[11px] text-red-900/60 mt-1">MP4, WebM, or MOV. Maximum 500 MB per video.</p>
              </div>
              <label className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs shadow-red-500/20">
                <span className="material-symbols-outlined text-sm">folder_open</span>
                <span>Select Videos</span>
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  multiple={!reuploadVideo}
                  required
                  onChange={handleVideosChange}
                  className="hidden"
                />
              </label>
              {selectedVideos.length > 0 && (
                <ul className="w-full space-y-1 text-left">
                  {selectedVideos.map((file, index) => (
                    <li key={`${file.name}-${file.lastModified}`} className="flex items-center justify-between gap-3 text-[11px] text-[#374151]">
                      <span className="truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedVideos((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                        className="text-red-700 hover:text-red-900 font-semibold shrink-0"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            /* Live Recording Simulator */
            <div className="border border-red-950/40 rounded-2xl p-4 bg-[#1F1617] text-white flex flex-col gap-3">
              <div className="relative aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center border border-white/10">
                <div className="text-center p-4">
                  <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-3 border border-white/20">
                    <span className={`material-symbols-outlined text-3xl ${isRecording ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                      {isRecording ? 'fiber_manual_record' : 'videocam'}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-gray-200">
                    {isRecording ? 'Recording Candidate Response...' : hasRecorded ? 'Recording Captured!' : 'Camera & Audio Ready'}
                  </p>
                  <p className="font-mono text-sm font-bold text-white mt-1">
                    {formatTime(recordedSeconds)}
                  </p>
                </div>

                {isRecording && (
                  <div className="absolute top-3 left-3 bg-red-600 text-white px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-1.5 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-white"></span>
                    <span>LIVE RECORDING</span>
                  </div>
                )}
              </div>

              {/* Prompt Carousel */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Interview Prompt Cue</span>
                  <div className="flex gap-1">
                    {prompts.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActivePromptIndex(idx)}
                        className={`w-4 h-4 rounded text-[10px] font-bold flex items-center justify-center cursor-pointer ${
                          activePromptIndex === idx ? 'bg-red-600 text-white' : 'bg-white/10 text-gray-400 hover:text-white'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs font-medium text-red-200">
                  {prompts[activePromptIndex]}
                </p>
              </div>

              {/* Recorder Controls */}
              <div className="flex items-center justify-center gap-3 pt-1">
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={handleStartRecord}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-xs shadow-red-500/20"
                  >
                    <span className="material-symbols-outlined text-sm">fiber_manual_record</span>
                    <span>{hasRecorded ? 'Resume / Record More' : 'Start Recording'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStopRecord}
                    className="px-4 py-2 bg-white text-[#1F1617] hover:bg-gray-100 font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span className="material-symbols-outlined text-sm">stop</span>
                    <span>Stop Recording</span>
                  </button>
                )}

                {hasRecorded && !isRecording && (
                  <button
                    type="button"
                    onClick={handleRetake}
                    className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">refresh</span>
                    <span>Retake</span>
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-[#F5DADB] p-4 space-y-3">
            <div>
              <h4 className="text-xs font-bold text-[#1F1617]">Supporting Documents</h4>
              <p className="text-[11px] text-[#6B7280] mt-1">PDF, DOC, DOCX, JPG, or PNG. Up to 20 files, 25 MB each.</p>
            </div>
            <label className="inline-flex items-center gap-2 px-3 py-2 border border-[#F5DADB] bg-white hover:bg-red-50 rounded-lg text-xs font-semibold cursor-pointer">
              <span className="material-symbols-outlined text-base">attach_file</span>
              <span>Select Documents</span>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"
                multiple
                onChange={handleDocumentsChange}
                className="hidden"
              />
            </label>
            {selectedDocuments.length > 0 && (
              <ul className="space-y-1">
                {selectedDocuments.map((file, index) => (
                  <li key={`${file.name}-${file.lastModified}`} className="flex items-center justify-between gap-3 text-[11px] text-[#374151]">
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedDocuments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      className="text-red-700 hover:text-red-900 font-semibold shrink-0"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Submission Details Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#1F1617] mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                className="w-full rounded-lg border border-[#F5DADB] px-3 py-2 text-xs text-[#1F1617] focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1F1617] mb-1">Email Address *</label>
              <input
                type="email"
                required
                value={candidateEmail}
                onChange={(e) => setCandidateEmail(e.target.value)}
                className="w-full rounded-lg border border-[#F5DADB] px-3 py-2 text-xs text-[#1F1617] focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#1F1617] mb-1">
                Role Applied For *
              </label>
              <input
                type="text"
                required
                value={roleApplied}
                onChange={(e) => setRoleApplied(e.target.value)}
                placeholder="e.g. Senior Frontend Engineer"
                className="w-full rounded-lg border border-[#F5DADB] px-3 py-2 text-xs text-[#1F1617] focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none bg-white"
              />
            </div>

          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1F1617] mb-1">
              Submission Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'self_introduction', label: 'Self Introduction', icon: 'badge' },
                { id: 'technical_interview', label: 'Technical Screen', icon: 'code' },
                { id: 'portfolio_walkthrough', label: 'Portfolio Walkthrough', icon: 'laptop_chromebook' },
              ].map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setSubmissionType(t.id as any)}
                  className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                    submissionType === t.id
                      ? 'border-red-600 bg-red-50/60 font-bold text-red-700 shadow-xs'
                      : 'border-[#F5DADB] text-[#6B7280] hover:border-red-300 hover:text-[#1F1617]'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">{t.icon}</span>
                  <span className="text-[11px]">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1F1617] mb-1">
              Notes
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Brief summary of your background, career highlights, and what you're looking for in this role..."
              className="w-full rounded-lg border border-[#F5DADB] px-3 py-2 text-xs text-[#1F1617] focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none bg-white"
            />
          </div>

          {uploadError && <p role="alert" className="text-xs font-semibold text-red-700">{uploadError}</p>}

          {/* Footer Actions */}
          <div className="pt-2 flex justify-end gap-3 border-t border-[#F5DADB]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#F5DADB] hover:bg-red-50 text-[#1F1617] rounded-lg font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || selectedVideos.length === 0}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-all shadow-xs shadow-red-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
                  <span>Uploading Files...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">send</span>
                  <span>Submit Video Submission</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
