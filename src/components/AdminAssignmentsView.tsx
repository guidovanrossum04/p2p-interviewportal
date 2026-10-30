import React, { useEffect, useRef, useState } from 'react';
import { CandidateEvaluation, CandidateVideo } from '../types';
import { groupVideosBySubmission } from '../utils/submissions';
import { adminReviewRubric } from '../data/adminReviewRubric';

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
          const supportingDocuments = new Map(
            batchVideos.flatMap((video) => (video.documents || []).map((document) => [document.id, { document, video }] as const)),
          );
          const employerEvaluation = batchVideos.find((video) => video.evaluation)?.evaluation;
          const employerReviewed = batchVideos.every((video) => video.status === 'completed' && video.evaluation);
          const employerReviewGroups = new Map<string, CandidateEvaluation[]>();
          candidateReviewHistory
            .filter((evaluation) => evaluation.submissionId === submissionId)
            .forEach((evaluation) => {
              const reviewKey = `${evaluation.evaluatorId}:${evaluation.evaluatedAt || 'unknown-date'}`;
              employerReviewGroups.set(reviewKey, [...(employerReviewGroups.get(reviewKey) || []), evaluation]);
            });
          if (employerEvaluation && employerReviewGroups.size === 0) {
            employerReviewGroups.set(
              `${employerEvaluation.evaluatorId}:${employerEvaluation.evaluatedAt || 'current-review'}`,
              [employerEvaluation],
            );
          }
          const employerReviews = Array.from(employerReviewGroups.values());
          const isExpanded = expandedSubmissionId === submissionId;
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
                <div className="border-t border-[#E8E5E1] bg-[#F5F2EE] p-5">
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
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F5F2EE] px-2.5 py-1 text-[10px] font-bold text-[#101010]">
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
                      <p className="mt-0.5 text-[10px] text-[#8A8580]">Each question and its admin feedback are listed below. Employer scoring above applies to all videos together.</p>
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
                                ? 'bg-amber-100 text-amber-800'
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
                  {employerReviewed && employerEvaluation ? (
                    <div className="space-y-5">
                      {employerReviews.map((reviewItems) => {
                        const review = reviewItems[0];
                        const reviewRejected = review.decision === 'rejected' || review.decision === 'reject';
                        const reviewDecision = reviewRejected
                          ? 'Submission rejected'
                          : review.decision === 'selected' || review.decision === 'shortlist'
                            ? 'Selected'
                            : review.decision === 'hold' ? 'On hold' : 'Reviewed';
                        const reviewRubric = review.rubricWeights
                          || Object.keys(review.scores || {}).map((criterionId) => ({
                            id: criterionId,
                            name: criterionId.replace(/([A-Z])/g, ' $1').replace(/^./, (character) => character.toUpperCase()),
                            weight: 0,
                          }));
                        return (
                      <section key={`${review.evaluatorId}:${review.evaluatedAt}`} className="space-y-4 rounded-2xl border border-[#E8E5E1] bg-[#FAF9F7] p-4">
                      <div>
                        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-bold text-[#101010]">Manager / Employer scoring breakdown</h4>
                            <p className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-[#D6D3D1] bg-[#F5F2EE] px-2.5 py-1 text-[11px] font-bold text-[#101010]">
                              <span>Reviewed by {review.evaluatorName || 'Manager / Employer'}</span>
                              {review.evaluatedAt && (
                                <span className="font-medium text-[#5A5550]">· {new Date(review.evaluatedAt).toLocaleString()}</span>
                              )}
                            </p>
                          </div>
                          <span className="text-[10px] text-[#8A8580]">Ratings are shown out of 5</span>
                        </div>
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E8E5E1] bg-white p-4">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-[#8A8580]">Employer overall rating</p>
                            <p className="mt-1 text-2xl font-extrabold text-[#101010]">{review.overallScore}<span className="ml-1 text-sm font-semibold text-[#8A8580]">/100</span></p>
                          </div>
                          <div className="flex items-center gap-3">
                            <RatingStars score={Math.round(Math.max(0, Math.min(100, Number(review.overallScore) || 0)) / 20)} />
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                              reviewRejected ? 'bg-rose-100 text-rose-800' : reviewDecision === 'On hold'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>{reviewDecision}</span>
                          </div>
                        </div>
                        {review.notes && (
                          <p className="mb-3 whitespace-pre-wrap rounded-xl border border-[#E8E5E1] bg-white p-3 text-xs leading-relaxed text-[#5A5550]">
                            {review.notes}
                          </p>
                        )}
                        <div className="grid gap-3 sm:grid-cols-2">
                          {reviewRubric.map((criterion) => {
                            const score = Math.max(0, Math.min(5, Number(review.scores[criterion.id]) || 0));
                            return (
                              <div key={criterion.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#E8E5E1] bg-white p-3.5">
                                <span className="text-xs font-bold text-[#101010]">{criterion.name}</span>
                                <div className="flex shrink-0 items-center gap-2">
                                  <RatingStars score={score} />
                                  <span className="text-xs font-extrabold text-[#5A5550]">{score}/5</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {(review.keyStrengths?.length || review.areasToImprove?.length) && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {review.keyStrengths && review.keyStrengths.length > 0 && (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                              <h5 className="text-xs font-bold text-emerald-900">Key strengths</h5>
                              <ul className="mt-2 space-y-1.5 text-xs text-emerald-900/80">
                                {review.keyStrengths.map((strength, index) => <li key={`${index}-${strength}`}>• {strength}</li>)}
                              </ul>
                            </div>
                          )}
                          {review.areasToImprove && review.areasToImprove.length > 0 && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                              <h5 className="text-xs font-bold text-amber-900">Areas for improvement</h5>
                              <ul className="mt-2 space-y-1.5 text-xs text-amber-900/80">
                                {review.areasToImprove.map((area, index) => <li key={`${index}-${area}`}>• {area}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                      </section>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                      {assignedCount > 0 ? 'The Manager / Employer is still reviewing this submission.' : 'This submission is awaiting assignment.'}
                    </div>
                  )}

                  {employerReviewed && (
                    <section className="mb-5 overflow-hidden rounded-xl border border-[#E8E5E1] bg-white">
                      <div className="border-b border-[#E8E5E1] bg-red-50/50 px-4 py-3">
                        <h4 className="text-xs font-bold text-[#101010]">Videos reviewed by the Manager / Employer</h4>
                      </div>
                      <div className="divide-y divide-[#F1EEEA] px-4">
                        {batchVideos.map((video, index) => (
                          <div key={video.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-[#8A8580]">Video {index + 1}</p>
                              <p className="mt-0.5 text-xs leading-relaxed text-[#101010]">{video.questionPrompt || 'Question not specified'}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => onSelectCandidateVideo(video)}
                              className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-red-200 px-3 py-1.5 text-[10px] font-bold text-red-700 hover:bg-red-50 sm:self-center"
                            >
                              <span className="material-symbols-outlined text-sm">play_circle</span>
                              Watch video
                            </button>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {supportingDocuments.size > 0 && (
                    <section className="mb-5 overflow-hidden rounded-xl border border-[#E8E5E1] bg-white">
                      <div className="border-b border-[#E8E5E1] bg-red-50/50 px-4 py-3">
                        <h4 className="text-xs font-bold text-[#101010]">Admin-provided supporting documents</h4>
                      </div>
                      <div className="divide-y divide-[#F1EEEA] px-4">
                        {[...supportingDocuments.values()].map(({ document, video }) => (
                          <div key={document.id} className="flex items-center justify-between gap-3 py-3">
                            <span className="truncate text-xs font-medium text-[#101010]">{document.name}</span>
                            <span className="flex shrink-0 gap-3">
                              <a href={document.url} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-red-700 hover:underline">View</a>
                              <a href={document.downloadUrl || document.url} download={document.name} className="text-[11px] font-semibold text-red-700 hover:underline">Download</a>
                            </span>
                            <span className="sr-only">Attached to {video.candidateName}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

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
