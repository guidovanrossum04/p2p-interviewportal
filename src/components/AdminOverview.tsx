import React from 'react';
import { DashboardStats, CandidateVideo, InviteLink, InviteType } from '../types';
import { groupVideosBySubmission } from '../utils/submissions';

interface AdminOverviewProps {
  stats: DashboardStats;
  videos: CandidateVideo[];
  inviteLinks?: InviteLink[];
  onOpenCreateLink: (type?: InviteType) => void;
  onOpenLinksView: () => void;
  onGenerateReport: () => void;
  onViewAllVideos: () => void;
  onSelectCandidateVideo: (video: CandidateVideo) => void;
  isLoading?: boolean;
  loadError?: string | null;
  onRefresh?: () => void;
}

export const AdminOverview: React.FC<AdminOverviewProps> = ({
  stats,
  videos,
  inviteLinks = [],
  onOpenCreateLink,
  onOpenLinksView,
  onGenerateReport,
  onViewAllVideos,
  onSelectCandidateVideo,
  isLoading = false,
  loadError,
  onRefresh,
}) => {
  const pendingCount = videos.filter((video) => video.status !== 'completed').length;
  const completedCount = videos.filter((video) => video.status === 'completed').length;
  const maxEvaluationCount = Math.max(pendingCount, completedCount, 1);
  const recentUploads = groupVideosBySubmission(videos)
    .sort((first, second) => Date.parse(second.videos[0].submittedAt) - Date.parse(first.videos[0].submittedAt))
    .slice(0, 5);
  const recentEvaluationResults = groupVideosBySubmission(videos.filter((video) => video.evaluation))
    .map((submission) => ({
      submission,
      video: [...submission.videos].sort((first, second) =>
        Date.parse(second.evaluation?.evaluatedAt || '') - Date.parse(first.evaluation?.evaluatedAt || ''),
      )[0],
    }))
    .sort((first, second) => Date.parse(second.video.evaluation?.evaluatedAt || '') - Date.parse(first.video.evaluation?.evaluatedAt || ''))
    .slice(0, 5);

  const formatDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  };

  return (
    <div id="admin-dashboard-view" className="space-y-6">
      {(isLoading || loadError) && (
        <div className="flex flex-col gap-3 rounded-xl border border-[#E8E5E1] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p role={loadError ? 'alert' : 'status'} className={`text-xs ${loadError ? 'text-red-700' : 'text-[#8A8580]'}`}>
            {loadError || 'Refreshing dashboard data...'}
          </p>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="rounded-lg border border-[#E8E5E1] px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
            >
              {isLoading ? 'Refreshing...' : 'Refresh dashboard'}
            </button>
          )}
        </div>
      )}
      {/* Admin Link Generation & Access Hub Banner */}
      <div className="bg-gradient-to-r from-red-600 via-rose-700 to-red-700 rounded-2xl p-6 text-white shadow-md shadow-red-500/20 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 text-[11px] font-bold tracking-wide uppercase text-white backdrop-blur-xs">
              <span className="material-symbols-outlined text-xs">vpn_key</span>
              <span>Admin Anbin • Access Governance</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">Generate & Share Access Links</h2>
            <p className="text-xs text-red-100 leading-relaxed">
              Generate direct invitation links to share with <strong>Users (Candidates) to upload videos</strong> and{' '}
              <strong>Managers / Employers to grade submissions</strong>. 
              <span className="font-bold text-white bg-red-800/60 px-1.5 py-0.5 rounded ml-1">
                Zero Login Barrier: No separate login or password required for recipients!
              </span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onOpenLinksView}
              className="px-4 py-2 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-bold transition-all border border-white/20 cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <span className="material-symbols-outlined text-base">list_alt</span>
              <span>View All Shared Links ({inviteLinks.length})</span>
            </button>
            <button
              type="button"
              onClick={onGenerateReport}
              className="px-4 py-2 bg-white text-red-700 hover:bg-red-50 rounded-xl text-xs font-bold transition-all border border-white/40 cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <span className="material-symbols-outlined text-base">assessment</span>
              <span>Generate Report</span>
            </button>
          </div>
        </div>

        {/* 2 Primary Link Generation CTA Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-white/20">
          <div className="bg-white/10 backdrop-blur-xs p-4 rounded-xl border border-white/15 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 font-bold text-sm text-white">
                <span className="material-symbols-outlined text-base text-rose-200">video_camera_front</span>
                <span>User (Candidate) Video Upload Link</span>
              </div>
              <p className="text-[11px] text-red-100/90">
                Candidate opens link & directly records/uploads self-intro video. No login needed.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenCreateLink('candidate')}
              className="px-4 py-2 bg-white text-red-700 hover:bg-red-50 active:scale-[0.99] rounded-xl text-xs font-extrabold transition-all shadow-sm flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm text-red-600">add_link</span>
              <span>+ User Link</span>
            </button>
          </div>

          <div className="bg-white/10 backdrop-blur-xs p-4 rounded-xl border border-white/15 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 font-bold text-sm text-white">
                <span className="material-symbols-outlined text-base text-rose-200">rate_review</span>
                <span>Manager / Employer Assessment Link</span>
              </div>
              <p className="text-[11px] text-red-100/90">
                Manager / Employer opens the link to review the assigned candidate video.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenCreateLink('evaluator')}
              className="px-4 py-2 bg-white text-red-700 hover:bg-red-50 active:scale-[0.99] rounded-xl text-xs font-extrabold transition-all shadow-sm flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm text-red-600">add_link</span>
              <span>+ Manager / Employer Link</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Bento Stat Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Users Card */}
        <div
          id="stat-card-total-users"
          className="bg-white border border-[#E8E5E1] rounded-2xl p-6 flex flex-col justify-between shadow-xs hover:border-red-300 transition-colors"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs font-bold text-red-900/60 uppercase tracking-wider">Total Users</p>
              <h3 className="text-3xl font-extrabold text-[#101010] mt-2 tracking-tight">
                {stats.totalUsers.toLocaleString()}
              </h3>
            </div>
            <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">group</span>
            </div>
          </div>
          <div className="flex items-center text-xs font-semibold text-emerald-600">
            <span className="material-symbols-outlined text-sm mr-1">trending_up</span>
            <span>{stats.totalUsersGrowth} vs last month</span>
          </div>
        </div>

        {/* Videos Uploaded Card */}
        <div
          id="stat-card-videos-uploaded"
          className="bg-white border border-[#E8E5E1] rounded-2xl p-6 flex flex-col justify-between shadow-xs hover:border-red-300 transition-colors"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs font-bold text-red-900/60 uppercase tracking-wider">Videos Uploaded</p>
              <h3 className="text-3xl font-extrabold text-[#101010] mt-2 tracking-tight">
                {stats.videosUploaded.toLocaleString()}
              </h3>
            </div>
            <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">videocam</span>
            </div>
          </div>
          <div className="flex items-center text-xs font-semibold text-emerald-600">
            <span className="material-symbols-outlined text-sm mr-1">trending_up</span>
            <span>{stats.videosGrowth} vs last month</span>
          </div>
        </div>

        {/* Pending Assignments Card */}
        <div
          id="stat-card-pending-assignments"
          className="bg-white border border-[#E8E5E1] rounded-2xl p-6 flex flex-col justify-between shadow-xs hover:border-red-300 transition-colors"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs font-bold text-red-900/60 uppercase tracking-wider">Pending Queue</p>
              <h3 className="text-3xl font-extrabold text-red-600 mt-2 tracking-tight">
                {stats.pendingAssignments.toLocaleString()}
              </h3>
            </div>
            <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">pending_actions</span>
            </div>
          </div>
          <div className="flex items-center text-xs font-semibold text-amber-600">
            <span className="material-symbols-outlined text-sm mr-1">hourglass_top</span>
            <span>Awaiting evaluator review</span>
          </div>
        </div>

        {/* Completed Evaluations Card */}
        <div
          id="stat-card-completed-evals"
          className="bg-white border border-[#E8E5E1] rounded-2xl p-6 flex flex-col justify-between shadow-xs hover:border-red-300 transition-colors"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs font-bold text-red-900/60 uppercase tracking-wider">Completed Evals</p>
              <h3 className="text-3xl font-extrabold text-[#101010] mt-2 tracking-tight">
                {stats.completedEvals.toLocaleString()}
              </h3>
            </div>
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">assignment_turned_in</span>
            </div>
          </div>
          <div className="flex items-center text-xs font-semibold text-emerald-600">
            <span className="material-symbols-outlined text-sm mr-1">check_circle</span>
            <span>{stats.completionRate} completion rate</span>
          </div>
        </div>
      </div>

      {/* Dashboard Activity & Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Evaluations and Uploads */}
        <div className="lg:col-span-12 flex flex-col gap-6">
          <section className="bg-white border border-[#E8E5E1] rounded-2xl p-6 shadow-xs">
            <div className="mb-5">
              <h3 className="text-base font-bold text-[#101010]">Submission Status</h3>
              <p className="text-xs text-red-900/60 mt-0.5">Pending versus completed candidate videos</p>
            </div>

            <div className="space-y-4" role="img" aria-label={`${pendingCount} pending videos and ${completedCount} completed videos`}>
              {[
                { label: 'Pending videos', count: pendingCount, color: 'bg-red-500' },
                { label: 'Completed videos', count: completedCount, color: 'bg-emerald-500' },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="font-semibold text-[#101010]">{item.label}</span>
                    <span className="font-mono font-bold text-[#101010]">{item.count}</span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-[#F3F4F6] overflow-hidden">
                    <div
                      className={`${item.color} h-full rounded-full transition-all duration-500`}
                      style={{ width: `${(item.count / maxEvaluationCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <section className="bg-white border border-[#E8E5E1] rounded-2xl shadow-xs overflow-hidden">
              <div className="p-5 border-b border-[#E8E5E1] flex justify-between items-center gap-3">
                <div>
                  <h3 className="text-base font-bold text-[#101010]">Recent Uploads</h3>
                  <p className="text-xs text-red-900/60 mt-0.5">Latest candidate video submissions</p>
                </div>
                <button
                  type="button"
                  onClick={onViewAllVideos}
                  className="text-xs font-bold text-red-700 hover:text-red-800 cursor-pointer shrink-0"
                >
                  View all
                </button>
              </div>
              {recentUploads.length === 0 ? (
                <p className="px-5 py-8 text-center text-xs text-[#8A8580]">No video uploads yet.</p>
              ) : (
                <div className="divide-y divide-red-50">
                  {recentUploads.map(({ id: submissionId, videos: submissionVideos }) => {
                    const video = submissionVideos[0];
                    const completedCount = submissionVideos.filter((item) => item.status === 'completed').length;
                    return (
                    <button
                      type="button"
                      key={submissionId}
                      onClick={() => onSelectCandidateVideo(video)}
                      className="w-full text-left px-5 py-3.5 hover:bg-rose-50/40 transition-colors cursor-pointer"
                    >
                      <span className="flex justify-between items-start gap-3">
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-bold text-[#101010]">{video.candidateName}</span>
                          <span className="block truncate text-[11px] text-[#8A8580] mt-0.5">{video.roleApplied} · {submissionVideos.length} videos · {completedCount} reviewed</span>
                        </span>
                        <span className={`text-[10px] font-bold whitespace-nowrap ${video.status === 'completed' ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {video.status === 'completed' ? 'Completed' : video.status === 'in_review' ? 'In review' : 'Pending'}
                        </span>
                      </span>
                      <span className="block text-[10px] text-[#8A8580] mt-1.5">{formatDate(video.submittedAt)}</span>
                    </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="bg-white border border-[#E8E5E1] rounded-2xl shadow-xs overflow-hidden">
              <div className="p-5 border-b border-[#E8E5E1]">
                <h3 className="text-base font-bold text-[#101010]">Recent Evaluation Results</h3>
                <p className="text-xs text-red-900/60 mt-0.5">Latest submitted evaluator decisions</p>
              </div>
              {recentEvaluationResults.length === 0 ? (
                <p className="px-5 py-8 text-center text-xs text-[#8A8580]">No evaluation results yet.</p>
              ) : (
                <div className="divide-y divide-red-50">
                  {recentEvaluationResults.map(({ submission, video }) => {
                    const evaluation = video.evaluation!;
                    return (
                    <button
                      type="button"
                      key={submission.id}
                      onClick={() => onSelectCandidateVideo(video)}
                      className="w-full text-left px-5 py-3.5 hover:bg-rose-50/40 transition-colors cursor-pointer"
                    >
                      <span className="flex justify-between items-start gap-3">
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-bold text-[#101010]">{video.candidateName}</span>
                          <span className="block truncate text-[11px] text-[#8A8580] mt-0.5">{video.roleApplied} · {submission.videos.length} videos · {evaluation.evaluatorName}</span>
                        </span>
                        <span className="text-xs font-bold text-emerald-700 whitespace-nowrap">{evaluation.overallScore}%</span>
                      </span>
                      <span className="flex justify-between text-[10px] text-[#8A8580] mt-1.5">
                        <span className="capitalize">{evaluation.decision}</span>
                        <span>{formatDate(evaluation.evaluatedAt)}</span>
                      </span>
                    </button>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>

      </div>

    </div>
  );
};
