import React, { useEffect, useRef, useState } from 'react';
import { CandidateEvaluation, CandidateVideo } from '../types';
import { groupVideosBySubmission } from '../utils/submissions';
import { adminReviewRubric, standardEvaluationRubric } from '../data/adminReviewRubric';

const RatingStars: React.FC<{ score: number }> = ({ score }) => (
  <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${score} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((star) => (
      <span
        key={star}
        className={`material-symbols-outlined text-[16px] leading-none ${star <= score ? 'text-amber-400' : 'text-[#D6D3D1]'}`}
        aria-hidden="true"
      >
        star
      </span>
    ))}
  </span>
);

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
  const [expandedAdminReviewSubmissionId, setExpandedAdminReviewSubmissionId] = useState<string | null>(null);
  const [expandedEmployerReviewSubmissionId, setExpandedEmployerReviewSubmissionId] = useState<string | null>(null);
  const [selectedEmployerReviewKey, setSelectedEmployerReviewKey] = useState('');

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
      setExpandedAdminReviewSubmissionId(focusSubmissionId);
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
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white p-6 rounded-2xl border border-[#E8E5E1] shadow-xs">
        <div>
          <h2 className="text-2xl font-bold text-[#101010]">Submission Review & Assignments</h2>
          <p className="text-xs text-red-900/60 mt-1">
            Review every video from a candidate upload. Assignment becomes available after the entire upload is approved.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-[#E8E5E1] bg-white p-4 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search submissions</span>
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base text-[#8A8580]">search</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search candidate, email, role, or submission ID"
            className="w-full rounded-xl border border-[#E8E5E1] py-2 pl-9 pr-3 text-xs focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </label>
        <label>
          <span className="sr-only">Filter submissions</span>
          <select
            value={reviewStatus}
            onChange={(event) => setReviewStatus(event.target.value)}
            className="w-full rounded-xl border border-[#E8E5E1] bg-white px-3 py-2 text-xs sm:w-52"
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
        <div className="bg-white rounded-2xl border border-[#E8E5E1] p-10 text-center text-sm text-[#8A8580]">Loading submissions...</div>
      ) : total === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E8E5E1] p-10 text-center text-sm text-[#8A8580]">No candidate uploads to review.</div>
      ) : (
        groups.map(({ id: submissionId, videos: batchVideos }) => {
          const firstVideo = batchVideos[0];
          const allApproved = batchVideos.every((video) => video.adminConfirmed && video.adminReviewStatus === 'accepted');
          const assignedCount = batchVideos.filter((video) => video.assignedEvaluatorId).length;
          const reviewHistoryById = new Map<string, CandidateEvaluation>();
          batchVideos.forEach((video) => {
            (video.evaluationHistory || []).forEach((evaluation) => {
              const historyId = `${evaluation.evaluatorId}:${evaluation.evaluatedAt}:${evaluation.videoId || video.id}`;
              if (!reviewHistoryById.has(historyId)) reviewHistoryById.set(historyId, evaluation);
            });
          });
          const candidateReviewHistory = [...reviewHistoryById.values()]
            .sort((left, right) => new Date(right.evaluatedAt).getTime() - new Date(left.evaluatedAt).getTime());
          const employerEvaluation = batchVideos.find((video) => video.evaluation)?.evaluation;
          const employerReviewGroups = new Map<string, CandidateEvaluation[]>();
          candidateReviewHistory
            .filter((evaluation) => evaluation.submissionId === submissionId)
            .forEach((evaluation) => {
              employerReviewGroups.set(
                evaluation.evaluatorId,
                [...(employerReviewGroups.get(evaluation.evaluatorId) || []), evaluation],
              );
            });
          if (employerEvaluation && employerReviewGroups.size === 0) {
            employerReviewGroups.set(
              employerEvaluation.evaluatorId,
              [employerEvaluation],
            );
          }
          const employerReviews = Array.from(employerReviewGroups, ([reviewerId, reviews]) => ({ reviewerId, reviews }));
          const selectedEmployerReview = employerReviews.find((item) => item.reviewerId === selectedEmployerReviewKey)
            || employerReviews[0];
          const employerReviewed = batchVideos.every((video) => video.status === 'completed')
            && Boolean(employerEvaluation || employerReviews.length);
          const isAdminReviewExpanded = expandedAdminReviewSubmissionId === submissionId;
          const isEmployerReviewExpanded = expandedEmployerReviewSubmissionId === submissionId;
          return (
            <section
              key={submissionId}
              ref={submissionId === focusSubmissionId ? focusedSubmissionRef : undefined}
              className={`scroll-mt-24 rounded-2xl border bg-white overflow-hidden shadow-xs ${
                submissionId === focusSubmissionId ? 'border-red-500 ring-2 ring-red-200' : 'border-[#E8E5E1]'
              }`}
            >
              <div className="flex flex-col sm:flex-row justify-between gap-3 p-5 border-b border-[#E8E5E1] bg-red-50/30">
                <div>
                  <h3 className="font-bold text-sm text-[#101010]">{firstVideo.candidateName}</h3>
                  <p className="text-[11px] text-[#8A8580]">{firstVideo.candidateEmail} · {firstVideo.roleApplied} · {batchVideos.length} uploaded video{batchVideos.length === 1 ? '' : 's'}</p>
                  <p className={`mt-1 text-[11px] font-bold ${allApproved ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {allApproved ? 'All videos approved' : `${batchVideos.filter((video) => video.adminConfirmed).length} of ${batchVideos.length} approved`}
                  </p>
                </div>
                {allApproved && assignedCount === 0 && (
                  <button
                    type="button"
                    onClick={() => onOpenAssignment(firstVideo.id)}
                    className="self-start px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold"
                  >
                    Assign to Manager / Employer
                  </button>
                )}
                {assignedCount > 0 && (
                  <span className="self-start px-3 py-2 rounded-xl bg-gray-50 text-gray-700 text-xs font-bold">
                    {assignedCount} of {batchVideos.length} assigned · {batchVideos.find((video) => video.assignedEvaluatorName)?.assignedEvaluatorName || 'Manager / Employer'}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                    employerReviewed
                      ? 'bg-emerald-100 text-emerald-800'
                      : assignedCount > 0 ? 'bg-red-50 text-red-700' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {employerReviewed
                      ? 'Review completed'
                      : assignedCount > 0 ? 'Awaiting Manager / Employer review' : 'Ready for assignment'}
                  </span>
                  {employerReviewed && (
                    <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-800">
                      {employerReviews.length} Manager / Employer review{employerReviews.length === 1 ? '' : 's'} completed
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    aria-expanded={isAdminReviewExpanded}
                    onClick={() => setExpandedAdminReviewSubmissionId(isAdminReviewExpanded ? null : submissionId)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#D6D3D1] bg-white px-3.5 py-2 text-xs font-bold text-[#5A5550] transition-colors hover:bg-[#F5F5F4]"
                  >
                    <span className="material-symbols-outlined text-base">{isAdminReviewExpanded ? 'expand_less' : 'expand_more'}</span>
                    Admin Review
                  </button>
                  {assignedCount > 0 && (
                    <button
                      type="button"
                      aria-expanded={isEmployerReviewExpanded}
                      onClick={() => setExpandedEmployerReviewSubmissionId(isEmployerReviewExpanded ? null : submissionId)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#D6D3D1] bg-white px-3.5 py-2 text-xs font-bold text-[#5A5550] transition-colors hover:bg-[#F5F5F4]"
                    >
                      <span className="material-symbols-outlined text-base">{isEmployerReviewExpanded ? 'expand_less' : 'expand_more'}</span>
                      Employer Review
                    </button>
                  )}
                </div>
              </div>

              {(isAdminReviewExpanded || isEmployerReviewExpanded) && (
                <div className="border-t border-[#E8E5E1] bg-[#FFFFFF] p-5">
                  {isAdminReviewExpanded && (
                    <div className="space-y-5">
                  <section className="mb-5 overflow-hidden rounded-xl border border-[#E8E5E1] bg-white">
                    <div className="border-b border-[#E8E5E1] bg-[#101010] px-4 py-3 text-white">
                      <h4 className="text-xs font-bold">Admin review scoring</h4>
                      <p className="mt-0.5 text-[10px] text-white/70">Per-question ratings from the P2P admin review.</p>
                    </div>
                    <div className="divide-y divide-[#F1EEEA]">
                      {batchVideos.map((video, videoIndex) => {
                        const hasAdminScores = Object.keys(video.adminReviewScores || {}).length > 0;
                        const adminOverallRating = video.adminOverallRating
                          ?? (hasAdminScores
                            ? adminReviewRubric.reduce((sum, criterion) => sum + (Number(video.adminReviewScores?.[criterion.id]) || 0), 0) / adminReviewRubric.length
                            : null);
                        return (
                          <article key={video.id} className="space-y-2 px-4 py-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="text-xs font-bold text-[#101010]">Question {videoIndex + 1}</p>
                                <p className="mt-0.5 text-[11px] text-[#5A5550]">{video.questionPrompt || 'Question not specified'}</p>
                              </div>
                              {adminOverallRating !== null && (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFFFFF] px-2.5 py-1 text-[10px] font-bold text-[#101010]">
                                  Admin overall
                                  <RatingStars score={Math.round(adminOverallRating)} />
                                  {adminOverallRating.toFixed(1)}/5
                                </span>
                              )}
                            </div>
                            {hasAdminScores ? (
                              <div className="grid gap-2 sm:grid-cols-2">
                                {adminReviewRubric.map((criterion) => {
                                  const score = Math.max(0, Math.min(5, Number(video.adminReviewScores?.[criterion.id]) || 0));
                                  return (
                                    <div key={criterion.id} className="flex items-center justify-between gap-2 rounded-lg bg-[#F8F6F3] px-3 py-2">
                                      <span className="text-[10px] font-semibold text-[#101010]">{criterion.name}</span>
                                      <span className="inline-flex shrink-0 items-center gap-1.5">
                                        <RatingStars score={score} />
                                        <span className="text-[10px] font-bold text-[#5A5550]">{score}/5</span>
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-[10px] italic text-[#8A8580]">Admin ratings have not been submitted for this question.</p>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </section>
                  <div className="mb-5 overflow-hidden rounded-xl border border-[#E8E5E1] bg-white">
                    <div className="border-b border-[#E8E5E1] bg-red-50/50 px-4 py-3">
                      <h4 className="text-xs font-bold text-[#101010]">Submitted videos in this submission</h4>
                      <p className="mt-0.5 text-[10px] text-[#8A8580]">Each question and its admin feedback are listed below.</p>
                    </div>
                    <div className="divide-y divide-red-50">
                      {batchVideos.map((video, index) => (
                        <div key={video.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#101010]">Question {index + 1}</p>
                            <p className="mt-1 text-xs leading-relaxed text-[#5A5550]">
                              {video.questionPrompt || 'Question not specified'}
                            </p>
                            <p className="mt-1 text-[10px] text-[#8A8580]">Submitted {video.submittedTimeAgo}</p>
                            <p className="mt-2 text-[11px] leading-relaxed text-[#5A5550]">
                              <span className="font-bold text-[#101010]">Admin feedback: </span>
                              {video.adminFeedback?.trim() || 'No admin feedback provided.'}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                              video.adminReviewStatus === 'accepted'
                                ? 'bg-emerald-100 text-emerald-800'
                                : video.adminReviewStatus === 'reupload_requested'
                                ? 'bg-red-100 text-red-800'
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
                              className="rounded-xl border border-red-200 px-3.5 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {video.assignedEvaluatorId || video.status === 'completed' ? 'Review closed' : video.adminConfirmed ? 'Review / update' : 'Review video'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                    </div>
                  )}
                  {isEmployerReviewExpanded && (employerReviewed && employerEvaluation ? (
                    <div className="space-y-5">
                      <label className="block max-w-md text-xs font-semibold text-[#101010]">
                        Choose employer result
                        <select
                          value={selectedEmployerReview?.reviewerId || ''}
                          onChange={(event) => setSelectedEmployerReviewKey(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-[#E8E5E1] bg-white px-3 py-2 text-xs font-normal text-[#101010] focus:border-red-500 focus:outline-none"
                        >
                          {employerReviews.map(({ reviewerId, reviews }) => (
                            <option key={reviewerId} value={reviewerId}>
                              {reviews[0]?.evaluatorName || 'Manager / Employer'}
                              {reviews[0]?.evaluatedAt ? ` · ${new Date(reviews[0].evaluatedAt).toLocaleString()}` : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                      {selectedEmployerReview && (() => {
                        const review = selectedEmployerReview.reviews[0];
                        if (!review) return null;
                        const reviewRejected = review.decision === 'rejected' || review.decision === 'reject';
                        const reviewDecision = reviewRejected
                          ? 'Reject Candidate'
                          : review.decision === 'selected' || review.decision === 'shortlist'
                            ? 'Recruit Candidate'
                            : review.decision === 'hold' ? 'On hold' : 'Reviewed';
                        const reviewRubric = review.rubricWeights?.length
                          ? review.rubricWeights
                          : standardEvaluationRubric;
                        const overallRating = reviewRubric.reduce(
                          (total, criterion) => total + (Number(review.scores[criterion.id]) || 0),
                          0,
                        ) / reviewRubric.length;
                        return (
                          <section key={selectedEmployerReview.reviewerId} className="space-y-3 rounded-2xl border border-[#E8E5E1] bg-[#FAF9F7] p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <h4 className="text-sm font-bold text-[#101010]">Overall employer decision</h4>
                                <p className="mt-1 text-[11px] text-[#5A5550]">
                                  Reviewed by {review.evaluatorName || 'Manager / Employer'}
                                  {review.evaluatedAt ? ` · ${new Date(review.evaluatedAt).toLocaleString()}` : ''}
                                </p>
                              </div>
                              <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                                reviewRejected ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                              }`}>{reviewDecision}</span>
                            </div>
                            <div className="rounded-xl border border-[#E8E5E1] bg-white p-3">
                              <div className="mb-3 flex items-center justify-between">
                                <h5 className="text-xs font-bold text-[#101010]">Standard Evaluation Rubric</h5>
                                <span className="text-xs font-extrabold text-[#5A5550]">{overallRating.toFixed(1)} / 5</span>
                              </div>
                              <div className="grid gap-2 sm:grid-cols-2">
                                {reviewRubric.map((criterion) => {
                                  const score = Math.max(0, Math.min(5, Number(review.scores[criterion.id]) || 0));
                                  return (
                                    <div key={criterion.id} className="flex items-center justify-between gap-2 rounded-lg bg-[#FAF9F7] px-2.5 py-2">
                                      <span className="text-[11px] font-semibold text-[#101010]">{criterion.name}</span>
                                      <span className="flex shrink-0 items-center gap-1">
                                        <RatingStars score={score} />
                                        <span className="text-[10px] font-bold text-[#5A5550]">{score}/5</span>
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            {review.notes && (
                              <p className="whitespace-pre-wrap rounded-xl border border-[#E8E5E1] bg-white p-3 text-xs leading-relaxed text-[#5A5550]">
                                {review.notes}
                              </p>
                            )}
                          </section>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                      {assignedCount > 0 ? 'The Manager / Employer is still reviewing this submission.' : 'This submission is awaiting assignment.'}
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-[#E8E5E1] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs text-[#8A8580]">
          <span>Submissions per page</span>
          <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="rounded-lg border border-[#E8E5E1] bg-white px-2 py-1.5 text-xs" aria-label="Submissions per page">
            <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option>
          </select>
          <span>· Showing {total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)} of {total}</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || isLoading} className="rounded-lg border border-[#E8E5E1] px-3 py-1.5 text-xs font-semibold text-[#8A8580] disabled:opacity-40">Previous</button>
          <span className="min-w-16 text-center text-xs text-[#8A8580]">Page {page} of {pageCount}</span>
          <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page >= pageCount || isLoading} className="rounded-lg border border-[#E8E5E1] px-3 py-1.5 text-xs font-semibold text-[#8A8580] disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
};
