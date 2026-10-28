import React, { useState } from 'react';
import { CandidateVideo, EvaluatorStats } from '../types';
import { groupVideosBySubmission } from '../utils/submissions';

interface EvaluatorDashboardProps {
  stats: EvaluatorStats;
  videos: CandidateVideo[];
  onSelectCandidateVideo: (video: CandidateVideo) => void;
  onSyncAssignments: () => Promise<void>;
}

export const EvaluatorDashboard: React.FC<EvaluatorDashboardProps> = ({
  stats,
  videos,
  onSelectCandidateVideo,
  onSyncAssignments,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_review' | 'completed'>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await onSyncAssignments();
    } finally {
      setTimeout(() => setIsSyncing(false), 600);
    }
  };

  const submissions = groupVideosBySubmission(videos).filter(({ videos: submissionVideos }) =>
    statusFilter === 'all' || submissionVideos.some((video) => video.status === statusFilter),
  );

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div id="evaluator-dashboard-view" className="max-w-7xl mx-auto space-y-8">
      {/* Header & Sync button */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-white p-6 rounded-2xl border border-[#E8E5E1] shadow-xs">
        <div>
          <h2 className="text-2xl font-bold text-[#101010] tracking-tight">Manager / Employer Review Queue</h2>
          <p className="text-xs text-red-900/60 mt-1">
            Welcome back, Sarah. You have <strong className="text-red-600 font-bold">{stats.pendingReview} candidate interviews</strong> pending review.
          </p>
        </div>
        <button
          id="sync-assignments-btn"
          onClick={handleSync}
          disabled={isSyncing}
          className="bg-red-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-red-700 active:scale-95 transition-all flex items-center gap-2 shadow-sm shadow-red-500/20 disabled:opacity-75 cursor-pointer"
        >
          <span
            className={`material-symbols-outlined text-[18px] ${isSyncing ? 'animate-spin' : ''}`}
            data-icon="refresh"
          >
            refresh
          </span>
          {isSyncing ? 'Syncing...' : 'Sync Assignments'}
        </button>
      </div>

      {/* Bento Grid 3 Stat Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Assigned */}
        <div
          id="stat-card-total-assigned"
          className="bg-white border border-[#E8E5E1] rounded-2xl p-6 flex flex-col justify-between hover:border-red-400 transition-all duration-200 group shadow-xs cursor-pointer"
          onClick={() => setStatusFilter('all')}
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-red-900/60 uppercase tracking-wider">Total Assigned</span>
            <span className="text-xs font-semibold text-red-700 bg-red-50 px-2.5 py-0.5 rounded-md">Active Cycle</span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-[#101010]">{stats.totalAssigned}</div>
            <div className="text-xs text-red-900/60 mt-1">Assigned videos across submissions</div>
          </div>
        </div>

        {/* Pending Review */}
        <div
          id="stat-card-pending-review"
          className="bg-white border border-[#E8E5E1] rounded-2xl p-6 flex flex-col justify-between hover:border-red-400 transition-all duration-200 group shadow-xs cursor-pointer"
          onClick={() => setStatusFilter('pending')}
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-red-900/60 uppercase tracking-wider">Pending Review</span>
            <span className="text-xs font-bold text-red-600 bg-red-50 px-2.5 py-0.5 rounded-md">Needs Action</span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-red-600">{stats.pendingReview}</div>
            <div className="text-xs text-red-900/60 mt-1">Awaiting submission review</div>
          </div>
        </div>

        {/* Completed */}
        <div
          id="stat-card-evaluations-completed"
          className="bg-white border border-[#E8E5E1] rounded-2xl p-6 flex flex-col justify-between hover:border-red-400 transition-all duration-200 group shadow-xs cursor-pointer"
          onClick={() => setStatusFilter('completed')}
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-red-900/60 uppercase tracking-wider">Evaluated</span>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-md">Completed</span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-emerald-600">{stats.completed}</div>
            <div className="text-xs text-red-900/60 mt-1">Scores submitted</div>
          </div>
        </div>
      </div>

      {/* Assigned Videos Queue Table */}
      <div id="assigned-videos-queue-card" className="bg-white border border-[#E8E5E1] rounded-2xl overflow-hidden shadow-xs">
        <div className="p-6 border-b border-[#E8E5E1] flex justify-between items-center bg-white">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-[#101010]">Live Evaluation Queue</h3>
            {statusFilter !== 'all' && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700 uppercase">
                Filter: {statusFilter.replace('_', ' ')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 relative">
            <button
              id="filter-queue-btn"
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="p-1.5 rounded-xl text-red-700 hover:text-red-800 hover:bg-red-50 transition-colors cursor-pointer border border-red-200/60"
              title="Filter status"
            >
              <span className="material-symbols-outlined text-xl">filter_list</span>
            </button>

            {showFilterDropdown && (
              <div className="absolute right-0 top-10 w-44 bg-white border border-[#E8E5E1] rounded-xl shadow-lg z-30 py-1 text-xs">
                <button
                  onClick={() => {
                    setStatusFilter('all');
                    setShowFilterDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 hover:bg-red-50 cursor-pointer ${statusFilter === 'all' ? 'font-bold text-red-700 bg-red-50' : 'text-[#8A8580]'}`}
                >
                  All Statuses
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('pending');
                    setShowFilterDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 hover:bg-red-50 cursor-pointer ${statusFilter === 'pending' ? 'font-bold text-red-700 bg-red-50' : 'text-[#8A8580]'}`}
                >
                  Pending Only
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('in_review');
                    setShowFilterDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 hover:bg-red-50 cursor-pointer ${statusFilter === 'in_review' ? 'font-bold text-red-700 bg-red-50' : 'text-[#8A8580]'}`}
                >
                  In Review Only
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('completed');
                    setShowFilterDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 hover:bg-red-50 cursor-pointer ${statusFilter === 'completed' ? 'font-bold text-red-700 bg-red-50' : 'text-[#8A8580]'}`}
                >
                  Completed Only
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E8E5E1] bg-red-50/40 text-[11px] font-bold text-red-900/60 uppercase tracking-wider">
                <th className="px-6 py-3.5 font-bold">Candidate</th>
                <th className="px-6 py-3.5 font-bold">Role Applied</th>
                <th className="px-6 py-3.5 font-bold">Submitted</th>
                <th className="px-6 py-3.5 font-bold">Status</th>
                <th className="px-6 py-3.5 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E5E1] text-xs">
              {submissions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-[#8A8580]">
                    No videos found matching the current filter criteria.
                  </td>
                </tr>
              ) : (
                submissions.map(({ id: submissionId, videos: submissionVideos }) => {
                  const video = submissionVideos[0];
                  const isPending = submissionVideos.some((item) => item.status === 'pending');
                  const isInReview = submissionVideos.some((item) => item.status === 'in_review');
                  const isCompleted = submissionVideos.every((item) => item.status === 'completed');
                  const reviewVideo = submissionVideos.find((item) => item.status !== 'completed') || video;

                  return (
                    <tr
                      key={submissionId}
                      onClick={() => onSelectCandidateVideo(reviewVideo)}
                      className="hover:bg-rose-50/30 transition-colors group cursor-pointer"
                    >
                      {/* Candidate with avatar initials */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-600 to-rose-700 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                            {getInitials(video.candidateName)}
                          </div>
                          <div>
                            <span className="font-bold text-[#101010] block group-hover:text-red-700 transition-colors">
                              {video.candidateName}
                            </span>
                            <span className="text-[11px] text-red-900/60">{video.candidateEmail}</span>
                          </div>
                        </div>
                      </td>

                      {/* Role Applied */}
                      <td className="px-6 py-4 text-[#101010] font-medium">
                        {video.roleApplied}
                        <span className="block text-[10px] text-[#8A8580]">{submissionVideos.length} video{submissionVideos.length === 1 ? '' : 's'}</span>
                      </td>

                      {/* Submitted */}
                      <td className="px-6 py-4 text-[#8A8580]">{video.submittedTimeAgo}</td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        {isPending && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-200 text-[10px] font-bold uppercase tracking-wider">
                            Pending
                          </span>
                        )}
                        {isInReview && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold uppercase tracking-wider">
                            In Review
                          </span>
                        )}
                        {isCompleted && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider">
                            Completed
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCandidateVideo(reviewVideo);
                          }}
                          className="text-red-600 hover:text-red-800 font-bold flex items-center gap-1 ml-auto cursor-pointer"
                        >
                          <span>{isCompleted ? 'View Score' : isInReview ? 'Continue' : 'Start Review'}</span>
                          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
