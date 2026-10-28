import React from 'react';
import { CandidateVideo } from '../types';
import { GENERIC_AVATAR } from '../data/placeholders';

interface CandidateEvaluationDetailsModalProps {
  video: CandidateVideo;
  onClose: () => void;
  onWatchVideo: (video: CandidateVideo) => void;
}

export const CandidateEvaluationDetailsModal: React.FC<CandidateEvaluationDetailsModalProps> = ({
  video,
  onClose,
  onWatchVideo,
}) => {
  const evalData = video.evaluation;
  const overallScore = evalData?.overallScore || 85;
  const isEvaluated = video.status === 'completed' || !!evalData;
  const defaultRubric = [
    { id: 'communication', name: 'Communication & Articulation', weight: 25 },
    { id: 'technical', name: 'Technical Depth & Architecture', weight: 35 },
    { id: 'problemSolving', name: 'Problem Solving & Reasoning', weight: 25 },
    { id: 'cultureFit', name: 'Culture Fit & Collaboration', weight: 15 },
  ];
  const rubric = evalData?.rubricWeights || defaultRubric;

  const getDecisionBadge = (decision?: string) => {
    switch (decision) {
      case 'shortlist':
        return (
          <span className="px-3 py-1 bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0] rounded-full text-xs font-bold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">check_circle</span>
            Shortlisted for Onsite Interview
          </span>
        );
      case 'hold':
        return (
          <span className="px-3 py-1 bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A] rounded-full text-xs font-bold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">pause_circle</span>
            On Hold / Talent Pool
          </span>
        );
      case 'reject':
        return (
          <span className="px-3 py-1 bg-[#FEF2F2] text-[#D81F27] border border-[#FECACA] rounded-full text-xs font-bold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">cancel</span>
            Archived / Not Selected
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] rounded-full text-xs font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#2563EB] animate-pulse"></span>
            Evaluation in Progress
          </span>
        );
    }
  };

  return (
    <div
      id="candidate-evaluation-details-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-[#E8E5E1] shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-[#101010]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-[#E8E5E1] flex justify-between items-start shrink-0 bg-gradient-to-r from-red-50/40 via-white to-red-50/20">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-800 border border-red-200">
                {video.questionPrompt ? 'Pharmacist Interview Response' : video.submissionType === 'self_introduction' ? 'Self-Introduction Video' : 'Technical Assessment'}
              </span>
              <span className="text-xs text-red-900/60">Submitted {video.submittedTimeAgo}</span>
            </div>
            <h3 className="text-lg font-bold text-[#101010]">{video.roleApplied} • Evaluation Report</h3>
            <p className="text-xs text-red-900/60 mt-0.5">
              Candidate: <span className="font-semibold text-[#101010]">{video.candidateName}</span> ({video.department})
            </p>
            {video.questionPrompt && <p className="mt-2 max-w-2xl text-xs font-medium text-[#101010]">{video.questionPrompt}</p>}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#8A8580] hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Top Decision & Overall Score Banner */}
          <div className="bg-[#F5F2EE] rounded-2xl border border-[#E8E5E1] p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 text-white flex flex-col items-center justify-center font-bold shrink-0 shadow-md shadow-red-500/20">
                <span className="text-xl leading-none">{overallScore}</span>
                <span className="text-[10px] text-red-100 font-normal">/ 100</span>
              </div>

              <div>
                <div className="mb-1.5">{getDecisionBadge(evalData?.decision)}</div>
                <p className="text-xs text-red-900/70">
                  Consensus rating calculated across {rubric.length} rubric criteria.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onWatchVideo(video);
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-all flex items-center gap-1.5 shadow-xs shadow-red-500/20 shrink-0 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">play_circle</span>
              <span>Watch Submission</span>
            </button>
          </div>

          {/* Core Competencies Rubric Breakdown */}
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#101010] mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-red-600">analytics</span>
              Competency Breakdown & Scorecards
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {rubric.map((criterion, idx) => (
                <div
                  key={criterion.id}
                  className="bg-white rounded-xl border border-[#E8E5E1] p-4 flex flex-col justify-between"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-xs text-[#101010]">{criterion.name}</span>
                    <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-100 font-mono font-bold text-xs">
                      {evalData?.scores[criterion.id] || 4} / 5
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8A8580] mb-2">{criterion.weight}% of total score</p>
                  {/* Progress Bar */}
                  <div className="w-full bg-red-50 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-red-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${((evalData?.scores[criterion.id] || 4) / 5) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Evaluator Notes & Reviewer Card */}
          <div className="bg-white rounded-2xl border border-[#E8E5E1] p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-[#E8E5E1] pb-3">
              <div className="flex items-center gap-3">
                <img
                  src={
                    evalData?.evaluatorAvatar ||
                    video.assignedEvaluatorAvatar ||
                    GENERIC_AVATAR
                  }
                  alt={evalData?.evaluatorName || 'Evaluator'}
                  className="w-10 h-10 rounded-full object-cover border border-[#E8E5E1]"
                />
                <div>
                  <h5 className="font-bold text-xs text-[#101010]">
                    {evalData?.evaluatorName || video.assignedEvaluatorName || 'Senior Talent Evaluator'}
                  </h5>
                  <p className="text-[11px] text-red-900/60">
                    {evalData?.evaluatorTitle || 'Technical Interviewer'} • Evaluated on{' '}
                    {evalData?.evaluatedAt
                      ? new Date(evalData.evaluatedAt).toLocaleDateString()
                      : 'Recent Review'}
                  </p>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded bg-red-50 text-red-800 border border-red-100 font-semibold text-[11px]">
                Verified HR Review
              </span>
            </div>

            <div>
              <h5 className="font-bold text-xs text-[#101010] mb-1">Manager / Employer Written Feedback:</h5>
              <p className="text-xs text-[#5A5550] leading-relaxed bg-[#F5F2EE] p-3.5 rounded-xl border border-[#E8E5E1] italic">
                "{evalData?.notes || 'Candidate presented strong conceptual understanding and communicated answers with clarity.'}"
              </p>
            </div>
          </div>

          {/* AI Co-Pilot Summary & Strengths */}
          <div className="bg-white rounded-2xl border border-[#E8E5E1] p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-red-600">auto_awesome</span>
              <h5 className="font-bold text-xs uppercase tracking-wider text-[#101010]">
                AI Co-Pilot Assessment & Synthesis
              </h5>
            </div>

            <p className="text-xs text-[#5A5550] leading-relaxed">
              {evalData?.aiSummary ||
                'The candidate demonstrated strong domain expertise, structured reasoning, and clear verbal communication during technical inquiry responses.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="bg-[#F5F2EE] border border-[#E8E5E1] rounded-xl p-3.5">
                <span className="font-bold text-xs text-red-800 flex items-center gap-1 mb-2">
                  <span className="material-symbols-outlined text-sm text-red-600">thumb_up</span>
                  Key Identified Strengths
                </span>
                <ul className="space-y-1.5 text-[11px] text-[#5A5550]">
                  {(evalData?.keyStrengths && evalData.keyStrengths.length > 0
                    ? evalData.keyStrengths
                    : [
                        'Structured and articulate communication',
                        'In-depth problem decomposition',
                        'High alignment with engineering best practices',
                      ]
                  ).map((str, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-red-600 font-bold">•</span>
                      <span>{str}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-3.5">
                <span className="font-bold text-xs text-amber-800 flex items-center gap-1 mb-2">
                  <span className="material-symbols-outlined text-sm">trending_up</span>
                  Areas for Growth & Next Steps
                </span>
                <ul className="space-y-1.5 text-[11px] text-amber-900/80">
                  {(evalData?.areasToImprove && evalData.areasToImprove.length > 0
                    ? evalData.areasToImprove
                    : [
                        'Provide more quantitative metrics on performance impact',
                        'Continue to demonstrate cross-functional leadership in team settings',
                      ]
                  ).map((area, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-amber-600 font-bold">•</span>
                      <span>{area}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Evaluation History Log */}
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#101010] mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-red-600">history</span>
              Stage History & Audit Timeline
            </h4>

            <div className="space-y-2">
              <div className="p-3 bg-white rounded-xl border border-[#E8E5E1] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-red-600"></span>
                  <div>
                    <span className="font-bold text-xs text-[#101010]">Video Uploaded & Transcribed</span>
                    <span className="text-[11px] text-red-900/60 block">
                      Submitted on {new Date(video.submittedAt).toLocaleString()}
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-red-700">Completed</span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-[#E8E5E1] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-red-600"></span>
                  <div>
                    <span className="font-bold text-xs text-[#101010]">Assigned to Manager / Employer</span>
                    <span className="text-[11px] text-red-900/60 block">
                      Reviewer: {video.assignedEvaluatorName || 'Sarah Jenkins'}
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-red-700">Completed</span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-[#E8E5E1] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${isEvaluated ? 'bg-red-600' : 'bg-amber-500 animate-pulse'}`}></span>
                  <div>
                    <span className="font-bold text-xs text-[#101010]">Comprehensive Rubric Evaluation</span>
                    <span className="text-[11px] text-red-900/60 block">
                      {isEvaluated ? `Consensus reached with score ${overallScore}%` : 'Evaluation in progress'}
                    </span>
                  </div>
                </div>
                <span className={`text-[11px] font-semibold ${isEvaluated ? 'text-red-700' : 'text-amber-600'}`}>
                  {isEvaluated ? 'Completed' : 'Pending'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E8E5E1] flex justify-end gap-2 shrink-0 bg-[#F5F2EE]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-[#E8E5E1] hover:bg-white text-[#101010] rounded-lg font-semibold transition-colors cursor-pointer text-xs"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
};
