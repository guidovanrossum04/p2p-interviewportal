import React, { useEffect, useState } from 'react';
import { CandidateVideo } from '../types';
import { GENERIC_VIDEO_THUMBNAIL } from '../data/[Unit]
Description=P2P Recruitment Portal
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=p2papp
Group=p2papp
WorkingDirectory=/opt/p2p-portal/app
EnvironmentFile=/etc/p2p-portal.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target';
import { groupVideosBySubmission } from '../utils/submissions';

interface AllVideosViewProps {
  videos: CandidateVideo[];
  onSelectCandidateVideo: (video: CandidateVideo) => void;
  onOpenUploadBatch: () => void;
  searchQuery: string;
}

export const AllVideosView: React.FC<AllVideosViewProps> = ({
  videos,
  onSelectCandidateVideo,
  onOpenUploadBatch,
  searchQuery,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'pending' | 'in_review' | 'completed' | 'awaiting_admin' | 'admin_confirmed'>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [submissionVideos, setSubmissionVideos] = useState<CandidateVideo[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const loadSubmissions = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(pageSize),
          status: selectedStatus,
          department: selectedDepartment,
          search: searchQuery.trim(),
        });
        const response = await fetch(`/api/submissions?${params.toString()}`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not load submissions.');
        setSubmissionVideos(Array.isArray(result.items) ? result.items : []);
        setTotal(Number(result.total) || 0);
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoadError(error instanceof Error ? error.message : 'Could not load submissions.');
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    void loadSubmissions();
    return () => controller.abort();
  }, [page, pageSize, selectedStatus, selectedDepartment, searchQuery]);

  useEffect(() => setPage(1), [pageSize, selectedStatus, selectedDepartment, searchQuery]);

  useEffect(() => {
    if (!videos.length || !submissionVideos.length) return;
    const currentById = new Map(videos.map((video) => [video.id, video]));
    setSubmissionVideos((current) => current.map((video) => currentById.get(video.id) || video));
  }, [videos]);

  const submissions = groupVideosBySubmission(submissionVideos);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const departments = Array.from(new Set(videos.map((v) => v.department).filter(Boolean)));

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div id="all-videos-container" className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-[#F5DADB] shadow-xs">
        <div>
          <h2 className="text-2xl font-bold text-[#1F1617]">Submissions</h2>
          <p className="text-xs text-red-900/60 mt-1">
            {total} candidate submissions
          </p>
        </div>

        {loadError && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
            {loadError}
          </div>
        )}

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex bg-red-50/60 p-1 rounded-xl border border-[#F5DADB]">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                viewMode === 'table' ? 'bg-white text-red-700 shadow-xs' : 'text-[#6B7280] hover:text-red-700'
              }`}
              title="Table View"
            >
              <span className="material-symbols-outlined text-[18px]">table_rows</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                viewMode === 'grid' ? 'bg-white text-red-700 shadow-xs' : 'text-[#6B7280] hover:text-red-700'
              }`}
              title="Grid Cards View"
            >
              <span className="material-symbols-outlined text-[18px]">grid_view</span>
            </button>
          </div>

          <button
            onClick={onOpenUploadBatch}
            className="bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm shadow-red-500/20 shrink-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
            Upload New Batch
          </button>
        </div>
      </div>

      {/* Filter Tabs & Dropdowns */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {(['all', 'awaiting_admin', 'admin_confirmed', 'pending', 'in_review', 'completed'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all capitalize cursor-pointer ${
                selectedStatus === st
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-white border border-[#F5DADB] text-[#6B7280] hover:text-red-700 hover:bg-rose-50/40'
              }`}
            >
              {st === 'all' ? 'All Submissions' : st === 'awaiting_admin' ? 'Awaiting Admin Review' : st === 'admin_confirmed' ? 'Confirmed' : st.replace('_', ' ')}
            </button>
          ))}
        </div>

        {departments.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-900/60 font-semibold">Department:</span>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="text-xs bg-white border border-[#F5DADB] rounded-xl px-3 py-1.5 text-[#1F1617] focus:ring-1 focus:ring-red-500 focus:outline-none cursor-pointer"
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* View Content */}
      {isLoading ? (
        <div className="rounded-2xl border border-[#F5DADB] bg-white p-10 text-center text-sm text-[#6B7280]">Loading submissions...</div>
      ) : viewMode === 'table' ? (
        <div className="bg-white border border-[#F5DADB] rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#F5DADB] bg-red-50/40 text-[11px] font-bold text-red-900/60 uppercase tracking-wider">
                  <th className="px-6 py-3.5">Candidate</th>
                  <th className="px-6 py-3.5">Role / Dept</th>
                  <th className="px-6 py-3.5">Duration</th>
                  <th className="px-6 py-3.5">Assigned Manager / Employer</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5DADB] text-xs">
                {submissions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-[#9CA3AF]">
                      No candidate videos match your selected criteria.
                    </td>
                  </tr>
                ) : (
                  submissions.map(({ id: submissionId, videos: submissionVideos }) => {
                    const video = submissionVideos[0];
                    const completedCount = submissionVideos.filter((item) => item.status === 'completed').length;
                    const reviewedStatus = completedCount === submissionVideos.length
                      ? 'Completed'
                      : submissionVideos.some((item) => item.status === 'in_review') ? 'In Review' : 'Pending';
                    return (
                    <tr
                      key={submissionId}
                      onClick={() => onSelectCandidateVideo(video)}
                      className="hover:bg-rose-50/30 transition-colors group cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-600 to-rose-700 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                            {getInitials(video.candidateName)}
                          </div>
                          <div>
                            <span className="font-bold text-[#1F1617] block group-hover:text-red-700 transition-colors">
                              {video.candidateName}
                            </span>
                            <span className="text-[11px] text-red-900/60">{video.candidateEmail}</span>
                            <span className="block text-[10px] font-mono text-[#6B7280] mt-1">Submission {submissionId}</span>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className="font-medium text-[#1F1617] block">{video.roleApplied}</span>
                        <span className="text-[11px] text-[#6B7280]">{video.department}</span>
                      </td>

                      <td className="px-6 py-4 text-xs font-mono text-red-900/70">
                        {submissionVideos.length} video{submissionVideos.length === 1 ? '' : 's'}
                      </td>

                      <td className="px-6 py-4 text-xs text-[#1F1617]">
                        {video.assignedEvaluatorName ? (
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-red-600">person</span>
                            <span className="font-medium">{video.assignedEvaluatorName}</span>
                          </div>
                        ) : (
                          <span className="text-red-900/40 italic">Unassigned</span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-col items-start gap-1">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${reviewedStatus === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : reviewedStatus === 'In Review' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                            {reviewedStatus} · {completedCount}/{submissionVideos.length} reviewed
                          </span>
                          <span className={`text-[9px] font-semibold ${submissionVideos.every((item) => item.adminConfirmed) ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {submissionVideos.filter((item) => item.adminConfirmed).length}/{submissionVideos.length} admin approved
                          </span>
                          <span className="text-[9px] text-[#6B7280]">
                            {submissionVideos.reduce((documentCount, item) => documentCount + (item.documents?.length || 0), 0)} documents
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCandidateVideo(video);
                          }}
                          className="text-red-600 hover:text-red-800 font-bold flex items-center gap-1 ml-auto cursor-pointer"
                        >
                          <span>Open Submission</span>
                          <span className="material-symbols-outlined text-[16px]">play_circle</span>
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
      ) : (
        /* Grid Mode */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {submissions.map(({ id: submissionId, videos: submissionVideos }) => {
            const video = submissionVideos[0];
            return (
            <div
              key={submissionId}
              onClick={() => onSelectCandidateVideo(video)}
              className="bg-white border border-[#F5DADB] hover:border-red-400 rounded-2xl overflow-hidden shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div className="relative aspect-video bg-stone-900">
                <img
                  src={video.thumbnailUrl || GENERIC_VIDEO_THUMBNAIL}
                  alt={video.candidateName}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90 group-hover:opacity-100"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30"></div>

                <div className="absolute top-3 left-3">
                  {video.status === 'pending' && (
                    <span className="px-2.5 py-0.5 rounded-full bg-red-600/90 text-white text-[10px] font-bold uppercase tracking-wider shadow-xs">
                      Pending
                    </span>
                  )}
                  {video.status === 'in_review' && (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/90 text-white text-[10px] font-bold uppercase tracking-wider shadow-xs">
                      In Review
                    </span>
                  )}
                  {video.status === 'completed' && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-600/90 text-white text-[10px] font-bold uppercase tracking-wider shadow-xs">
                      Score: {video.evaluation?.overallScore || 90}%
                    </span>
                  )}
                </div>

                <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded bg-black/70 text-white text-[10px] font-mono">
                  {video.videoDuration || '05:00'}
                </span>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-sm text-[#1F1617] group-hover:text-red-700 transition-colors">
                    {video.candidateName}
                  </h4>
                  <p className="text-xs text-[#6B7280]">{video.roleApplied}</p>
                  <p className="mt-1 text-[10px] font-mono text-[#6B7280]">Submission {submissionId} · {submissionVideos.length} videos</p>
                </div>

                <div className="mt-4 pt-3 border-t border-red-100 flex items-center justify-between text-xs text-[#6B7280]">
                  <span>Assigned: {video.assignedEvaluatorName?.split(' ')[0] || 'Unassigned'}</span>
                  <span className="text-red-600 font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    Evaluate <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </span>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-[#F5DADB] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs text-[#6B7280]">
          <span>Submissions per page</span>
          <select
            value={pageSize}
            onChange={(event) => setPageSize(Number(event.target.value))}
            className="rounded-lg border border-[#F5DADB] bg-white px-2 py-1.5 text-xs text-[#1F1617]"
            aria-label="Submissions per page"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
          <span>· Showing {total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)} of {total}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1 || isLoading}
            className="rounded-lg border border-[#F5DADB] px-3 py-1.5 text-xs font-semibold text-[#6B7280] hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <span className="min-w-16 text-center text-xs text-[#6B7280]">Page {page} of {pageCount}</span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
            disabled={page >= pageCount || isLoading}
            className="rounded-lg border border-[#F5DADB] px-3 py-1.5 text-xs font-semibold text-[#6B7280] hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
