import React, { useState } from 'react';
import { CandidateVideo, InviteLink, User } from '../types';
import { SelfIntroUploadModal } from './SelfIntroUploadModal';
import { groupVideosBySubmission } from '../utils/submissions';

interface CandidatePortalViewProps {
  currentUser: User;
  videos: CandidateVideo[];
  uploadLinks: InviteLink[];
  onUploadNewVideos?: (newVideos: CandidateVideo[], emailNotice?: string) => void;
  linkToken?: string;
  canCreateSubmission?: boolean;
}

interface ReuploadRequestProps {
  video: CandidateVideo;
  currentUser: User;
  linkToken?: string;
  requestReason?: string;
  feedback?: string;
  onUploaded: (video: CandidateVideo, emailNotice?: string) => void;
}

const ReuploadRequest: React.FC<ReuploadRequestProps> = ({
  video,
  currentUser,
  linkToken,
  requestReason = 'Admin requested a replacement',
  feedback,
  onUploaded,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitReupload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file || !linkToken) {
      setError('Choose the replacement video using your upload link.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('candidateName', currentUser.name);
      formData.append('candidateEmail', currentUser.email);
      formData.append('roleApplied', video.roleApplied);
      formData.append('department', video.department);
      formData.append('submissionType', video.submissionType || 'self_introduction');
      formData.append('bio', video.bio || '');
      formData.append('keySkills', (video.keySkills || []).join(','));
      formData.append('videos', file);
      const response = await fetch(
        `/api/public/links/${encodeURIComponent(linkToken)}/reupload/${encodeURIComponent(video.id)}`,
        { method: 'POST', body: formData },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not upload the replacement video.');
      if (!result.video) throw new Error('The server did not confirm the replacement upload.');
      onUploaded(result.video as CandidateVideo, typeof result.emailNotice === 'string' ? result.emailNotice : '');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not upload the replacement video.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={submitReupload} className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-bold text-amber-950">{requestReason}</h3>
        <p className="text-xs text-amber-900 mt-1">{feedback || video.adminFeedback || 'Please upload a replacement video for review.'}</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <label className="flex-1 text-xs font-semibold text-[#1F1617]">
          Replacement video
          <input
            required
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            className="mt-1 block w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs"
          />
        </label>
        <button type="submit" disabled={!file || isSubmitting || !linkToken} className="px-4 py-2.5 rounded-xl bg-amber-700 text-white text-xs font-bold disabled:opacity-50">
          {isSubmitting ? 'Uploading...' : 'Submit replacement'}
        </button>
      </div>
      {error && <p role="alert" className="text-xs font-semibold text-red-700">{error}</p>}
    </form>
  );
};

export const CandidatePortalView: React.FC<CandidatePortalViewProps> = ({
  currentUser,
  videos,
  uploadLinks,
  onUploadNewVideos,
  linkToken,
  canCreateSubmission = true,
}) => {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [replacementSubmittedIds, setReplacementSubmittedIds] = useState<string[]>([]);
  const candidateVideos = videos.filter((video) =>
    video.candidateEmail.toLowerCase() === currentUser.email.toLowerCase()
    || video.candidateName.toLowerCase() === currentUser.name.toLowerCase()
  );
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="bg-white p-6 rounded-2xl border border-[#F5DADB] shadow-xs">
        <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 text-[11px] font-bold border border-red-200">
          Candidate Assessment Hub
        </span>
        <h2 className="mt-3 text-2xl font-extrabold text-[#1F1617]">Welcome, {currentUser.name}</h2>
        <p className="text-xs text-red-900/60 mt-1">Your dashboard shows upload access and any action requested by the recruitment team.</p>
      </header>

      <section className="bg-white border border-[#F5DADB] rounded-2xl p-5 space-y-3">
        <div>
          <h3 className="text-sm font-bold text-[#1F1617]">Your video upload links</h3>
          <p className="text-[11px] text-[#6B7280] mt-0.5">Expired, submitted, or revoked links are inactive. A replacement request remains available below.</p>
        </div>
        {uploadLinks.length === 0 ? (
          <p className="rounded-xl bg-gray-50 p-4 text-xs text-[#6B7280]">No upload link is associated with this session.</p>
        ) : (
          <ul className="divide-y divide-red-50">
            {uploadLinks.map((link) => {
              const active = link.status === 'active' && new Date(link.expiresAt) > new Date();
              return (
                <li key={link.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-xs font-bold text-[#1F1617]">Video submission access</p>
                    <p className="text-[11px] text-[#6B7280]">Submission ID: <span className="font-mono">{link.submissionId || link.id}</span></p>
                    <p className="text-[11px] text-[#6B7280]">Expires {new Date(link.expiresAt).toLocaleString()}</p>
                  </div>
                  <span className={`self-start px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                    {active ? 'Active' : 'Inactive'}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-bold text-[#1F1617]">Submission status and admin feedback</h3>
          <p className="text-[11px] text-[#6B7280] mt-0.5">Return using this same link to view approval or reupload decisions.</p>
        </div>
        {groupVideosBySubmission(candidateVideos).map((submission) => (
          <div key={submission.id} className="rounded-2xl border border-[#F5DADB] bg-red-50/30 p-3 space-y-3">
          <p className="px-1 text-[10px] font-bold uppercase tracking-wide text-[#6B7280]">
            Submission ID: <span className="font-mono normal-case">{submission.id}</span> · {submission.videos.length} video{submission.videos.length === 1 ? '' : 's'}
          </p>
          {submission.videos.some((video) => video.status === 'completed' && (video.evaluation?.decision === 'rejected' || video.evaluation?.decision === 'reject')) && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-900">
            <p className="text-xs font-bold">Manager / Employer decision: this submission was rejected</p>
            <p className="mt-1 text-[11px]">This decision applies to the whole submission, not to individual videos.</p>
            {submission.videos.find((video) => video.evaluation?.decision === 'rejected' || video.evaluation?.decision === 'reject')?.evaluation?.notes && (
              <p className="mt-2 whitespace-pre-wrap text-xs">
                {submission.videos.find((video) => video.evaluation?.decision === 'rejected' || video.evaluation?.decision === 'reject')?.evaluation?.notes}
              </p>
            )}
          </div>
          )}
          {submission.videos.map((video, index) => {
          const managerRejected = video.status === 'completed' && (video.evaluation?.decision === 'rejected' || video.evaluation?.decision === 'reject');
          const awaitingReupload = video.adminReviewStatus === 'reupload_requested'
            || managerRejected;
          const canReupload = awaitingReupload && !replacementSubmittedIds.includes(video.id);
          const approved = !managerRejected && video.adminReviewStatus === 'accepted' && video.adminConfirmed;
          const reuploadedAwaitingApproval = video.wasReuploaded && video.adminReviewStatus === 'pending';
          const status = approved
            ? 'Approved'
            : managerRejected
            ? 'Replacement available'
            : video.adminReviewStatus === 'reupload_requested'
            ? 'Reupload requested'
            : reuploadedAwaitingApproval
            ? 'Replacement received · waiting for admin approval'
            : 'Awaiting admin review';
          return (
            <article key={video.id} className={`rounded-xl border p-4 space-y-3 ${
              approved ? 'border-emerald-200 bg-emerald-50/60'
                : video.adminReviewStatus === 'reupload_requested' ? 'border-amber-200 bg-amber-50/60'
                : 'border-[#F5DADB] bg-white'
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-[#1F1617]">Video {index + 1} · {video.roleApplied}</h4>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  approved ? 'bg-emerald-100 text-emerald-800'
                    : video.adminReviewStatus === 'reupload_requested' ? 'bg-amber-100 text-amber-900'
                    : 'bg-gray-100 text-gray-700'
                }`}>{status}</span>
              </div>
              {video.adminFeedback && (
                <div className={`rounded-lg p-3 text-xs ${
                  approved ? 'bg-white text-emerald-950' : 'bg-white text-amber-950'
                }`}>
                  <p className="font-bold">{approved ? 'Admin approval message' : 'Admin feedback'}</p>
                  <p className="mt-1 whitespace-pre-wrap">{video.adminFeedback}</p>
                </div>
              )}
              {video.previousAdminFeedback && video.wasReuploaded && (
                <div className="rounded-lg bg-white/80 p-3 text-xs text-[#6B7280]">
                  <p className="font-bold">Previous reupload request</p>
                  <p className="mt-1 whitespace-pre-wrap">{video.previousAdminFeedback}</p>
                </div>
              )}
              {canReupload && (
                <ReuploadRequest
                  video={video}
                  currentUser={currentUser}
                  linkToken={linkToken}
                  requestReason={managerRejected ? 'A replacement video is requested after review' : 'A replacement video was requested'}
                  feedback={managerRejected ? video.evaluation?.notes : video.adminFeedback}
                  onUploaded={(replacement, emailNotice) => {
                    setReplacementSubmittedIds((ids) => [...ids, video.id]);
                    onUploadNewVideos?.([replacement], emailNotice);
                  }}
                />
              )}
            </article>
          );
          })}
          </div>
        ))}
        {candidateVideos.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[#E9C8CA] bg-white p-6 text-center">
            <span className="material-symbols-outlined text-2xl text-[#9CA3AF]">hourglass_empty</span>
            <p className="mt-1 text-xs font-semibold text-[#1F1617]">Your submitted videos will appear here with their review status.</p>
          </div>
        )}
      </section>

      {canCreateSubmission && (
        <div className="bg-white border border-[#F5DADB] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#1F1617]">Ready to submit?</h3>
            <p className="text-[11px] text-[#6B7280] mt-0.5">Upload your requested video and supporting documents using the active invitation.</p>
          </div>
          <button type="button" onClick={() => setShowUploadModal(true)} className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold">
            Upload submission
          </button>
        </div>
      )}

      {showUploadModal && (
        <SelfIntroUploadModal
          currentUser={currentUser}
          linkToken={linkToken}
          onClose={() => setShowUploadModal(false)}
          onSubmit={(newVideos, emailNotice) => onUploadNewVideos?.(newVideos, emailNotice)}
        />
      )}
    </div>
  );
};
