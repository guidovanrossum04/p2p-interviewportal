import React, { useEffect, useState } from 'react';
import { Camera, Upload } from 'lucide-react';
import { CandidateVideo, User, InviteType, InviteLink, CandidateAnswerMode } from '../types';
import { fetchAssignableSubmissions, groupVideosBySubmission } from '../utils/submissions';
import p2pLogo from '../../assets/p2plogo.webp';

const toDateTimeLocalValue = (date: Date) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
};

const candidateQuestions = [
  'Please tell me a little bit about yourself. For example, who you are, your employment history and your current achievements?',
  'Tell me about a time that you provided outstanding customer service?',
  'How would you deal with a difficult patient?',
  'If you were in a situation where you could not read the prescription, what would you do?',
  'Describe a clinical intervention that you have made?',
  'The role as a pharmacist requires you to lead and manage your team. Describe to me how you will lead and manage your team effectively?',
];

const candidateInvitationTemplate = `Subject Line: P2P: Your Next Steps for our Overseas Pharmacist Position

Thank you for commencing the application process for our Overseas Pharmacist position.

We invite you to the next step, which is an online video interview. This will help you stand out when we present you to potential employers and hiring managers.

You can complete this interview using a computer or laptop with a webcam and microphone or from an iPhone, iPad or Android mobile device. If you use a mobile phone or iPad you will need to lock your screen to ensure the image does not flip after recording.

Please click the link provided in this email from the device you would like to use to record your interview when you are ready. Please read the video interview tips before commencing the process.

Kind regards

Ivor North

P2P Recruitment

“Connecting professionals 2 professionals”`;
const candidateInvitationLines = candidateInvitationTemplate.split('\n');
const candidateSignoffIndex = candidateInvitationLines.findIndex((line) => line.trim() === 'Kind regards');
const candidateInvitationBody = candidateInvitationLines.slice(2, candidateSignoffIndex).join('\n').trim();
const candidateInvitationSignoff = candidateInvitationLines.slice(candidateSignoffIndex).filter((line) => line.trim());

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
    answerMode?: CandidateAnswerMode;
    videoCount?: number;
    questionPrompt?: string;
    questionPrompts?: string[];
    adminSupportingDocuments?: File[];
  }) => Promise<InviteLink>;
}

