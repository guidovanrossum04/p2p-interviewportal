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
  onQueryChange: (page: number, type: string, search: string, view: 'active' | 'archived' | 'blocked') => void;
  onReviewVideo: (video: CandidateVideo) => void;
  onOpenCreateLink: () => void;
  onExtendExpiry: (id: string, expiresAt: string) => Promise<void>;
  onArchiveLink: (id: string, archived: boolean) => Promise<boolean>;
  onBlockLink: (id: string) => Promise<boolean>;
  onDeleteLink: (id: string) => Promise<boolean>;
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
  onExtendExpiry,
  onArchiveLink,
  onBlockLink,
  onDeleteLink,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'candidate' | 'evaluator'>('all');
  const [filterView, setFilterView] = useState<'active' | 'archived' | 'blocked'>('active');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyErrorId, setCopyErrorId] = useState<string | null>(null);
  const [editingExpiryId, setEditingExpiryId] = useState<string | null>(null);
  const [expiryDraft, setExpiryDraft] = useState('');
  const [expiryError, setExpiryError] = useState<string | null>(null);
  const [reviewingInviteId, setReviewingInviteId] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => onQueryChange(1, filterType, search, filterView), 250);
    return () => window.clearTimeout(timeout);
  }, [filterType, search, filterView, onQueryChange]);

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

  const candidateLinksCount = inviteLinks.filter((link) => link.type === 'candidate').length;
  const evaluatorLinksCount = inviteLinks.filter((link) => link.type === 'evaluator').length;
  const activeCount = inviteLinks.filter((link) => link.status === 'active' && new Date(link.expiresAt) > new Date()).length;

  return (
    <div id="invite-links-view" className="space-y-6">
      {/* Top Banner & Action */}
      <div className="bg-white p-6 rounded-2xl border border-[#E8E5E1] shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-800 border border-red-200">
              Admin Access Management
            </span>
            
          </div>
          <h2 className="text-2xl font-extrabold text-[#101010] tracking-tight">Shareable Access Links</h2>
          
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
        <div className="bg-white p-4 rounded-2xl border border-[#E8E5E1] shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shadow-xs">
            <span className="material-symbols-outlined text-2xl">link</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-black-900/60 uppercase tracking-wider block">
              Active Links on This Page
            </span>
            <span className="text-2xl font-extrabold text-[#101010]">{activeCount}</span>
            <span className="text-[11px] text-[#8A8580] block">On this page</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#E8E5E1] shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shadow-xs">
            <span className="material-symbols-outlined text-2xl">video_camera_front</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-black-900/60 uppercase tracking-wider block">
              Candidate Upload Invites
            </span>
            <span className="text-2xl font-extrabold text-[#101010]">{candidateLinksCount}</span>
            <span className="text-[11px] text-[#8A8580] block">On this page</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#E8E5E1] shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shadow-xs">
            <span className="material-symbols-outlined text-2xl">rate_review</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-black-900/60 uppercase tracking-wider block">
              Manager / Employer Review Invites
            </span>
            <span className="text-2xl font-extrabold text-[#101010]">{evaluatorLinksCount}</span>
            <span className="text-[11px] text-[#8A8580] block">On this page</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E8E5E1] shadow-xs flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
        <div className="flex gap-1.5 p-1 bg-red-50/40 rounded-xl border border-red-100 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              setFilterType('all');
            }}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              filterType === 'all'
                ? 'bg-red-600 text-white font-bold shadow-xs'
                : 'text-[#8A8580] hover:text-[#101010]'
            }`}
          >
            All Links ({total})
          </button>
          <button
            type="button"
            onClick={() => {
              setFilterType('candidate');
            }}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              filterType === 'candidate'
                ? 'bg-red-600 text-white font-bold shadow-xs'
                : 'text-[#8A8580] hover:text-[#101010]'
            }`}
          >
            <span className="material-symbols-outlined text-xs">video_camera_front</span>
            Candidate Links
          </button>
          <button
            type="button"
            onClick={() => {
              setFilterType('evaluator');
            }}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              filterType === 'evaluator'
                ? 'bg-red-600 text-white font-bold shadow-xs'
                : 'text-[#8A8580] hover:text-[#101010]'
            }`}
          >
            <span className="material-symbols-outlined text-xs">rate_review</span>
            Employer Links
          </button>
        </div>

        <div className="flex gap-1.5 p-1 bg-gray-50 rounded-xl border border-gray-200 w-full sm:w-auto">
          {([
            { id: 'active', label: 'Active links', icon: 'link' },
            { id: 'archived', label: 'Archived', icon: 'archive' },
            { id: 'blocked', label: 'Blocked', icon: 'block' },
          ] as const).map((view) => (
            <button
              key={view.id}
              type="button"
              aria-pressed={filterView === view.id}
              onClick={() => setFilterView(view.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold ${filterView === view.id ? 'bg-[#101010] text-white' : 'text-[#8A8580] hover:text-[#101010]'}`}
            >
              <span className="material-symbols-outlined text-sm">{view.icon}</span>
              {view.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#8A8580] text-sm">search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            placeholder="Search invitees, positions..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E8E5E1] text-xs focus:ring-1 focus:ring-red-500 focus:border-red-500 focus:outline-none bg-white"
          />
        </div>
      </div>

      {/* Links List */}
      {isLoading ? (
        <div className="bg-white p-12 rounded-2xl border border-[#E8E5E1] text-center text-sm text-[#8A8580]">Loading access links...</div>
      ) : filteredLinks.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-[#E8E5E1] text-center space-y-3">
          <span className="material-symbols-outlined text-4xl text-red-300">link_off</span>
          <p className="font-bold text-sm text-[#101010]">No shareable links found</p>
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
        <div className="overflow-hidden rounded-2xl border border-[#E8E5E1] bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#E8E5E1] bg-[#F5F2EE] text-[10px] font-bold uppercase tracking-wider text-[#5A5550]">
                  <th className="px-4 py-3">Link type</th>
                  <th className="px-4 py-3">Recipient</th>
                  <th className="px-4 py-3">Candidate / position</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E5E1] text-xs">
                {filteredLinks.map((link) => {
                  const isCandidate = link.type === 'candidate';
                  const isRevoked = link.status === 'revoked';
                  const isUsed = link.status === 'used';
                  const isExpired = new Date(link.expiresAt) < new Date();
                  const isArchived = Boolean(link.archivedAt);
                  const canExtend = !isRevoked && !isUsed && !isArchived;
                  const canShare = Boolean(link.token) && !link.token.startsWith('...') && !isRevoked;
                  const submissionVideos = videos.filter((video) => getSubmissionId(video) === (link.submissionId || link.id));
                  const statusLabel = isRevoked ? 'Blocked' : isUsed ? 'Submitted' : isExpired ? 'Expired' : 'Active';
                  const statusClass = isRevoked
                    ? 'bg-gray-100 text-gray-700'
                    : isUsed
                      ? 'bg-emerald-100 text-emerald-800'
                      : isExpired
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800';

                  return (
                    <React.Fragment key={link.id}>
                      <tr className={`align-top hover:bg-[#FAF9F7] ${isRevoked ? 'bg-gray-50/70 text-gray-500' : ''}`}>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                            isCandidate ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-red-200 bg-red-50 text-red-800'
                          }`}>
                            <span className="material-symbols-outlined text-[13px]">
                              {isCandidate ? 'video_camera_front' : 'rate_review'}
                            </span>
                            {isCandidate ? 'Candidate upload' : 'Manager / Employer review'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-[#101010]">{link.recipientName}</p>
                          <p className="mt-0.5 text-[10px] text-[#8A8580]">{link.recipientEmail || 'No email provided'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[#101010]">
                            {link.assignedSubmissionCount && link.assignedSubmissionCount > 1
                              ? `${link.assignedSubmissionCount} candidate submissions`
                              : link.assignedCandidateName || link.roleApplied || '—'}
                          </p>
                          {link.assignedCandidateName && link.roleApplied && (
                            <p className="mt-0.5 text-[10px] text-[#8A8580]">{link.roleApplied}</p>
                          )}
                          {isCandidate && submissionVideos.length > 0 && (
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <p className="text-[10px] font-medium text-[#5A5550]">
                              {submissionVideos.filter((video) => video.adminReviewStatus === 'accepted').length}/{submissionVideos.length} videos approved
                            </p>
                            <button
                              type="button"
                              onClick={() => setReviewingInviteId(link.id)}
                              className="text-[10px] font-bold text-red-700 hover:text-red-900"
                            >
                              Review submissions
                            </button>
                          </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClass}`}>{statusLabel}</span>
                          {isCandidate && submissionVideos.some((video) => video.evaluation?.decision === 'rejected' || video.evaluation?.decision === 'reject') && (
                            <p className="mt-1 text-[10px] font-semibold text-rose-700">Employer rejected</p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[11px] text-[#5A5550]">{formatExpiry(link.createdAt)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-[11px] text-[#5A5550]">{formatExpiry(link.expiresAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              disabled={!canShare}
                              title={canShare ? 'Copy share link' : 'This older link cannot be copied.'}
                              onClick={() => { if (canShare) void handleCopy(link.id, link.token, link.type); }}
                              aria-label={copiedId === link.id ? 'Link copied' : 'Copy share link'}
                              className="rounded-lg bg-red-600 p-1.5 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                            >
                              <span className="material-symbols-outlined text-[14px]">{copiedId === link.id ? 'done' : 'content_copy'}</span>
                            </button>
                            {canExtend && (
                              <button
                                type="button"
                                onClick={() => {
                                  const baseline = Math.max(new Date(link.expiresAt).getTime(), Date.now());
                                  setExpiryDraft(toDateTimeLocalValue(new Date(baseline + 24 * 60 * 60 * 1000)));
                                  setExpiryError(null);
                                  setEditingExpiryId(link.id);
                                }}
                                title="Extend expiry"
                                aria-label="Extend link expiry"
                                className="rounded-lg border border-amber-200 p-1.5 text-amber-800 hover:bg-amber-50"
                              >
                                <span className="material-symbols-outlined block text-[16px]">event</span>
                              </button>
                            )}
                            <button
                              type="button"
                              title={isArchived ? 'Restore from archive' : 'Archive link'}
                              aria-label={isArchived ? 'Restore from archive' : 'Archive link'}
                              onClick={async () => {
                                if (await onArchiveLink(link.id, !isArchived)) {
                                  await onQueryChange(page, filterType, search, filterView);
                                }
                              }}
                              className="rounded-lg border border-[#E8E5E1] p-1.5 text-[#5A5550] hover:bg-[#F5F2EE]"
                            >
                              <span className="material-symbols-outlined block text-[16px]">{isArchived ? 'unarchive' : 'archive'}</span>
                            </button>
                            {filterView !== 'blocked' && !isUsed && !isRevoked && (
                              <button
                                type="button"
                                title="Block link access"
                                aria-label="Block link access"
                                onClick={async () => {
                                  if (!window.confirm(`Block access for ${link.recipientName}?`)) return;
                                  if (await onBlockLink(link.id)) {
                                    await onQueryChange(page, filterType, search, filterView);
                                  }
                                }}
                                className="rounded-lg border border-rose-200 p-1.5 text-rose-700 hover:bg-rose-50"
                              >
                                <span className="material-symbols-outlined block text-[16px]">block</span>
                              </button>
                            )}
                            <button
                              type="button"
                              title="Delete link"
                              aria-label="Delete link"
                              onClick={async () => {
                                if (!window.confirm(`Delete the link for ${link.recipientName}? This will permanently disable the link.`)) return;
                                if (await onDeleteLink(link.id)) {
                                  await onQueryChange(page, filterType, search, filterView);
                                }
                              }}
                              className="rounded-lg border border-rose-200 p-1.5 text-rose-700 hover:bg-rose-50"
                            >
                              <span className="material-symbols-outlined block text-[16px]">delete</span>
                            </button>
                          </div>
                          {copyErrorId === link.id && <p role="alert" className="mt-1 text-right text-[10px] text-red-700">Clipboard access failed.</p>}
                          {editingExpiryId === link.id && (
                            <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5">
                              <input
                                type="datetime-local"
                                value={expiryDraft}
                                min={toDateTimeLocalValue(new Date(Date.now() + 60 * 1000))}
                                onChange={(event) => setExpiryDraft(event.target.value)}
                                aria-label="New link expiry date and time"
                                className="rounded-lg border border-[#E8E5E1] px-2 py-1.5 text-[10px]"
                              />
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    if (!expiryDraft || new Date(expiryDraft) <= new Date()) throw new Error('Choose a future expiry date and time.');
                                    await onExtendExpiry(link.id, expiryDraft);
                                    await onQueryChange(page, filterType, search, filterView);
                                    setEditingExpiryId(null);
                                    setExpiryError(null);
                                  } catch (error) {
                                    setExpiryError(error instanceof Error ? error.message : 'Could not extend this link.');
                                  }
                                }}
                                className="rounded-lg bg-amber-700 px-2.5 py-1.5 text-[10px] font-bold text-white"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => { setEditingExpiryId(null); setExpiryError(null); }}
                                className="px-1.5 py-1 text-[10px] font-semibold text-[#5A5550]"
                              >
                                Cancel
                              </button>
                              {expiryError && <p role="alert" className="w-full text-right text-[10px] text-red-700">{expiryError}</p>}
                            </div>
                          )}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {total > pageSize && (
        <div className="flex items-center justify-between bg-white rounded-2xl border border-[#E8E5E1] p-4">
          <span className="text-xs text-[#8A8580]">
            Showing {(page - 1) * pageSize + (total ? 1 : 0)}–{Math.min(page * pageSize, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1 || isLoading} onClick={() => onQueryChange(page - 1, filterType, search, filterView)} className="px-3 py-1.5 rounded-lg border text-xs font-bold disabled:opacity-40">Previous</button>
            <span className="self-center text-xs text-[#8A8580]">Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</span>
            <button type="button" disabled={page >= Math.ceil(total / pageSize) || isLoading} onClick={() => onQueryChange(page + 1, filterType, search, filterView)} className="px-3 py-1.5 rounded-lg border text-xs font-bold disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
      {reviewingInviteId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setReviewingInviteId(null)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-auto p-5 space-y-3" onClick={(event) => event.stopPropagation()}>
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-[#101010]">Submission videos</h3>
                <p className="text-xs text-[#8A8580]">Select a video to review it in the video review popup.</p>
              </div>
              <button type="button" onClick={() => setReviewingInviteId(null)} aria-label="Close submissions"><span className="material-symbols-outlined">close</span></button>
            </div>
            {videos.filter((video) => getSubmissionId(video) === (inviteLinks.find((link) => link.id === reviewingInviteId)?.submissionId || reviewingInviteId)).map((video, index) => (
              <div key={video.id} className="flex justify-between items-center gap-3 border rounded-xl p-3">
                <div>
                  <p className="text-xs font-bold">{index + 1}. {video.questionPrompt || `${video.roleApplied} submission`}</p>
                  <p className="text-[11px] text-[#8A8580]">
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
