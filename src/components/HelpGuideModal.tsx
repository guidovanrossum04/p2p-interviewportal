import React from 'react';

interface HelpGuideModalProps {
  onClose: () => void;
}

export const HelpGuideModal: React.FC<HelpGuideModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden border border-[#F5DADB] animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-[#F5DADB] flex justify-between items-center bg-gradient-to-r from-red-50/50 via-white to-red-50/30">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-red-600 text-xl">menu_book</span>
            <h3 className="font-bold text-sm text-[#1F1617]">InterviewPro Evaluation Suite Manual</h3>
          </div>
          <button onClick={onClose} className="text-[#6B7280] hover:text-red-700 cursor-pointer">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs text-[#1F1617] leading-relaxed">
          <div className="p-4 rounded-xl bg-[#FAF4F4] border border-[#F5DADB]">
            <h4 className="font-bold text-xs text-[#1F1617] mb-1">1. Manager / Employer Review Queue & Rubric Scoring</h4>
            <p className="text-red-900/70">
              Managers / Employers review assigned candidate videos within the 24-hour SLA window. Use the built-in video player with
              variable playback speed (1x to 2x), precision scrubber, candidate profile brief, and standardized evaluation rubrics.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#FAF4F4] border border-[#F5DADB]">
            <h4 className="font-bold text-xs text-[#1F1617] mb-1">2. AI-Powered Evaluation Co-pilot</h4>
            <p className="text-red-900/70">
              The platform utilizes Google Gemini AI to analyze candidate submissions and evaluator observations, formulating
              objective summaries, identifying core strengths, and highlighting areas for further evaluation.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#FAF4F4] border border-[#F5DADB]">
            <h4 className="font-bold text-xs text-[#1F1617] mb-1">3. Admin Dashboard & Batch Ingestion</h4>
            <p className="text-red-900/70">
              Administrators can track global user growth, video intake, SLA compliance rates, and dispatch batch video
              uploads with automated evaluator workload distribution.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#FAF4F4] border border-[#F5DADB]">
            <h4 className="font-bold text-xs text-[#1F1617] mb-1">4. Role Switching & Candidate Portal</h4>
            <p className="text-red-900/70">
              Easily toggle between <strong>Candidate</strong>, <strong>Manager / Employer</strong>, and <strong>Administrator</strong> via the profile avatar menu or log out to switch personas.
            </p>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white rounded-lg text-xs font-bold transition-all shadow-xs shadow-red-500/20 cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