export const CreateInviteLinkModal: React.FC<CreateInviteLinkModalProps> = ({
  evaluators,
  defaultType = 'candidate',
  onClose,
  onCreateInvite,
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
  const [isCandidateSearchFocused, setIsCandidateSearchFocused] = useState(false);
  const [candidateResults, setCandidateResults] = useState<Array<{ name: string; email: string; roleApplied?: string }>>([]);
  const [isSearchingCandidates, setIsSearchingCandidates] = useState(false);
  const [candidateSearchError, setCandidateSearchError] = useState<string | null>(null);
  const [roleApplied, setRoleApplied] = useState('Senior Frontend Engineer');
  const [answerMode, setAnswerMode] = useState<CandidateAnswerMode>('upload');
  const [selectedQuestionIndexes, setSelectedQuestionIndexes] = useState<number[]>(candidateQuestions.map((_, index) => index));
  const [isQuestionDropdownOpen, setIsQuestionDropdownOpen] = useState(false);
  const [adminSupportingDocuments, setAdminSupportingDocuments] = useState<File[]>([]);
  const [assignedVideoId, setAssignedVideoId] = useState('');
  const selectedQuestionPrompts = selectedQuestionIndexes.map((index) => candidateQuestions[index]).filter(Boolean);
  const derivedVideoCount = selectedQuestionPrompts.length || 1;
  const [expiresAt, setExpiresAt] = useState(() => toDateTimeLocalValue(new Date(Date.now() + 48 * 60 * 60 * 1000)));
  const [candidateNotes, setCandidateNotes] = useState(candidateInvitationTemplate);
  const [evaluatorNotes, setEvaluatorNotes] = useState('');
  const notes = type === 'candidate' ? candidateNotes : evaluatorNotes;

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
    if (type !== 'candidate' || query.length < 2) {
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
    setIsCandidateSearchFocused(false);
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
      const inviteQuestionPrompts = type === 'candidate'
        ? (selectedQuestionPrompts.length ? selectedQuestionPrompts : [candidateQuestions[0]])
        : undefined;
      const invite = await onCreateInvite({
        type,
        recipientName,
        recipientEmail,
        roleApplied,
        department: '',
        assignedVideoId: type === 'evaluator' ? assignedVideoId : undefined,
        expiresAt: expiryDate.toISOString(),
        notes,
        answerMode: type === 'candidate' ? answerMode : undefined,
        videoCount: type === 'candidate' ? derivedVideoCount : undefined,
        questionPrompt: type === 'candidate' && inviteQuestionPrompts.length === 1 ? inviteQuestionPrompts[0] : undefined,
        questionPrompts: type === 'candidate' ? inviteQuestionPrompts : undefined,
        adminSupportingDocuments: type === 'evaluator' ? adminSupportingDocuments : undefined,
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

  const handleWhatsAppShare = () => {
    if (!createdInvite) return;
    const shareUrl = getFullUrl(createdInvite.token, createdInvite.type);
    const expiresAt = new Date(createdInvite.expiresAt);
    const expiryText = Number.isNaN(expiresAt.getTime())
      ? 'Expiry date unavailable'
      : `Valid until ${expiresAt.toLocaleDateString()} at ${expiresAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const text = createdInvite.type === 'candidate'
      ? `*P2P Recruitment — Video Submission Invitation*\n\nHello ${createdInvite.recipientName},\n\nPlease use your secure link to ${createdInvite.answerMode === 'record' ? 'record' : 'upload'} the requested video response for *${createdInvite.roleApplied || 'the open position'}*:\n${shareUrl}\n\n${expiryText}\n\nNo login is required.\n\nThank you,\n*P2P Recruitment*`
      : `*P2P Recruitment — Review Invitation*\n\nHello ${createdInvite.recipientName},\n\nPlease use your secure link to review the assigned candidate submission:\n${shareUrl}\n\n${expiryText}\n\nThank you,\n*P2P Recruitment*`;

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      id="create-invite-link-modal"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden border border-[#E8E5E1] flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#E8E5E1] flex justify-between items-center bg-white">
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
                    onFocus={() => setIsCandidateSearchFocused(true)}
                    onBlur={() => window.setTimeout(() => setIsCandidateSearchFocused(false), 150)}
                    onChange={(event) => {
                      setCandidateSearch(event.target.value);
                      setRecipientName('');
                      setRecipientEmail('');
                    }}
                    placeholder="Search by candidate name or email"
                    className="w-full rounded-xl border border-[#E8E5E1] px-3 py-2 text-xs text-[#101010] focus:ring-1 focus:ring-red-500 focus:border-red-500 focus:outline-none bg-white"
                  />
                  {isCandidateSearchFocused && candidateSearch.trim().length >= 2 && (
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
                            onMouseDown={(event) => event.preventDefault()}
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

              {type === 'candidate' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#101010] mb-2">Candidate response method</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        aria-pressed={answerMode === 'upload'}
                        onClick={() => setAnswerMode('upload')}
                        className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition-colors ${
                          answerMode === 'upload'
                            ? 'border-[#101010] bg-[#101010] text-white'
                            : 'border-[#E8E5E1] bg-white text-[#101010] hover:border-red-500'
                        }`}
                      >
                        <Upload aria-hidden="true" className="h-4 w-4" />
                        Upload video
                      </button>
                      <button
                        type="button"
                        aria-pressed={answerMode === 'record'}
                        onClick={() => setAnswerMode('record')}
                        className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition-colors ${
                          answerMode === 'record'
                            ? 'border-[#101010] bg-[#101010] text-white'
                            : 'border-[#E8E5E1] bg-white text-[#101010] hover:border-red-500'
                        }`}
                      >
                        <Camera aria-hidden="true" className="h-4 w-4" />
                        Record video
                      </button>
                    </div>
                    <p className="mt-1 text-[10px] text-[#5A5550]">
                      Candidates using this link will only be able to {answerMode === 'record' ? 'record' : 'upload'} their video responses.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#101010] mb-2">Question</label>
                    <div className="relative">
                      <button
                        type="button"
                        aria-expanded={isQuestionDropdownOpen}
                        aria-haspopup="listbox"
                        onClick={() => setIsQuestionDropdownOpen((open) => !open)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#E8E5E1] bg-white px-3 py-2.5 text-left text-xs text-[#101010] hover:border-red-500 focus:border-red-500 focus:outline-none"
                      >
                        <span className="truncate">
                          {selectedQuestionIndexes.length === candidateQuestions.length
                            ? 'All questions selected'
                            : `${selectedQuestionIndexes.length} question${selectedQuestionIndexes.length === 1 ? '' : 's'} selected`}
                        </span>
                        <span aria-hidden="true" className="text-sm text-[#4D4A47]">{isQuestionDropdownOpen ? '▴' : '▾'}</span>
                      </button>
                      {isQuestionDropdownOpen && (
                        <div role="listbox" aria-label="Select candidate questions" aria-multiselectable="true" className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-[#E8E5E1] bg-white p-2 shadow-lg">
                          <button
                            type="button"
                            role="option"
                            aria-selected={selectedQuestionIndexes.length === candidateQuestions.length}
                            onClick={() => setSelectedQuestionIndexes((current) => (
                              current.length === candidateQuestions.length
                                ? [0]
                                : candidateQuestions.map((_, index) => index)
                            ))}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-bold text-[#101010] hover:bg-red-50"
                          >
                            <input type="checkbox" readOnly checked={selectedQuestionIndexes.length === candidateQuestions.length} className="accent-red-600" />
                            All questions
                          </button>
                          {candidateQuestions.map((option, index) => {
                            const selected = selectedQuestionIndexes.includes(index);
                            return (
                              <button
                                key={option}
                                type="button"
                                role="option"
                                aria-selected={selected}
                                onClick={() => {
                                  setSelectedQuestionIndexes((current) => {
                                    if (current.includes(index)) {
                                      const next = current.filter((value) => value !== index);
                                      return next.length ? next : [index];
                                    }
                                    return [...current, index].sort((a, b) => a - b);
                                  });
                                }}
                                className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-[11px] leading-4 text-[#101010] hover:bg-red-50"
                              >
                                <input type="checkbox" readOnly checked={selected} className="mt-0.5 accent-red-600" />
                                <span>{option}</span>
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => setIsQuestionDropdownOpen(false)}
                            className="mt-1 w-full rounded-lg bg-[#101010] px-3 py-2 text-[11px] font-bold text-white hover:bg-red-700"
                          >
                            Done
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Evaluator Assignment Target Video */}
              {type === 'evaluator' && (
                <div>
                  <label className="block text-xs font-semibold text-[#101010] mb-1">Supporting Documents (optional)</label>
                  <p className="mb-2 text-[11px] text-[#5A5550]">Admin-provided files for the assigned submission. Candidates will not be asked to upload these.</p>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"
                    onChange={(event) => {
                      const files: File[] = event.currentTarget.files ? Array.from(event.currentTarget.files) : [];
                      if (files.length > 20) {
                        setAdminSupportingDocuments([]);
                        setErrorMessage('Select no more than 20 supporting documents.');
                        event.currentTarget.value = '';
                        return;
                      }
                      if (files.some((file) => file.size > 25 * 1024 * 1024)) {
                        setAdminSupportingDocuments([]);
                        setErrorMessage('Each supporting document must be 25 MB or smaller.');
                        event.currentTarget.value = '';
                        return;
                      }
                      setErrorMessage(null);
                      setAdminSupportingDocuments(files);
                    }}
                    className="block w-full rounded-xl border border-[#E8E5E1] bg-white px-3 py-2 text-[11px] text-[#4D4A47]"
                  />
                  {adminSupportingDocuments.length > 0 && (
                    <p className="mt-1 text-[11px] text-[#5A5550]">{adminSupportingDocuments.length} file{adminSupportingDocuments.length === 1 ? '' : 's'} selected</p>
                  )}
                </div>
              )}

              {type === 'evaluator' && (
                <div>
                  <label className="block text-xs font-semibold text-[#101010] mb-1">
                    Approved Candidate Submission *
                  </label>
                  {isLoadingAssignableVideos ? (
                    <p className="mb-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">Loading submissions ready for assignment...</p>
                  ) : assignableVideosError ? (
                    <p role="alert" className="mb-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{assignableVideosError}</p>
                  ) : assignableVideos.length === 0 && (
                    <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                      No submissions are ready. Every video in a submission must be approved. Previously reviewed submissions can be assigned to a different employer.
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
                <label htmlFor={type === 'candidate' ? undefined : 'invite-notes'} className="block text-xs font-semibold text-[#101010] mb-1">
                  {type === 'candidate' ? 'Candidate Invitation Email Preview' : 'Invitation Instructions / Notes (Optional)'}
                </label>
                {type === 'candidate' && (
                  <div className="overflow-hidden rounded-xl border border-[#E8E5E1] bg-white">
                    <div className="flex items-center gap-3 border-b border-[#E8E5E1] bg-[#F5F2EE] px-4 py-3">
                      <img src={p2pLogo} alt="P2P Recruitment" className="h-10 w-auto object-contain" />
                      <div className="text-[10px] text-[#5A5550]">
                        <p><strong>To:</strong> {recipientEmail || 'Candidate'}</p>
                        <p><strong>From:</strong> P2P Recruitment</p>
                      </div>
                      <span className="ml-auto rounded-full border border-[#E8E5E1] bg-white px-2 py-1 text-[9px] font-bold uppercase text-[#5A5550]">Read only</span>
                    </div>
                    <div className="border-b border-[#E8E5E1] px-4 py-3 text-xs">
                      <span className="font-bold text-[#5A5550]">Subject: </span>
                      <span className="font-semibold text-[#101010]">{candidateInvitationTemplate.split('\n')[0].replace(/^Subject Line:\s*/, '')}</span>
                    </div>
                    <div className="px-4 py-4 text-xs leading-6 text-[#101010]">
                      <p className="whitespace-pre-line">{candidateInvitationBody}</p>
                      <div className="mt-5 border-l-2 border-red-600 pl-3 leading-5">
                        {candidateInvitationSignoff.map((line, index) => (
                          <p key={line} className={index === candidateInvitationSignoff.length - 1
                            ? 'mt-1 italic text-[#5A5550]'
                            : index === 2 ? 'font-bold text-[#101010]' : 'text-[#101010]'}>
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {type === 'evaluator' && (
                  <textarea
                    id="invite-notes"
                    maxLength={4000}
                    rows={3}
                    value={evaluatorNotes}
                    onChange={(event) => setEvaluatorNotes(event.target.value)}
                    placeholder="Add optional review instructions..."
                    className="w-full rounded-xl border border-[#E8E5E1] px-3 py-2 text-xs text-[#101010] focus:ring-1 focus:ring-red-500 focus:border-red-500 focus:outline-none bg-white"
                  />
                )}
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
              <div className="p-4 bg-white rounded-2xl border border-[#E8E5E1] text-center space-y-2">
                <img src={p2pLogo} alt="P2P Recruitment" className="mx-auto h-14 w-auto object-contain" />
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                  <span className="material-symbols-outlined text-xl" aria-hidden="true">check_circle</span>
                </div>
                <h4 className="font-extrabold text-sm text-[#101010]">
                  {createdInvite.type === 'candidate' ? 'Candidate Upload Link Ready' : 'Manager / Employer Review Link Ready'}
                </h4>
              </div>

              {/* Link Details Card */}
              <div className="bg-[#F5F2EE] p-4 rounded-2xl border border-[#E8E5E1] space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-[#101010] uppercase text-[10px]">Recipient</span>
                  <span className="font-semibold text-[#101010]">
                    {createdInvite.recipientName} ({createdInvite.recipientEmail || 'Direct link'})
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-[#101010] uppercase text-[10px]">Valid Until</span>
                  <span className="text-[#101010]">
                    {new Date(createdInvite.expiresAt).toLocaleDateString()} at{' '}
                    {new Date(createdInvite.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Copyable URL input bar */}
                <div className="pt-2">
                  <label className="block text-[10px] font-bold text-[#101010] uppercase mb-1">
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

              {/* Share link directly via WhatsApp */}
              <div className="space-y-3 pt-2 border-t border-[#E8E5E1]">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleWhatsAppShare}
                    className="px-3 py-1.5 bg-[#25D366] hover:bg-[#1DA851] text-white rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <svg aria-hidden="true" viewBox="0 0 32 32" className="h-4 w-4 fill-current">
                      <path d="M16.04 3C8.86 3 3.02 8.82 3.02 15.98c0 2.3.61 4.55 1.77 6.53L3 29l6.67-1.75a13.1 13.1 0 0 0 6.36 1.63h.01c7.17 0 13.01-5.82 13.02-12.98A12.9 12.9 0 0 0 25.24 6.7 12.94 12.94 0 0 0 16.04 3Zm0 23.68h-.01a10.9 10.9 0 0 1-5.55-1.52l-.4-.24-3.96 1.04 1.06-3.85-.26-.42a10.78 10.78 0 0 1-1.66-5.72c0-5.94 4.83-10.77 10.78-10.77 2.88 0 5.59 1.12 7.63 3.16a10.7 10.7 0 0 1 3.16 7.62c-.01 5.94-4.85 10.7-10.79 10.7Zm5.92-8.05c-.32-.16-1.9-.94-2.2-1.05-.3-.1-.51-.16-.73.16-.21.32-.83 1.05-1.02 1.27-.19.21-.38.24-.7.08-.32-.16-1.34-.49-2.55-1.56-.95-.84-1.59-1.88-1.77-2.2-.19-.32-.02-.49.14-.65.14-.14.32-.38.48-.57.16-.19.21-.32.32-.54.1-.21.05-.4-.03-.56-.08-.16-.73-1.75-1-2.39-.26-.62-.52-.54-.72-.55h-.62c-.21 0-.56.08-.86.4-.3.32-1.13 1.1-1.13 2.69 0 1.59 1.16 3.13 1.32 3.35.16.21 2.28 3.48 5.53 4.88.77.33 1.37.53 1.84.68.77.24 1.47.21 2.02.13.62-.09 1.9-.78 2.17-1.53.27-.75.27-1.4.19-1.53-.08-.14-.29-.22-.61-.38Z"/>
                    </svg>
                    <span>Share via WhatsApp</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
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
