import React, { useEffect, useState } from 'react';
import { CandidateVideo, User } from '../types';
import { fetchAssignableSubmissions, getSubmissionId, groupVideosBySubmission } from '../utils/submissions';

interface NewAssignmentModalProps {
  evaluators: User[];
  defaultVideoId?: string;
  onClose: () => void;
  onAssignSubmit: (assignment: {
    videoId: string;
    evaluatorId: string;
    priority: 'normal' | 'urgent';
    slaHours: number;
  }) => Promise<void>;
}

export const NewAssignmentModal: React.FC<NewAssignmentModalProps> = ({
  evaluators,
  defaultVideoId,
  onClose,
  onAssignSubmit,
}) => {
  const [assignableVideos, setAssignableVideos] = useState<CandidateVideo[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState(defaultVideoId || '');
  const [selectedEvaluatorId, setSelectedEvaluatorId] = useState(evaluators[0]?.id || '');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [slaHours, setSlaHours] = useState(24);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const assignableSubmissions = groupVideosBySubmission(assignableVideos);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoadingVideos(true);
    setLoadError(null);
    fetchAssignableSubmissions(controller.signal)
      .then((submissionVideos) => {
        const representatives = groupVideosBySubmission(submissionVideos).map((submission) => submission.videos[0]);
        setAssignableVideos(submissionVideos);
        setSelectedVideoId((current) => {
          const preferred = defaultVideoId || current;
          const preferredSubmissionId = submissionVideos.find((video) => video.id === preferred);
          return representatives.find((video) => getSubmissionId(video) === (preferredSubmissionId
            ? getSubmissionId(preferredSubmissionId)
            : preferred))?.id || representatives[0]?.id || '';
        });
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setAssignableVideos([]);
          setLoadError(error instanceof Error ? error.message : 'Could not load submissions ready for assignment.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingVideos(false);
      });
    return () => controller.abort();
  }, [defaultVideoId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmissionError(null);
    if (!selectedVideoId || !selectedEvaluatorId || assignableVideos.length === 0 || evaluators.length === 0) return;
    if (!Number.isInteger(slaHours) || slaHours < 4 || slaHours > 96) {
      setSubmissionError('SLA target must be between 4 and 96 hours.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onAssignSubmit({
        videoId: selectedVideoId,
        evaluatorId: selectedEvaluatorId,
        priority,
        slaHours,
      });
      onClose();
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Could not dispatch this assignment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-[#E8E5E1] animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-[#E8E5E1] flex justify-between items-center bg-gradient-to-r from-red-50/50 via-white to-red-50/30">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-red-600 text-xl">assignment_add</span>
            <h3 className="font-bold text-sm text-[#101010]">Assign Candidate Submission</h3>
          </div>
          <button onClick={onClose} className="text-[#8A8580] hover:text-red-700 cursor-pointer">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {isLoadingVideos && (
            <p className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">Loading submissions ready for assignment...</p>
          )}
          {loadError && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{loadError}</p>
          )}
          {!isLoadingVideos && !loadError && assignableVideos.length === 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              No submissions are ready. Every video in a submission must be approved. Previously reviewed submissions can be assigned to a different employer.
            </p>
          )}
          {evaluators.length === 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              Add an evaluator account before dispatching assignments.
            </p>
          )}
          <div>
            <label className="block text-xs font-semibold text-[#101010] mb-1">Select Approved Submission</label>
            <select
              value={selectedVideoId}
              onChange={(e) => setSelectedVideoId(e.target.value)}
              disabled={isLoadingVideos || Boolean(loadError) || assignableVideos.length === 0}
              className="w-full rounded-xl border border-[#E8E5E1] px-3 py-2 text-xs text-[#101010] focus:ring-1 focus:ring-red-500 focus:border-red-500 focus:outline-none bg-white cursor-pointer disabled:cursor-not-allowed disabled:bg-gray-100"
            >
              <option value="">-- Select a submission --</option>
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

          <div>
            <label className="block text-xs font-semibold text-[#101010] mb-1">Assign Manager / Employer</label>
            <select
              value={selectedEvaluatorId}
              onChange={(e) => setSelectedEvaluatorId(e.target.value)}
              className="w-full rounded-xl border border-[#E8E5E1] px-3 py-2 text-xs text-[#101010] focus:ring-1 focus:ring-red-500 focus:border-red-500 focus:outline-none bg-white cursor-pointer"
            >
              {evaluators.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} ({ev.department || 'Manager / Employer'}) — {ev.assignedCount || 0} active
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#101010] mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'normal' | 'urgent')}
                className="w-full rounded-xl border border-[#E8E5E1] px-3 py-2 text-xs text-[#101010] focus:ring-1 focus:ring-red-500 focus:border-red-500 focus:outline-none bg-white cursor-pointer"
              >
                <option value="normal">Standard Priority</option>
                <option value="urgent">Urgent (Expedited)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#101010] mb-1">SLA Target (Hours)</label>
              <input
                type="number"
                min={4}
                max={96}
                value={slaHours}
                onChange={(e) => setSlaHours(Number(e.target.value))}
                className="w-full rounded-xl border border-[#E8E5E1] px-3 py-2 text-xs text-[#101010] focus:ring-1 focus:ring-red-500 focus:border-red-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="p-3 bg-red-50/40 border border-red-100 rounded-xl text-[11px] text-red-900/80 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-red-600">schedule</span>
            <span>Manager / Employer will receive an automated reminder after {Math.round(slaHours * 0.75)} hours.</span>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            {submissionError && <p role="alert" className="mr-auto self-center text-xs font-semibold text-red-700">{submissionError}</p>}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#8A8580] hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoadingVideos || Boolean(loadError) || assignableVideos.length === 0 || evaluators.length === 0}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white rounded-xl text-xs font-bold transition-all shadow-xs shadow-red-500/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-base">send</span>
              {isSubmitting ? 'Assigning...' : 'Assign Submission'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
