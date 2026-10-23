import React, { useEffect, useRef, useState } from 'react';
import { CandidateVideo } from '../types';
import { groupVideosBySubmission } from '../utils/submissions';

interface AdminAssignmentsViewProps {
  videos: CandidateVideo[];
  focusSubmissionId?: string;
  refreshKey?: number;
  onOpenAssignment: (videoId?: string) => void;
  onSelectCandidateVideo: (video: CandidateVideo) => void;
}

export const AdminAssignmentsView: React.FC<AdminAssignmentsViewProps> = ({
  videos,
  focusSubmissionId,
  refreshKey = 0,
  onOpenAssignment,
  onSelectCandidateVideo,
}) => {
  const [submissionVideos, setSubmissionVideos] = useState<CandidateVideo[]>([]);
  const [search, setSearch] = useState('');
  const [reviewStatus, setReviewStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const focusedSubmissionRef = useRef<HTMLElement | null>(null);
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const loadSubmissions = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(pageSize),
          search: search.trim(),
          reviewStatus,
        });
        const response = await fetch(`/api/submissions?${params.toString()}`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not load submission reviews.');
        setSubmissionVideos(Array.isArray(result.items) ? result.items : []);
        setTotal(Number(result.total) || 0);
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoadError(error instanceof Error ? error.message : 'Could not load submission reviews.');
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    void loadSubmissions();
    return () => controller.abort();
  }, [page, pageSize, search, reviewStatus, refreshKey]);

  useEffect(() => setPage(1), [pageSize, search, reviewStatus]);

  useEffect(() => {
    if (focusSubmissionId) {
      setSearch(focusSubmissionId);
      setExpandedSubmissionId(focusSubmissionId);
    }
  }, [focusSubmissionId]);

  useEffect(() => {
    if (!isLoading && focusSubmissionId && submissionVideos.some((video) => (video.submissionId || video.submissionBatchId || video.id) === focusSubmissionId)) {
      focusedSubmissionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [focusSubmissionId, isLoading, submissionVideos]);

  useEffect(() => {
    if (!videos.length || !submissionVideos.length) return;
    const currentById = new Map(videos.map((video) => [video.id, video]));
    setSubmissionVideos((current) => current.map((video) => currentById.get(video.id) || video));
  }, [videos]);

  const groups = groupVideosBySubmission(submissionVideos);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white p-6 rounded-2xl border border-[#F5DADB] shadow-xs">
        <div>
          <h2 className="text-2xl font-bold text-[#1F1617]">Submission Review & Assignments</h2>
          <p className="text-xs text-red-900/60 mt-1">
            Review every video from a candidate upload. Assignment becomes available after the entire upload is approved.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-[#F5DADB] bg-white p-4 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search submissions</span>
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base text-[#9CA3AF]">search</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search candidate, email, role, or submission ID"
            className="w-full rounded-xl border border-[#F5DADB] py-2 pl-9 pr-3 text-xs focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </label>
        <label>
          <span className="sr-only">Filter submissions</span>
          <select
            value={reviewStatus}
            onChange={(event) => setReviewStatus(event.target.value)}
            className="w-full rounded-xl border border-[#F5DADB] bg-white px-3 py-2 text-xs sm:w-52"
          >
            <option value="all">All submissions</option>
            <option value="awaiting_review">Awaiting review</option>
            <option value="approved">Approved</option>
            <option value="waiting_reupload">Waiting for reupload</option>
            <option value="assigned">Assigned</option>
            <option value="unassigned">Unassigned</option>
          </select>
        </label>
      </div>

      {loadError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{loadError}</div>}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-[#F5DADB] p-10 text-center text-sm text-[#6B7280]">Loading submissions...</div>
      ) : total === 0 ? (
        <div className="bg-white rounded-2xl border border-[#F5DADB] p-10 text-center text-sm text-[#6B7280]">No candidate uploads to review.</div>
      ) : (
        groups.map(({ id: submissionId, videos: batchVideos }) => {
          const firstVideo = batchVideos[0];
          const allApproved = batchVideos.every((video) => video.adminConfirmed && video.adminReviewStatus === 'accepted');
          const assignedCount = batchVideos.filter((video) => video.assignedEvaluatorId).length;
          const unassignedVideo = batchVideos.find((video) => !video.assignedEvaluatorId && video.status !== 'completed');
          const employerEvaluation = batchVideos.find((video) => video.evaluation)?.evaluation;
          const employerReviewed = batchVideos.every((video) => video.status === 'completed' && video.evaluation);
          const submissionRejected = employerEvaluation?.decision === 'rejected' || employerEvaluation?.decision === 'reject';
          const employerDecision = submissionRejected
            ? 'Submission rejected'
            : employerEvaluation?.decision === 'selected' || employerEvaluation?.decision === 'shortlist'
            ? 'Selected'
            : employerEvaluation?.decision === 'hold'
            ? 'On hold'
            : '';
          const evaluationRubric = employerEvaluation?.rubricWeights
            || Object.keys(employerEvaluation?.scores || {}).map((criterionId) => ({
              id: criterionId,
              name: criterionId.replace(/([A-Z])/g, ' $1').replace(/^./, (character) => character.toUpperCase()),
              weight: 0,
            }));
          const isExpanded = expandedSubmissionId === submissionId;
          return (
            <section
              key={submissionId}
              ref={submissionId === focusSubmissionId ? focusedSubmissionRef : undefined}
              className={`scroll-mt-24 rounded-2xl border bg-white overflow-hidden shadow-xs ${
                submissionId === focusSubmissionId ? 'border-red-500 ring-2 ring-red-200' : 'border-[#F5DADB]'
              }`}
            >
              <div className="flex flex-col sm:flex-row justify-between gap-3 p-5 border-b border-[#F5DADB] bg-red-50/30">
                <div>
                  <h3 className="font-bold text-sm text-[#1F1617]">{firstVideo.candidateName}</h3>
                  <p className="text-[10px] text-[#6B7280]">Submission ID: {submissionId}</p>
                  <p className="text-[11px] text-[#6B7280]">{firstVideo.candidateEmail} · {firstVideo.roleApplied} · {batchVideos.length} uploaded video{batchVideos.length === 1 ? '' : 's'}</p>
                  <p className={`mt-1 text-[11px] font-bold ${allApproved ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {allApproved ? 'All videos approved' : `${batchVideos.filter((video) => video.adminConfirmed).length} of ${batchVideos.length} approved`}
                  </p>
                </div>
                {allApproved && unassignedVideo && (
                  <button
                    type="button"
                    onClick={() => onOpenAssignment(unassignedVideo.id)}
                    className="self-start px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold"
                  >
                    Assign to Manager / Employer
                  </button>
                )}
                {assignedCount > 0 && (
                  <span className="self-start px-3 py-2 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-bold">
                    {assignedCount} of {batchVideos.length} assigned · {batchVideos.find((video) => video.assignedEvaluatorName)?.assignedEvaluatorName || 'Manager / Employer'}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                    employerReviewed
                      ? submissionRejected ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                      : assignedCount > 0 ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {employerReviewed
                      ? employerDecision
                      : assignedCount > 0 ? 'Awaiting Manager / Employer review' : 'Ready for assignment'}
                  </span>
                  {employerReviewed && employerEvaluation && (
                    <>
                      <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-800">
                        Submission score <span className="text-base">{employerEvaluation.overallScore}</span><span className="text-[10px] font-medium"> / 100</span>
                      </span>
                      <span className="text-[11px] text-[#6B7280]">
                        Reviewed by {employerEvaluation.evaluatorName}
                        {employerEvaluation.evaluatedAt ? ` · ${new Date(employerEvaluation.evaluatedAt).toLocaleDateString()}` : ''}
                      </span>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedSubmissionId(isExpanded ? null : submissionId)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white px-3.5 py-2 text-xs font-bold text-red-700 transition-colors hover:bg-red-50"
                >
                  <span className="material-symbols-outlined text-base">{isExpanded ? 'expand_less' : 'expand_more'}</span>
                  {isExpanded ? 'Hide submission details' : employerReviewed ? 'View result & scoring' : 'View submission details'}
                </button>
              </div>

              {isExpanded && (
                <div className="border-t border-[#F5DADB] bg-[#FCFAFA] p-5">
                  {employerReviewed && employerEvaluation ? (
                    <div className="space-y-5">
                      <div className={`rounded-2xl border p-4 ${
                        submissionRejected ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'
                      }`}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B7280]">Whole-submission decision</p>
                            <h4 className={`mt-1 text-lg font-extrabold ${submissionRejected ? 'text-rose-800' : 'text-emerald-800'}`}>
                              {employerDecision}
                            </h4>
                          </div>
                          <div className="rounded-xl bg-white/80 px-4 py-2 text-right">
                            <span className="block text-[10px] font-bold uppercase tracking-wide text-[#6B7280]">Overall score</span>
                            <span className="text-2xl font-black text-[#1F1617]">{employerEvaluation.overallScore}</span>
                            <span className="text-xs font-semibold text-[#6B7280]"> / 100</span>
                          </div>
                        </div>
                        {employerEvaluation.notes && (
                          <div className="mt-4 rounded-xl border border-white/80 bg-white/80 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-[#6B7280]">Manager / Employer feedback</p>
                            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-[#374151]">{employerEvaluation.notes}</p>
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-bold text-[#1F1617]">Scoring breakdown</h4>
                            <p className="mt-0.5 text-[11px] text-[#6B7280]">Scores and rubric weights are for this submission as a whole.</p>
                          </div>
                          <span className="text-[10px] text-[#6B7280]">Weighted points contribute to the overall score</span>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {evaluationRubric.map((criterion) => {
                            const score = employerEvaluation.scores[criterion.id] || 0;
                            const weightedPoints = criterion.weight > 0 ? (score / 5) * criterion.weight : null;
                            return (
                              <div key={criterion.id} className="rounded-xl border border-[#F5DADB] bg-white p-3.5">
                                <div className="flex items-start justify-between gap-3">
                                  <span className="text-xs font-bold text-[#1F1617]">{criterion.name}</span>
                                  <span className="shrink-0 rounded-lg bg-red-50 px-2 py-1 text-xs font-extrabold text-red-700">{score} / 5</span>
                                </div>
                                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                                  <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-rose-700" style={{ width: `${Math.max(0, Math.min(100, score * 20))}%` }} />
                                </div>
                                <div className="mt-2 flex justify-between text-[10px] text-[#6B7280]">
                                  <span>{criterion.weight ? `${criterion.weight}% weight` : 'Rubric score'}</span>
                                  {weightedPoints !== null && <span>{weightedPoints.toFixed(1)} weighted points</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {(employerEvaluation.keyStrengths?.length || employerEvaluation.areasToImprove?.length) && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {employerEvaluation.keyStrengths && employerEvaluation.keyStrengths.length > 0 && (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                              <h5 className="text-xs font-bold text-emerald-900">Key strengths</h5>
                              <ul className="mt-2 space-y-1.5 text-xs text-emerald-900/80">
                                {employerEvaluation.keyStrengths.map((strength, index) => <li key={`${index}-${strength}`}>• {strength}</li>)}
                              </ul>
                            </div>
                          )}
                          {employerEvaluation.areasToImprove && employerEvaluation.areasToImprove.length > 0 && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                              <h5 className="text-xs font-bold text-amber-900">Areas for improvement</h5>
                              <ul className="mt-2 space-y-1.5 text-xs text-amber-900/80">
                                {employerEvaluation.areasToImprove.map((area, index) => <li key={`${index}-${area}`}>• {area}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                      {assignedCount > 0 ? 'The Manager / Employer is still reviewing this submission.' : 'This submission is awaiting assignment.'}
                    </div>
                  )}

                  <div className="mt-5 overflow-hidden rounded-xl border border-[#F5DADB] bg-white">
                    <div className="border-b border-[#F5DADB] bg-red-50/50 px-4 py-3">
                      <h4 className="text-xs font-bold text-[#1F1617]">Submitted videos in this submission</h4>
                      <p className="mt-0.5 text-[10px] text-[#6B7280]">Videos are listed for reference; the employer decision applies to the entire submission.</p>
                    </div>
                    <div className="divide-y divide-red-50">
                {batchVideos.map((video, index) => (
                  <div key={video.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#1F1617]">
                        Video {index + 1} <span className="font-normal text-[#6B7280]">· {video.submissionType?.replace('_', ' ') || 'Video submission'}</span>
                      </p>
                      <p className="text-[11px] text-[#6B7280] mt-1">Submitted {video.submittedTimeAgo}</p>
                      {video.adminFeedback && (
                        <p className="mt-2 text-[11px] text-[#6B7280] line-clamp-2">Admin comment: {video.adminFeedback}</p>
                      )}
                    </div>
                    <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      video.adminReviewStatus === 'accepted'
                        ? 'bg-emerald-100 text-emerald-800'
                        : video.adminReviewStatus === 'reupload_requested'
                        ? 'bg-amber-100 text-amber-800'
                        : video.wasReuploaded
                        ? 'bg-violet-100 text-violet-800'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {video.adminReviewStatus === 'accepted'
                        ? 'Approved'
                        : video.adminReviewStatus === 'reupload_requested'
                        ? 'Waiting for reupload'
                        : video.wasReuploaded
                        ? 'Reuploaded · waiting for admin approval'
                        : 'Awaiting review'}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectCandidateVideo(video)}
                      disabled={Boolean(video.assignedEvaluatorId) || video.status === 'completed'}
                      className="shrink-0 px-3.5 py-2 border border-red-200 text-red-700 hover:bg-red-50 rounded-xl text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {video.assignedEvaluatorId || video.status === 'completed' ? 'Review closed' : video.adminConfirmed ? 'Review / update' : 'Review video'}
                    </button>
                  </div>
                ))}
              </div>
                  </div>
                </div>
              )}
            </section>
          );
        })
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-[#F5DADB] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs text-[#6B7280]">
          <span>Submissions per page</span>
          <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="rounded-lg border border-[#F5DADB] bg-white px-2 py-1.5 text-xs" aria-label="Submissions per page">
            <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option>
          </select>
          <span>· Showing {total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)} of {total}</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || isLoading} className="rounded-lg border border-[#F5DADB] px-3 py-1.5 text-xs font-semibold text-[#6B7280] disabled:opacity-40">Previous</button>
          <span className="min-w-16 text-center text-xs text-[#6B7280]">Page {page} of {pageCount}</span>
          <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page >= pageCount || isLoading} className="rounded-lg border border-[#F5DADB] px-3 py-1.5 text-xs font-semibold text-[#6B7280] disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
};
