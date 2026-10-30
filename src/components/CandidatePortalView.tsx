import React, { useState } from 'react';
import { Camera, Upload } from 'lucide-react';
import { CandidateAnswerMode, CandidateVideo, InviteLink, User } from '../types';
import { SelfIntroUploadModal } from './SelfIntroUploadModal';
import { CandidateVideoResponseInput } from './CandidateVideoResponseInput';
import p2pLogo from '../../assets/p2plogo.webp';

interface RequestedRetakeProps {
  video: CandidateVideo;
  linkToken?: string;
  answerMode: CandidateAnswerMode;
  onUploaded: (video: CandidateVideo, emailNotice?: string) => void;
}

const RequestedRetake: React.FC<RequestedRetakeProps> = ({ video, linkToken, answerMode, onUploaded }) => {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitRetake = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file || !linkToken) {
      setError('Choose the requested replacement video.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('candidateName', video.candidateName);
      formData.append('candidateEmail', video.candidateEmail);
      formData.append('roleApplied', video.roleApplied);
      formData.append('department', video.department);
      formData.append('answerMode', answerMode);
      formData.append('submissionType', video.submissionType || 'self_introduction');
      formData.append('bio', video.bio || '');
      formData.append('keySkills', (video.keySkills || []).join(','));
      formData.append('videos', file);
      const response = await fetch(`/api/public/links/${encodeURIComponent(linkToken)}/reupload/${encodeURIComponent(video.id)}`, {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not upload the requested replacement video.');
      if (!result.video) throw new Error('The server did not confirm the replacement upload.');
      onUploaded(result.video as CandidateVideo, typeof result.emailNotice === 'string' ? result.emailNotice : '');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not upload the requested replacement video.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={submitRetake} className="rounded-xl border border-red-300 bg-red-50/50 p-4">
      <p className="text-[10px] font-extrabold uppercase tracking-wide text-red-700">Admin requested a retake</p>
      <h3 className="mt-1 text-xs font-bold leading-5 text-[#101010]">{video.questionPrompt || 'Requested video response'}</h3>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <CandidateVideoResponseInput
            answerMode={answerMode}
            questionNumber={1}
            answer={file}
            onChange={setFile}
          />
        </div>
        <button type="submit" disabled={!file || isSubmitting || !linkToken} className="rounded-xl bg-red-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
          {isSubmitting ? 'Submitting...' : answerMode === 'record' ? 'Submit recorded video' : 'Upload replacement video'}
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-xs font-semibold text-red-700">{error}</p>}
    </form>
  );
};

interface CandidatePortalViewProps {
  currentUser: User;
  videos: CandidateVideo[];
  uploadLinks: InviteLink[];
  onUploadNewVideos?: (newVideos: CandidateVideo[], emailNotice?: string) => void;
  linkToken?: string;
  canCreateSubmission?: boolean;
}

export const CandidatePortalView: React.FC<CandidatePortalViewProps> = ({
  currentUser,
  videos,
  uploadLinks,
  onUploadNewVideos,
  linkToken,
  canCreateSubmission = true,
}) => {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [submissionReceived, setSubmissionReceived] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const requestedRetakes = videos.filter((video) =>
    video.candidateEmail.toLowerCase() === currentUser.email.toLowerCase()
    && video.adminReviewStatus === 'reupload_requested'
  );
  const activeUploadLink = uploadLinks.find((link) => link.token === linkToken) || uploadLinks[0];
  const invitationNote = activeUploadLink?.notes?.trim() || '';
  const invitationLines = invitationNote.split(/\r?\n/);
  const invitationSubjectLine = invitationLines[0]?.match(/^Subject Line:\s*(.+)$/i);
  const invitationSubject = invitationSubjectLine?.[1]?.trim();
  const invitationContentLines = (invitationSubjectLine ? invitationLines.slice(1) : invitationLines)
    .filter((line, index, lines) => line.trim() || (index > 0 && index < lines.length - 1));
  const signoffIndex = invitationContentLines.findIndex((line) => line.trim().toLowerCase() === 'kind regards');
  const invitationMessage = (signoffIndex >= 0 ? invitationContentLines.slice(0, signoffIndex) : invitationContentLines).join('\n').trim();
  const invitationSignoff = signoffIndex >= 0
    ? invitationContentLines.slice(signoffIndex).filter((line) => line.trim())
    : [];
  const currentUploads = videos.filter((video) =>
    video.candidateEmail.toLowerCase() === currentUser.email.toLowerCase()
  );
  const uploadStatusLabel = (video: CandidateVideo) => {
    if (video.adminReviewStatus === 'reupload_requested') return 'Retake requested';
    if (video.adminReviewStatus === 'accepted') return 'Approved';
    if (video.adminConfirmed) return 'Reviewed';
    if (video.status === 'completed') return 'Reviewed';
    return 'Submitted · awaiting review';
  };
  const canSubmitNewVideos = canCreateSubmission && !submissionReceived && activeUploadLink?.status === 'active';
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="bg-white p-6 rounded-2xl border border-[#E8E5E1] shadow-xs">
        <h2 className="text-2xl font-extrabold text-[#101010]">Welcome, {currentUser.name}</h2>
        <p className="text-xs text-red-900/60 mt-1">Use your active invitation to upload the requested video responses.</p>
        {invitationNote && (
          <section aria-label="Invitation message" className="mt-5 overflow-hidden rounded-xl border border-[#E8E5E1] bg-white">
            <div className="flex items-center gap-3 border-b border-[#E8E5E1] bg-[#F5F2EE] px-4 py-3">
              <img src={p2pLogo} alt="P2P Recruitment" className="h-10 w-auto object-contain" />
              <div className="text-[10px] text-[#5A5550]">
                <p><strong>From:</strong> P2P Recruitment</p>
                <p><strong>To:</strong> {activeUploadLink?.recipientEmail || currentUser.email}</p>
              </div>
            </div>
            {invitationSubject && (
              <div className="border-b border-[#E8E5E1] px-4 py-3 text-xs">
                <span className="font-bold text-[#5A5550]">Subject: </span>
                <span className="font-semibold text-[#101010]">{invitationSubject}</span>
              </div>
            )}
            <div className="px-4 py-4 text-xs leading-6 text-[#101010]">
              <p className="whitespace-pre-line">{invitationMessage}</p>
              {invitationSignoff.length > 0 && (
                <div className="mt-5 border-l-2 border-red-600 pl-3 leading-5">
                  {invitationSignoff.map((line, index) => (
                    <p key={`${index}-${line}`} className={index === invitationSignoff.length - 1
                      ? 'mt-1 italic text-[#5A5550]'
                      : index === 2 ? 'font-bold text-[#101010]' : 'text-[#101010]'}>
                      {line}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </header>

      {currentUploads.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-[#E8E5E1] bg-white">
          <div className="border-b border-[#E8E5E1] px-5 py-4">
            <h3 className="text-sm font-bold text-[#101010]">Your submitted videos</h3>
          </div>
          <ul className="divide-y divide-[#F1EEEA] px-5">
            {currentUploads.map((video, index) => (
              <li key={video.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#101010]">
                    Video {index + 1}{video.questionPrompt ? ` · ${video.questionPrompt}` : ''}
                  </p>
                  {video.adminFeedback && video.adminReviewStatus === 'reupload_requested' && (
                    <p className="mt-1 whitespace-pre-wrap text-[11px] text-[#101010]">
                      Admin feedback: {video.adminFeedback}
                    </p>
                  )}
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  video.adminReviewStatus === 'accepted'
                    ? 'bg-emerald-50 text-emerald-800'
                    : video.adminReviewStatus === 'reupload_requested'
                    ? 'bg-amber-50 text-amber-900'
                    : 'bg-[#F5F2EE] text-[#101010]'
                }`}>
                  {uploadStatusLabel(video)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {requestedRetakes.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-bold text-[#101010]">Videos requested by the admin</h3>
          {requestedRetakes.map((video) => (
            <RequestedRetake
              key={video.id}
              video={video}
              linkToken={linkToken}
              answerMode={activeUploadLink?.answerMode || 'upload'}
              onUploaded={(replacement) => {
                onUploadNewVideos?.([replacement]);
                setSubmissionReceived(true);
                setShowSuccessModal(true);
              }}
            />
          ))}
        </section>
      )}

      {canSubmitNewVideos && (
        <div className="bg-white border border-[#E8E5E1] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#101010]">Ready to submit?</h3>
            <p className="text-[11px] text-[#8A8580] mt-0.5">
              {activeUploadLink?.answerMode === 'record'
                ? 'Record the requested video responses using the active invitation.'
                : 'Upload the requested video responses using the active invitation.'}
            </p>
          </div>
          <button type="button" onClick={() => setShowUploadModal(true)} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-700">
            {activeUploadLink?.answerMode === 'record'
              ? <Camera aria-hidden="true" className="h-4 w-4" />
              : <Upload aria-hidden="true" className="h-4 w-4" />}
            {activeUploadLink?.answerMode === 'record' ? 'Record submission' : 'Upload submission'}
          </button>
        </div>
      )}

      {showUploadModal && (
        <SelfIntroUploadModal
          currentUser={currentUser}
          linkToken={linkToken}
          requiredVideoCount={activeUploadLink?.videoCount || 1}
          questionPrompt={activeUploadLink?.questionPrompts?.length ? activeUploadLink.questionPrompts : activeUploadLink?.questionPrompt}
          answerMode={activeUploadLink?.answerMode || 'upload'}
          onClose={() => setShowUploadModal(false)}
          onSubmit={(newVideos) => {
            onUploadNewVideos?.(newVideos);
            setSubmissionReceived(true);
            setShowSuccessModal(true);
          }}
        />
      )}

      {showSuccessModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" role="presentation">
          <div role="status" aria-live="polite" className="w-full max-w-md rounded-2xl border border-[#E8E5E1] bg-white p-8 text-center shadow-2xl">
            <img src={p2pLogo} alt="P2P Recruitment" className="mx-auto mb-4 h-14 w-auto object-contain" />
            <span className="material-symbols-outlined text-4xl text-emerald-700" aria-hidden="true">check_circle</span>
            <h2 className="mt-2 text-lg font-extrabold text-[#101010]">Thank you for your submission!</h2>
            <p className="mt-2 text-sm text-[#101010]">P2P will contact you after your submission has been reviewed.</p>
            <button type="button" onClick={() => setShowSuccessModal(false)} className="mt-6 rounded-xl bg-[#101010] px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
