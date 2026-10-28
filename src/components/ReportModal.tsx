import React, { useState } from 'react';
import { DashboardStats, CandidateVideo } from '../types';
import { groupVideosBySubmission } from '../utils/submissions';

interface ReportModalProps {
  stats: DashboardStats;
  videos: CandidateVideo[];
  onClose: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({ stats, videos, onClose }) => {
  const [copied, setCopied] = useState(false);
  const completedCount = videos.filter((v) => v.status === 'completed').length;
  const pendingCount = videos.filter((v) => v.status === 'pending' || v.status === 'in_review').length;
  const submissions = groupVideosBySubmission(videos);

  const downloadCSV = () => {
    const headers = ['Candidate Video ID', 'Candidate Name', 'Role Applied', 'Department', 'Status', 'Overall Score', 'Decision', 'Manager / Employer'];
    const rows = videos.map((v) => [
      v.id,
      `"${v.candidateName}"`,
      `"${v.roleApplied}"`,
      `"${v.department}"`,
      v.status,
      v.evaluation?.overallScore ? `${v.evaluation.overallScore}%` : 'N/A',
      v.evaluation?.decision || 'Pending',
      `"${v.assignedEvaluatorName || 'Unassigned'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `InterviewPro_Evaluation_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copySummary = () => {
    const summary = `InterviewPro Executive Evaluation Summary:
• Total Registered Users: ${stats.totalUsers.toLocaleString()} (${stats.totalUsersGrowth})
• Videos Uploaded: ${stats.videosUploaded.toLocaleString()} (${stats.videosGrowth})
• Pending Evaluations: ${stats.pendingAssignments}
• Completed Evaluations: ${stats.completedEvals} (${stats.completionRate})
• SLA Turnaround Compliance: ${stats.slaCompliance}% (Target: <24hrs)
• Active Managers / Employers: ${stats.activeEvaluatorsCount}/${stats.totalEvaluatorsCount}`;

    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden border border-[#E8E5E1] animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-[#E8E5E1] flex justify-between items-center bg-gradient-to-r from-red-50/50 via-white to-red-50/30">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-red-600 text-xl">assessment</span>
            <h3 className="font-bold text-sm text-[#101010]">HR Talent Analytics & SLA Report</h3>
          </div>
          <button onClick={onClose} className="text-[#8A8580] hover:text-red-700 cursor-pointer">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-[#E8E5E1] shadow-xs">
              <span className="text-[10px] font-bold text-red-900/60 uppercase tracking-wider">SLA Compliance</span>
              <div className="text-2xl font-bold text-[#101010] mt-1">{stats.slaCompliance}%</div>
              <span className="text-[10px] text-red-700 font-medium">92% within 24hr target</span>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[#E8E5E1] shadow-xs">
              <span className="text-[10px] font-bold text-red-900/60 uppercase tracking-wider">Average Turnaround</span>
              <div className="text-2xl font-bold text-[#101010] mt-1">{stats.avgCompletionTime}</div>
              <span className="text-[10px] text-red-900/60">Median completion window</span>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[#E8E5E1] shadow-xs">
              <span className="text-[10px] font-bold text-red-900/60 uppercase tracking-wider">Manager / Employer Coverage</span>
              <div className="text-2xl font-bold text-[#101010] mt-1">
                {stats.activeEvaluatorsCount}/{stats.totalEvaluatorsCount}
              </div>
              <span className="text-[10px] text-amber-700 font-medium">80.5% active this week</span>
            </div>
          </div>

          {/* Department Breakdown */}
          <div className="border border-[#E8E5E1] rounded-2xl p-4 bg-white shadow-xs">
            <h4 className="font-semibold text-xs text-[#101010] mb-3">Live Video Queue Breakdown</h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-red-50">
                <span className="text-red-900/70">Total Ingested Recordings in Database</span>
                <span className="font-bold text-[#101010]">{videos.length} videos</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-red-50">
                <span className="text-red-900/70">Grouped Submissions</span>
                <span className="font-bold text-[#101010]">{submissions.length} submissions</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-red-50">
                <span className="text-red-900/70">Pending Review by Assigned Managers / Employers</span>
                <span className="font-bold text-amber-600">{pendingCount} videos</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-red-900/70">Completed & Scored Candidate Evaluations</span>
                <span className="font-bold text-red-600">{completedCount} videos</span>
              </div>
            </div>
          </div>

          {/* Export Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E8E5E1]">
            <button
              onClick={copySummary}
              className="px-4 py-2 rounded-lg text-xs font-semibold border border-[#E8E5E1] text-[#101010] hover:bg-red-50 hover:text-red-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">{copied ? 'done' : 'content_copy'}</span>
              {copied ? 'Summary Copied!' : 'Copy Executive Briefing'}
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-[#8A8580] hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={downloadCSV}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs shadow-red-500/20 flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">download</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
