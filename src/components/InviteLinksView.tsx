import React, { useEffect, useState } from 'react';
import { CandidateVideo, InviteLink, InviteType } from '../types';
import { getSubmissionId } from '../utils/submissions';

interface InviteLinksViewProps {
  inviteLinks: InviteLink[];
  videos: CandidateVideo[];
  page: number;
  pageSize: number;
  total: number;
  isLoading: boolean;
  onQueryChange: (page: number, type: string, status: string, search: string) => void;
  onReviewVideo: (video: CandidateVideo) => void;
  onOpenCreateLink: () => void;
  onRevokeLink: (id: string) => Promise<void>;
  onExtendExpiry: (id: string, expiresAt: string) => Promise<void>;
}

const toDateTimeLocalValue = (date: Date) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
};

export const InviteLinksView: React.FC<InviteLinksViewProps> = ({
  inviteLinks,
  videos,
  page,
  pageSize,
  total,
  isLoading,
  onQueryChange,
  onReviewVideo,
  onOpenCreateLink,
  onRevokeLink,
  onExtendExpiry,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'candidate' | 'evaluator'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyErrorId, setCopyErrorId] = useState<string | null>(null);
  const [editingExpiryId, setEditingExpiryId] = useState<string | null>(null);
  const [expiryDraft, setExpiryDraft] = useState('');
  const [expiryError, setExpiryError] = useState<string | null>(null);
  const [expandedDetailsId, setExpandedDetailsId] = useState<string | null>(null);
  const [reviewingInviteId, setReviewingInviteId] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => onQueryChange(page, filterType, filterStatus, search), 250);
    return () => window.clearTimeout(timeout);
  }, [page, filterType, filterStatus, search, onQueryChange]);

  const getFullUrl = (token: string, type: InviteType) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/?portal=${type}&token=${encodeURIComponent(token)}`;
  };

  const handleCopy = async (id: string, token: string, type: InviteType) => {
    const url = getFullUrl(token, type);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setCopyErrorId(null);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      setCopyErrorId(id);
    }
  };

  const filteredLinks = inviteLinks;

  const formatExpiry = (expiresAt: string) => {
    const date = new Date(expiresAt);
    if (Number.isNaN(date.getTime())) return 'No expiry set';
    return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  };

  const candidateLinksCount = inviteLinks.filter((l) => l.type === 'candidate').length;
  const evaluatorLinksCount = inviteLinks.filter((l) => l.type === 'evaluator').length;
  const activeCount = inviteLinks.filter((link) => link.status === 'active' && new Date(link.expiresAt) > new Date()).length;

  return (
    <div id="invite-links-view" className="space-y-6">
      {/* Top Banner & Action */}
      <div className="bg-white p-6 rounded-2xl border border-[#F5DADB] shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-800 border border-red-200">
              Admin Access Management
            </span>
            <span className="text-xs text-red-900/60 font-medium">Link-Based Invitation Pipeline</span>
          </div>
          <h2 className="text-2xl font-black text-[#1F1617] tracking-tight">Shareable Access Links</h2>
          <p className="text-xs text-red-900/70 mt-1 max-w-2xl">
            Only administrators generate secure invitation links for candidates to upload their self-introduction videos
            and Managers / Employers to review assigned assessments. Uninvited public access is disabled.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenCreateLink}
          className="px-5 py-2.5 bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-red-500/20 flex items-center gap-2 cursor-pointer shrink-0"
        >
          <span className="material-symbols-outlined text-base">add_link</span>
          <span>Create New Shareable Link</span>
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-[#F5DADB] shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shadow-xs">
            <span className="material-symbols-outlined text-2xl">link</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-red-900/60 uppercase tracking-wider block">
              Active Links on This Page
            </span>
            <span className="text-2xl font-black text-[#1F1617]">{activeCount}</span>
            <span className="text-[11px] text-[#6B7280] block">On this page</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#F5DADB] shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shadow-xs">
            <span className="material-symbols-outlined text-2xl">video_camera_front</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-red-900/60 uppercase tracking-wider block">
              Candidate Upload Invites
            </span>
            <span className="text-2xl font-black text-[#1F1617]">{candidateLinksCount}</span>
            <span className="text-[11px] text-[#6B7280] block">On this page</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#F5DADB] shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shadow-xs">
            <span className="material-symbols-outlined text-2xl">rate_review</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-red-900/60 uppercase tracking-wider block">
              Manager / Employer Review Invites
            </span>
            <span className="text-2xl font-black text-[#1F1617]">{evaluatorLinksCount}</span>
            <span className="text-[11px] text-[#6B7280] block">On this page</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#F5DADB] shadow-xs flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
        <div className="flex gap-1.5 p-1 bg-red-50/40 rounded-xl border border-red-100 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              setFilterType('all');
              onQueryChange(1, 'all', filterStatus, search);
            }}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              filterType === 'all'
                ? 'bg-red-600 text-white font-bold shadow-xs'
                : 'text-[#6B7280] hover:text-[#1F1617]'
            }`}
          >
            All Links ({total})
          </button>
          <button
            type="button"
            onClick={() => {
              setFilterType('candidate');
              onQueryChange(1, 'candidate', filterStatus, search);
            }}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              filterType === 'candidate'
                ? 'bg-red-600 text-white font-bold shadow-xs'
                : 'text-[#6B7280] hover:text-[#1F1617]'
            }`}
          >
            <span className="material-symbols-outlined text-xs">video_camera_front</span>
            Candidate Uploads ({candidateLinksCount})
          </button>
          <button
            type="button"
            onClick={() => {
              setFilterType('evaluator');
              onQueryChange(1, 'evaluator', filterStatus, search);
            }}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              filterType === 'evaluator'
                ? 'bg-red-600 text-white font-bold shadow-xs'
                : 'text-[#6B7280] hover:text-[#1F1617]'
            }`}
          >
            <span className="material-symbols-outlined text-xs">rate_review</span>
            Manager / Employer Reviews ({evaluatorLinksCount})
          </button>
        </div>

        <div className="flex gap-1.5 p-1 bg-gray-50 rounded-xl border border-gray-200 w-full sm:w-auto">
          {(['all', 'active', 'inactive'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => {
                setFilterStatus(status);
                onQueryChange(1, filterType, status, search);
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold capitalize ${filterStatus === status ? 'bg-[#1F1617] text-white' : 'text-[#6B7280] hover:text-[#1F1617]'}`}
            >
              {status === 'all' ? 'All Status' : status}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#6B7280] text-sm">search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              onQueryChange(1, filterType, filterStatus, e.target.value);
            }}
            placeholder="Search invitees, positions..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#F5DADB] text-xs focus:ring-1 focus:ring-red-500 focus:border-red-500 focus:outline-none bg-white"
          />
        </div>
      </div>

      {/* Links List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="bg-white p-12 rounded-2xl border border-[#F5DADB] text-center text-sm text-[#6B7280]">Loading access links...</div>
        ) : filteredLinks.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-[#F5DADB] text-center space-y-3">
            <span className="material-symbols-outlined text-4xl text-red-300">link_off</span>
            <p className="font-bold text-sm text-[#1F1617]">No shareable links found</p>
            <p className="text-xs text-red-900/60 max-w-sm mx-auto">
              Create an invitation link for a candidate upload or a Manager / Employer review.
            </p>
            <button
              type="button"
              onClick={onOpenCreateLink}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">add_link</span>
              <span>Create Access Link</span>
            </button>
          </div>
        ) : (
          filteredLinks.map((link) => {
            const isCandidate = link.type === 'candidate';
            const isRevoked = link.status === 'revoked';
            const isUsed = link.status === 'used';
            const isExpired = new Date(link.expiresAt) < new Date();
            const canExtend = !isRevoked && !isUsed;
            const canShare = Boolean(link.token) && !link.token.startsWith('...');
            const fullUrl = canShare ? getFullUrl(link.token, link.type) : '';
            const submissionVideos = videos.filter((video) => getSubmissionId(video) === (link.submissionId || link.id));

            return (
              <div
                key={link.id}
                className={`bg-white rounded-2xl border p-5 transition-all shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                  isRevoked
                    ? 'border-gray-200 opacity-60 bg-gray-50'
                    : isExpired
                    ? 'border-amber-200 bg-amber-50/20'
                    : 'border-[#F5DADB] hover:border-red-300'
                }`}
              >
                {/* Left Info */}
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                        isCandidate
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-red-100 text-red-800 border border-red-200'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[12px]">
                        {isCandidate ? 'video_camera_front' : 'rate_review'}
                      </span>
                      {isCandidate ? 'Candidate Upload Link' : 'Manager / Employer Review Link'}
                    </span>

                    {isRevoked ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-200 text-gray-700">
                        Revoked
                      </span>
                    ) : isUsed ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                        Submitted
                      </span>
                    ) : isExpired ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                        Expired
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                        Active & Shareable
                      </span>
                    )}

                    <span className="text-[11px] text-red-900/60">• Created {new Date(link.createdAt).toLocaleDateString()}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <div>
                      <span className="text-red-900/60 font-medium">Recipient: </span>
                      <strong className="text-[#1F1617]">{link.recipientName}</strong>
                      {link.recipientEmail && <span className="text-[#6B7280]"> ({link.recipientEmail})</span>}
                    </div>

                    {link.roleApplied && (
                      <div>
                        <span className="text-red-900/60 font-medium">Position: </span>
                        <span className="text-[#1F1617] font-semibold">{link.roleApplied}</span>
                      </div>
                    )}
                    <div className="text-[10px] font-mono text-[#6B7280]">Submission ID: {link.submissionId || link.id}</div>

                    {link.assignedCandidateName && (
                      <div>
                        <span className="text-red-900/60 font-medium">Assigned Candidate: </span>
                        <span className="text-red-700 font-bold">{link.assignedCandidateName}</span>
                      </div>
                    )}

                  </div>
                  {isCandidate && submissionVideos.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1 text-[10px] font-bold">
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800">
                        Approved {submissionVideos.filter((video) => video.adminReviewStatus === 'accepted').length}
                      </span>
                      {submissionVideos.some((video) => video.evaluation?.decision === 'rejected' || video.evaluation?.decision === 'reject') && (
                        <span className="rounded-full bg-rose-100 px-2.5 py-1 text-rose-800">
                          Employer decision: submission rejected
                        </span>
                      )}
                      {submissionVideos.some((video) => video.adminReviewStatus !== 'accepted') && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">
                          Awaiting review {submissionVideos.filter((video) => video.adminReviewStatus !== 'accepted').length}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setExpandedDetailsId(expandedDetailsId === link.id ? null : link.id)}
                      className="text-xs font-bold text-red-700 hover:text-red-900"
                    >
                      {expandedDetailsId === link.id ? 'Hide details' : 'View details'}
                    </button>
                    {isCandidate && submissionVideos.length > 0 && (
                      <button type="button" onClick={() => setReviewingInviteId(link.id)} className="text-xs font-bold text-red-700 hover:text-red-900">
                        Review submissions ({submissionVideos.length})
                      </button>
                    )}
                  </div>
                  {expandedDetailsId === link.id && (
                    <div className="mt-3 rounded-xl bg-red-50/50 border border-red-100 p-3 grid sm:grid-cols-2 gap-2 text-[11px]">
                      <p><strong>Created:</strong> {formatExpiry(link.createdAt)}</p>
                      <p><strong>Expires:</strong> {formatExpiry(link.expiresAt)}</p>
                      <p><strong>Access count:</strong> {link.accessCount ?? 0}</p>
                      <p><strong>Created by:</strong> {link.createdBy || 'Administrator'}</p>
                      {link.notes && <p className="sm:col-span-2"><strong>Notes:</strong> {link.notes}</p>}
                    </div>
                  )}
                </div>

                {/* Right Action Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 shrink-0 self-end md:self-center">
                  {canExtend && editingExpiryId !== link.id && (
                    <button
                      type="button"
                      onClick={() => {
                        const existingExpiry = new Date(link.expiresAt).getTime();
                        const baseline = Math.max(existingExpiry, Date.now());
                        setExpiryDraft(toDateTimeLocalValue(new Date(baseline + 24 * 60 * 60 * 1000)));
                        setExpiryError(null);
                        setEditingExpiryId(link.id);
                      }}
                      className="px-3 py-1.5 border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Extend Expiry
                    </button>
                  )}
                  {editingExpiryId === link.id && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <input
                        type="datetime-local"
                        value={expiryDraft}
                        min={toDateTimeLocalValue(new Date(Date.now() + 60 * 1000))}
                        onChange={(event) => setExpiryDraft(event.target.value)}
                        aria-label="New link expiry date and time"
                        className="rounded-lg border border-[#F5DADB] px-2 py-1.5 text-xs"
                      />
                      <span className="text-[10px] text-[#6B7280]">Recipient will be emailed automatically.</span>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            if (!expiryDraft || new Date(expiryDraft) <= new Date()) throw new Error('Choose a future expiry date and time.');
                            await onExtendExpiry(link.id, expiryDraft);
                              await onQueryChange(page, filterType, filterStatus, search);
                            setEditingExpiryId(null);
                            setExpiryError(null);
                          } catch (error) {
                            setExpiryError(error instanceof Error ? error.message : 'Could not extend this link.');
                          }
                        }}
                        className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditingExpiryId(null); setExpiryError(null); }}
                        className="px-2 py-1.5 text-xs font-semibold text-[#6B7280] hover:text-[#1F1617]"
                      >
                        Cancel
                      </button>
                      {expiryError && <p role="alert" className="w-full text-[11px] text-red-700">{expiryError}</p>}
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={!canShare}
                    title={canShare ? 'Copy share link' : 'This older link cannot be copied. Create a new link to get a copyable URL.'}
                    onClick={() => { if (canShare) void handleCopy(link.id, link.token, link.type); }}
                    className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shadow-red-500/20 flex items-center gap-1.5 cursor-pointer disabled:bg-gray-300 disabled:shadow-none disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-sm">
                      {copiedId === link.id ? 'done' : 'content_copy'}
                    </span>
                    <span>{copiedId === link.id ? 'Copied Link!' : 'Copy Link'}</span>
                  </button>
                  {copyErrorId === link.id && (
                    <span role="alert" className="w-full text-right text-[10px] text-red-700">Clipboard access failed. Allow clipboard permission and try again.</span>
                  )}

                  {!isRevoked && (
                    <button
                      type="button"
                      onClick={async () => {
                        await onRevokeLink(link.id);
                        await onQueryChange(page, filterType, filterStatus, search);
                      }}
                      className="p-1.5 text-[#6B7280] hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                      title="Revoke link access"
                    >
                      <span className="material-symbols-outlined text-base">block</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      {total > pageSize && (
        <div className="flex items-center justify-between bg-white rounded-2xl border border-[#F5DADB] p-4">
          <span className="text-xs text-[#6B7280]">
            Showing {(page - 1) * pageSize + (total ? 1 : 0)}–{Math.min(page * pageSize, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1 || isLoading} onClick={() => onQueryChange(page - 1, filterType, filterStatus, search)} className="px-3 py-1.5 rounded-lg border text-xs font-bold disabled:opacity-40">Previous</button>
            <span className="self-center text-xs text-[#6B7280]">Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</span>
            <button type="button" disabled={page >= Math.ceil(total / pageSize) || isLoading} onClick={() => onQueryChange(page + 1, filterType, filterStatus, search)} className="px-3 py-1.5 rounded-lg border text-xs font-bold disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
      {reviewingInviteId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setReviewingInviteId(null)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-auto p-5 space-y-3" onClick={(event) => event.stopPropagation()}>
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-[#1F1617]">Submission videos</h3>
                <p className="text-xs text-[#6B7280]">Select a video to review it in the video review popup.</p>
              </div>
              <button type="button" onClick={() => setReviewingInviteId(null)} aria-label="Close submissions"><span className="material-symbols-outlined">close</span></button>
            </div>
            {videos.filter((video) => getSubmissionId(video) === (inviteLinks.find((link) => link.id === reviewingInviteId)?.submissionId || reviewingInviteId)).map((video, index) => (
              <div key={video.id} className="flex justify-between items-center gap-3 border rounded-xl p-3">
                <div>
                  <p className="text-xs font-bold">{index + 1}. {video.roleApplied} submission</p>
                  <p className="text-[11px] text-[#6B7280]">
                    {video.submittedTimeAgo} · {video.adminReviewStatus === 'accepted'
                      ? 'Approved'
                      : video.adminReviewStatus === 'reupload_requested'
                      ? 'Waiting for reupload'
                      : video.wasReuploaded ? 'Reuploaded · waiting for admin approval' : 'Awaiting review'}
                    {video.evaluation?.decision && ` · Manager decision: ${video.evaluation.decision}`}
                  </p>
                </div>
                <button type="button" onClick={() => { setReviewingInviteId(null); onReviewVideo(video); }} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold">Review video</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
