import React, { useEffect, useState } from 'react';
import { CandidateVideo, User, InviteType, InviteLink } from '../types';
import { fetchAssignableSubmissions, groupVideosBySubmission } from '../utils/submissions';

const toDateTimeLocalValue = (date: Date) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
};

interface CreateInviteLinkModalProps {
  evaluators: User[];
  defaultType?: InviteType;
  onClose: () => void;
  onCreateInvite: (inviteData: {
    type: InviteType;
    recipientName: string;
    recipientEmail: string;
    roleApplied?: string;
    department?: string;
    assignedVideoId?: string;
    expiresAt: string;
    notes?: string;
  }) => Promise<InviteLink>;
  onTestLink?: (invite: InviteLink) => void;
}

export const CreateInviteLinkModal: React.FC<CreateInviteLinkModalProps> = ({
  evaluators,
  defaultType = 'candidate',
  onClose,
  onCreateInvite,
  onTestLink,
}) => {
  const [type, setType] = useState<InviteType>(defaultType);
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [evaluatorSearch, setEvaluatorSearch] = useState('');
  const [isEvaluatorSearchFocused, setIsEvaluatorSearchFocused] = useState(false);
  const [assignableVideos, setAssignableVideos] = useState<CandidateVideo[]>([]);
  const [isLoadingAssignableVideos, setIsLoadingAssignableVideos] = useState(false);
  const [assignableVideosError, setAssignableVideosError] = useState<string | null>(null);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [candidateResults, setCandidateResults] = useState<Array<{ name: string; email: string; roleApplied?: string }>>([]);
  const [isSearchingCandidates, setIsSearchingCandidates] = useState(false);
  const [candidateSearchError, setCandidateSearchError] = useState<string | null>(null);
  const [roleApplied, setRoleApplied] = useState('Senior Frontend Engineer');
  const [assignedVideoId, setAssignedVideoId] = useState('');
  const [expiresAt, setExpiresAt] = useState(() => toDateTimeLocalValue(new Date(Date.now() + 48 * 60 * 60 * 1000)));
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdInvite, setCreatedInvite] = useState<InviteLink | null>(null);
  const [copied, setCopied] = useState(false);

  const assignableSubmissions = groupVideosBySubmission(assignableVideos);
  const filteredEvaluators = evaluators.filter((evaluator) => {
    const query = evaluatorSearch.trim().toLowerCase();
    return !query || [evaluator.name, evaluator.email, evaluator.department || '', evaluator.title || '']
      .some((value) => value.toLowerCase().includes(query));
  });

  useEffect(() => {
    if (type !== 'evaluator') return;
    const controller = new AbortController();
    setIsLoadingAssignableVideos(true);
    setAssignableVideosError(null);
    fetchAssignableSubmissions(controller.signal)
      .then((submissionVideos) => {
        const representatives = groupVideosBySubmission(submissionVideos).map((submission) => submission.videos[0]);
        setAssignableVideos(submissionVideos);
        setAssignedVideoId((current) => representatives.some((video) => video.id === current)
          ? current
          : representatives[0]?.id || '');
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setAssignableVideos([]);
          setAssignedVideoId('');
          setAssignableVideosError(error instanceof Error ? error.message : 'Could not load submissions ready for assignment.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingAssignableVideos(false);
      });
    return () => controller.abort();
  }, [type]);

  const handleEvaluatorSelect = (evaluatorId: string) => {
    const ev = evaluators.find((e) => e.id === evaluatorId);
    if (ev) {
      setEvaluatorSearch(ev.name);
      setRecipientName(ev.name);
      setRecipientEmail(ev.email);
      setIsEvaluatorSearchFocused(false);
    }
  };

  useEffect(() => {
    const query = candidateSearch.trim();
    if (type !== 'candidate' || query.length < 2 || (recipientEmail && query === recipientName)) {
      setCandidateResults([]);
      setCandidateSearchError(null);
      setIsSearchingCandidates(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsSearchingCandidates(true);
      setCandidateSearchError(null);
      try {
        const params = new URLSearchParams({ role: 'candidate', search: query, page: '1', limit: '20' });
        const response = await fetch(`/api/users?${params.toString()}`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not search candidates.');
        const users = Array.isArray(result.items) ? result.items : Array.isArray(result) ? result : [];
        const results = users.map((user: User) => ({
          name: user.name,
          email: user.email,
          roleApplied: user.title?.replace(/^Candidate for /i, ''),
        }));
        setCandidateResults(results);
      } catch (error) {
        if (controller.signal.aborted) return;
        setCandidateSearchError(error instanceof Error ? error.message : 'Could not search candidates.');
        setCandidateResults([]);
      } finally {
        if (!controller.signal.aborted) setIsSearchingCandidates(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [candidateSearch, type, recipientEmail, recipientName]);

  const handleCandidateSelect = (candidate: { name: string; email: string; roleApplied?: string }) => {
    setRecipientName(candidate.name);
    setRecipientEmail(candidate.email);
    if (candidate.roleApplied) setRoleApplied(candidate.roleApplied);
    setCandidateSearch(candidate.name);
    setCandidateResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName) return;
    const expiryDate = new Date(expiresAt);
    if (Number.isNaN(expiryDate.getTime()) || expiryDate <= new Date()) {
      setErrorMessage('Choose a future expiry date and time.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const invite = await onCreateInvite({
        type,
        recipientName,
        recipientEmail,
        roleApplied,
        department: '',
        assignedVideoId: type === 'evaluator' ? assignedVideoId : undefined,
        expiresAt: expiryDate.toISOString(),
        notes,
      });
      setCreatedInvite(invite);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not create the link.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFullUrl = (token: string, inviteType: InviteType) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/?portal=${inviteType}&token=${encodeURIComponent(token)}`;
  };

  const handleCopy = (token: string, inviteType: InviteType) => {
    const url = getFullUrl(token, inviteType);
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      id="create-invite-link-modal"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden border border-[#E8E5E1] flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#E8E5E1] flex justify-between items-center bg-gradient-to-r from-red-50/50 via-white to-red-50/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-base">link</span>
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#101010]">Create & Share Access Link</h3>
              <p className="text-[11px] text-red-900/60">
                Administrators create candidate upload and Manager / Employer review links.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#8A8580] hover:text-red-700 p-1 rounded-lg hover:bg-red-50 cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {!createdInvite ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Type Selection */}
              <div>
                <label className="block text-xs font-semibold text-[#101010] mb-2">
                  Select Link Destination / Recipient Type *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setType('candidate');
                      setExpiresAt(toDateTimeLocalValue(new Date(Date.now() + 48 * 60 * 60 * 1000)));
                    }}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      type === 'candidate'
                        ? 'border-red-600 bg-red-50/60 font-bold text-red-700 shadow-xs'
                        : 'border-[#E8E5E1] text-[#8A8580] hover:border-red-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base text-red-600">video_camera_front</span>
                      <span className="text-xs font-bold text-[#101010]">Candidate Upload Link</span>
                    </div>
                    <span className="text-[11px] font-normal text-red-900/70">Share with a candidate to submit their video.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setType('evaluator');
                      setExpiresAt(toDateTimeLocalValue(new Date(Date.now() + 24 * 60 * 60 * 1000)));
                    }}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      type === 'evaluator'
                        ? 'border-red-600 bg-red-50/60 font-bold text-red-700 shadow-xs'
                        : 'border-[#E8E5E1] text-[#8A8580] hover:border-red-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base text-red-600">rate_review</span>
                      <span className="text-xs font-bold text-[#101010]">Employer / Manager Review Link</span>
                    </div>
                    <span className="text-[11px] font-normal text-red-900/70">
                      Share with an employer or manager to review assigned candidate submissions.
                    </span>
                  </button>
                </div>
              </div>

              {/* Conditional Quick Selector for Evaluator */}
              {type === 'evaluator' && (
                <div className="relative">
                  <label className="block text-xs font-semibold text-[#101010] mb-1" htmlFor="registered-evaluator-search">Search registered Managers / Employers</label>
                  <input
                    id="registered-evaluator-search"
                    type="search"
                    autoComplete="off"
                    value={evaluatorSearch}
                    onFocus={() => setIsEvaluatorSearchFocused(true)}
                    onBlur={() => window.setTimeout(() => setIsEvaluatorSearchFocused(false), 150)}
                    onChange={(event) => {
                      setEvaluatorSearch(event.target.value);
                      setRecipientName('');
                      setRecipientEmail('');
                    }}
                    placeholder="Search by name or email"
                    className="w-full rounded-xl border border-[#E8E5E1] px-3 py-2 text-xs text-[#101010] focus:ring-1 focus:ring-red-500 focus:border-red-500 focus:outline-none bg-white"
                  />
                  {isEvaluatorSearchFocused && evaluatorSearch.trim() && (
                    <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-[#E8E5E1] bg-white shadow-lg">
                      {filteredEvaluators.length ? filteredEvaluators.map((evaluator) => (
                        <button
                          key={evaluator.id}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleEvaluatorSelect(evaluator.id)}
                          className="block w-full border-b border-red-50 px-3 py-2.5 text-left last:border-0 hover:bg-red-50"
                        >
                          <span className="block text-xs font-semibold text-[#101010]">{evaluator.name}</span>
                          <span className="mt-0.5 block text-[11px] text-[#8A8580]">{evaluator.email}</span>
                        </button>
                      )) : (
                        <p className="px-3 py-3 text-xs text-[#8A8580]">No registered Manager / Employer matches. You can enter new recipient details below.</p>
                      )}
                    </div>
                  )}
                  {evaluators.length === 0 && (
                    <p className="mt-1 text-[11px] text-amber-700">No Manager / Employer accounts are available. Add one under User &amp; Roles first.</p>
                  )}
                </div>
              )}

              {type === 'candidate' && (
                <div className="relative">
                  <label className="block text-xs font-semibold text-[#101010] mb-1" htmlFor="candidate-directory-search">Search existing candidate</label>
                  <input
                    id="candidate-directory-search"
                    type="search"
                    autoComplete="off"
                    value={candidateSearch}
                    onChange={(event) => {
                      setCandidateSearch(event.target.value);
                      setRecipientName('');
                      setRecipientEmail('');
                    }}
                    placeholder="Search by candidate name or email"
                    className="w-full rounded-xl border border-[#E8E5E1] px-3 py-2 text-xs text-[#101010] focus:ring-1 focus:ring-red-500 focus:border-red-500 focus:outline-none bg-white"
                  />
                  {candidateSearch.trim().length >= 2 && (
                    <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-[#E8E5E1] bg-white shadow-lg">
                      {isSearchingCandidates ? (
                        <p className="px-3 py-3 text-xs text-[#8A8580]">Searching candidates...</p>
                      ) : candidateSearchError ? (
                        <p role="alert" className="px-3 py-3 text-xs text-red-700">{candidateSearchError}</p>
                      ) : candidateResults.length ? (
                        candidateResults.map((candidate) => (
                          <button
                            key={candidate.email}
                            type="button"
                            onClick={() => handleCandidateSelect(candidate)}
                            className="block w-full border-b border-red-50 px-3 py-2.5 text-left last:border-0 hover:bg-red-50"
                          >
                            <span className="block text-xs font-semibold text-[#101010]">{candidate.name}</span>
                            <span className="mt-0.5 block text-[11px] text-[#8A8580]">{candidate.email}</span>
                          </button>
                        ))
                      ) : (
                        <p className="px-3 py-3 text-xs text-[#8A8580]">No existing candidates found. You can enter new candidate details below.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Recipient Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#101010] mb-1">
                    {type === 'candidate' ? 'Candidate Full Name *' : 'Manager / Employer Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={type === 'candidate' ? 'Enter candidate name' : 'Enter employer or manager name'}
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full rounded-xl border border-[#E8E5E1] px-3 py-2 text-xs text-[#101010] focus:ring-1 focus:ring-red-500 focus:border-red-500 focus:outline-none bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#101010] mb-1">
                    Recipient Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="recipient@example.com"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="w-full rounded-xl border border-[#E8E5E1] px-3 py-2 text-xs text-[#101010] focus:ring-1 focus:ring-red-500 focus:border-red-500 focus:outline-none bg-white"
                  />
                </div>
              </div>

              {/* Target Position */}
              <div>
                <label className="block text-xs font-semibold text-[#101010] mb-1">
                  {type === 'candidate' ? 'Target Position *' : 'Role / Focus *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Frontend Engineer"
                  value={roleApplied}
                  onChange={(e) => setRoleApplied(e.target.value)}
                  className="w-full rounded-xl border border-[#E8E5E1] px-3 py-2 text-xs text-[#101010] focus:ring-1 focus:ring-red-500 focus:border-red-500 focus:outline-none bg-white"
                />
              </div>

              {/* Evaluator Assignment Target Video */}
              {type === 'evaluator' && (
                <div>
                  <label className="block text-xs font-semibold text-[#101010] mb-1">
                    Approved Candidate Submission *
                  </label>
                  {isLoadingAssignableVideos ? (
                    <p className="mb-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">Loading submissions ready for assignment...</p>
                  ) : assignableVideosError ? (
                    <p role="alert" className="mb-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{assignableVideosError}</p>
                  ) : assignableVideos.length === 0 && (
                    <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                      No submissions are ready. Every video in a submission must be approved and not already assigned.
                    </p>
                  )}
                  <select
                    required
                    disabled={isLoadingAssignableVideos || Boolean(assignableVideosError) || assignableVideos.length === 0}
                    value={assignedVideoId}
                    onChange={(e) => setAssignedVideoId(e.target.value)}
                    className="w-full rounded-xl border border-[#E8E5E1] px-3 py-2 text-xs text-[#101010] focus:ring-1 focus:ring-red-500 focus:border-red-500 focus:outline-none bg-white cursor-pointer"
                  >
                    <option value="">-- Select a submitted video --</option>
                    {assignableSubmissions.map(({ id, videos: submissionVideos }) => {
                      const representative = submissionVideos[0];
                      return (
                      <option key={id} value={representative.id}>
                        {representative.candidateName} — {representative.roleApplied} ({submissionVideos.length} video{submissionVideos.length === 1 ? '' : 's'} · {id})
                      </option>
                      );
                    })}
                  </select>
                </div>
              )}

              <p className="rounded-xl border border-[#E8E5E1] bg-red-50/30 p-3 text-xs text-[#5A5550]">
                The secure link will be emailed automatically to {type === 'candidate' ? 'the candidate' : 'the selected Manager / Employer'}.
              </p>

              {/* Expiry Date */}
              <div>
                <label className="block text-xs font-semibold text-[#101010] mb-1" htmlFor="invite-expiry">Link Expiry Date & Time *</label>
                <input
                  id="invite-expiry"
                  type="datetime-local"
                  required
                  min={toDateTimeLocalValue(new Date(Date.now() + 60 * 1000))}
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full rounded-xl border border-[#E8E5E1] px-3 py-2 text-xs text-[#101010] focus:ring-1 focus:ring-red-500 focus:border-red-500 focus:outline-none bg-white"
                />
              </div>

              {/* Internal Notes */}
              <div>
                <label className="block text-xs font-semibold text-[#101010] mb-1">
                  Invitation Instructions / Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Please record 2-3 minute introduction focusing on architecture and leadership..."
                  className="w-full rounded-xl border border-[#E8E5E1] px-3 py-2 text-xs text-[#101010] focus:ring-1 focus:ring-red-500 focus:border-red-500 focus:outline-none bg-white"
                />
              </div>

              {/* Submit Button */}
              {errorMessage && <p role="alert" className="text-xs font-semibold text-red-700">{errorMessage}</p>}
              <div className="flex justify-end gap-3 pt-2 border-t border-[#E8E5E1]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-[#E8E5E1] hover:bg-red-50 text-[#101010] rounded-xl font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !recipientName}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white rounded-xl font-bold transition-all shadow-xs shadow-red-500/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-base">link</span>
                  {isSubmitting ? 'Generating Secure Link...' : 'Generate & Copy Link'}
                </button>
              </div>
            </form>
          ) : (
            /* Link Success View */
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="p-4 bg-red-50/60 rounded-2xl border border-red-200 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center mx-auto shadow-md shadow-red-500/25">
                  <span className="material-symbols-outlined text-2xl">check</span>
                </div>
                <h4 className="font-extrabold text-sm text-[#101010]">
                  {createdInvite.type === 'candidate' ? 'Candidate Upload Link Ready' : 'Manager / Employer Review Link Ready'}
                </h4>
                <p className="text-xs text-red-900/70 max-w-md mx-auto">
                  Share this private link with{' '}
                  <strong className="text-[#101010]">{createdInvite.recipientName}</strong>. Only individuals with this
                  token can access the {createdInvite.type === 'candidate' ? 'upload screen' : 'evaluation queue'}.
                </p>
              </div>

              {/* Link Details Card */}
              <div className="bg-[#F5F2EE] p-4 rounded-2xl border border-[#E8E5E1] space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-red-900/60 uppercase text-[10px]">Access Token</span>
                  <span className="font-mono font-extrabold text-red-700 px-2 py-0.5 bg-white rounded border border-red-200">
                    {createdInvite.token}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-red-900/60 uppercase text-[10px]">Recipient</span>
                  <span className="font-semibold text-[#101010]">
                    {createdInvite.recipientName} ({createdInvite.recipientEmail || 'Direct link'})
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-red-900/60 uppercase text-[10px]">Valid Until</span>
                  <span className="text-[#101010]">
                    {new Date(createdInvite.expiresAt).toLocaleDateString()} at{' '}
                    {new Date(createdInvite.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Copyable URL input bar */}
                <div className="pt-2">
                  <label className="block text-[10px] font-bold text-red-900/60 uppercase mb-1">
                    Direct Portal URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={getFullUrl(createdInvite.token, createdInvite.type)}
                      className="flex-1 rounded-xl border border-[#E8E5E1] bg-white px-3 py-2 text-xs font-mono text-[#101010] select-all focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(createdInvite.token, createdInvite.type)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer shadow-xs shadow-red-500/20"
                    >
                      <span className="material-symbols-outlined text-sm">{copied ? 'done' : 'content_copy'}</span>
                      <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Zero login notice banner */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2.5 text-xs text-emerald-900">
                <span className="material-symbols-outlined text-emerald-600 text-lg shrink-0">verified_user</span>
                <div>
                  <span className="font-bold">Zero Login Barrier:</span> {createdInvite.recipientName} does{' '}
                  <strong>not need a password or separate login</strong>. Clicking the link authenticates them directly to{' '}
                  {createdInvite.type === 'candidate' ? 'record/upload their video' : 'grade the assigned submission'}.
                </div>
              </div>

              {/* Action Buttons & Share via WhatsApp / Email */}
              <div className="space-y-3 pt-2 border-t border-[#E8E5E1]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-red-900/60 uppercase">Share Directly:</span>
                  
                  {/* WhatsApp Share */}
                  <button
                    type="button"
                    onClick={() => {
                      const shareUrl = getFullUrl(createdInvite.token, createdInvite.type);
                      const text = createdInvite.type === 'candidate'
                        ? `Hello ${createdInvite.recipientName}, here is your private link to record and upload your video submission for ${createdInvite.roleApplied || 'the open position'}: ${shareUrl}`
                        : `Hello ${createdInvite.recipientName}, here is your private evaluation link to review candidate submissions: ${shareUrl}`;
                      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span className="material-symbols-outlined text-sm">chat</span>
                    <span>Share via WhatsApp</span>
                  </button>

                  {/* Email Share */}
                  <button
                    type="button"
                    onClick={() => {
                      const shareUrl = getFullUrl(createdInvite.token, createdInvite.type);
                      const subject = createdInvite.type === 'candidate'
                        ? `Video Submission Link - ${createdInvite.roleApplied || 'Interview'}`
                        : `Evaluation Review Assignment - Candidate Evaluation`;
                      const body = createdInvite.type === 'candidate'
                        ? `Hi ${createdInvite.recipientName},\n\nPlease use the following link to record or upload your self-introduction video for ${createdInvite.roleApplied || 'the role'}:\n\n${shareUrl}\n\nNote: No login is required. Simply click the link to begin.\n\nBest regards,\nP2P Admin`
                        : `Hi ${createdInvite.recipientName},\n\nPlease use the following link to evaluate candidate submissions:\n\n${shareUrl}\n\nNote: No login is required. Simply click the link to begin grading.\n\nBest regards,\nP2P Admin`;
                      window.open(`mailto:${encodeURIComponent(createdInvite.recipientEmail || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
                    }}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span className="material-symbols-outlined text-sm">mail</span>
                    <span>Share via Email</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCreatedInvite(null)}
                    className="text-xs font-semibold text-red-700 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">add_link</span>
                    Create another link
                  </button>

                  <div className="flex items-center gap-2">
                    {onTestLink && (
                      <button
                        type="button"
                        onClick={() => {
                          onTestLink(createdInvite);
                          onClose();
                        }}
                        className="px-4 py-2 border border-red-300 bg-white hover:bg-red-50 text-red-700 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                        Open Link as {createdInvite.type === 'candidate' ? 'User' : 'Manager / Employer'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
