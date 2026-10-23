import React, { useState } from 'react';
import { User } from '../types';

interface BatchUploadModalProps {
  evaluators: User[];
  onClose: () => void;
  onBatchSubmit: (batchData: {
    batchName: string;
    roleApplied: string;
    department: string;
    assignedEvaluatorId: string;
    candidates: { name: string; email: string }[];
  }) => Promise<void>;
}

export const BatchUploadModal: React.FC<BatchUploadModalProps> = ({
  evaluators,
  onClose,
  onBatchSubmit,
}) => {
  const [batchName, setBatchName] = useState('Engineering Q3 Technical Assessments');
  const [roleApplied, setRoleApplied] = useState('Senior Full Stack Engineer');
  const [department, setDepartment] = useState('Engineering');
  const [assignedEvaluatorId, setAssignedEvaluatorId] = useState(evaluators[0]?.id || 'usr-1');
  const [candidateListText, setCandidateListText] = useState(
    `Jordan Hayes, jordan.hayes@example.com\nTaylor Swift, taylor.s@example.com\nAlex Rivera, alex.rivera@example.com`
  );
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);

    // Simulate progress animation
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) {
          clearInterval(interval);
          return 90;
        }
        return p + 20;
      });
    }, 150);

    const candidates = candidateListText
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line, idx) => {
        const [name, email] = line.split(',');
        return {
          name: name ? name.trim() : `Batch Candidate #${idx + 1}`,
          email: email ? email.trim() : `candidate${idx + 1}@example.com`,
        };
      });

    try {
      await onBatchSubmit({
        batchName,
        roleApplied,
        department,
        assignedEvaluatorId,
        candidates: candidates.length > 0 ? candidates : [{ name: 'Sample Candidate', email: 'cand@test.com' }],
      });
      setProgress(100);
      setTimeout(() => {
        onClose();
      }, 400);
    } finally {
      clearInterval(interval);
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-[#F5DADB] animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-[#F5DADB] flex justify-between items-center bg-gradient-to-r from-red-50/50 via-white to-red-50/30">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-red-600 text-xl">cloud_upload</span>
            <h3 className="font-bold text-sm text-[#1F1617]">Batch Video Ingestion</h3>
          </div>
          <button onClick={onClose} className="text-[#6B7280] hover:text-red-700 cursor-pointer">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#1F1617] mb-1">Batch Name</label>
            <input
              type="text"
              required
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              className="w-full rounded-xl border border-[#F5DADB] px-3 py-2 text-xs text-[#1F1617] focus:ring-1 focus:ring-red-500 focus:border-red-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#1F1617] mb-1">Target Role</label>
              <input
                type="text"
                required
                value={roleApplied}
                onChange={(e) => setRoleApplied(e.target.value)}
                className="w-full rounded-xl border border-[#F5DADB] px-3 py-2 text-xs text-[#1F1617] focus:ring-1 focus:ring-red-500 focus:border-red-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1F1617] mb-1">Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full rounded-xl border border-[#F5DADB] px-3 py-2 text-xs text-[#1F1617] focus:ring-1 focus:ring-red-500 focus:border-red-500 focus:outline-none bg-white cursor-pointer"
              >
                <option value="Engineering">Engineering</option>
                <option value="Product">Product</option>
                <option value="Design">Design</option>
                <option value="Sales">Sales & Marketing</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1F1617] mb-1">Assign Lead Manager / Employer</label>
            <select
              value={assignedEvaluatorId}
              onChange={(e) => setAssignedEvaluatorId(e.target.value)}
              className="w-full rounded-xl border border-[#F5DADB] px-3 py-2 text-xs text-[#1F1617] focus:ring-1 focus:ring-red-500 focus:border-red-500 focus:outline-none bg-white cursor-pointer"
            >
              {evaluators.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} ({ev.department || 'Manager / Employer'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1F1617] mb-1">
              Candidate Roster (Name, Email per line)
            </label>
            <textarea
              rows={3}
              value={candidateListText}
              onChange={(e) => setCandidateListText(e.target.value)}
              className="w-full rounded-xl border border-[#F5DADB] p-2.5 text-xs font-mono text-[#1F1617] focus:ring-1 focus:ring-red-500 focus:border-red-500 focus:outline-none"
            />
          </div>

          {/* Drag and Drop Zone */}
          <div className="border border-dashed border-red-300 rounded-2xl p-4 text-center bg-red-50/30 hover:bg-red-50/60 transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-3xl text-red-600">video_file</span>
            <p className="text-xs font-bold text-[#1F1617] mt-1">Drag & drop raw MP4/WebM files here</p>
            <p className="text-[10px] text-red-900/60">or click to browse local video repository</p>
          </div>

          {isUploading && (
            <div>
              <div className="flex justify-between text-[11px] font-bold text-[#1F1617] mb-1">
                <span>Processing & Transcoding Videos...</span>
                <span className="text-red-600">{progress}%</span>
              </div>
              <div className="w-full bg-red-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-red-600 h-1.5 rounded-full transition-all duration-200"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#6B7280] hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-red-500/20 disabled:opacity-70 flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">cloud_done</span>
              {isUploading ? 'Ingesting Batch...' : 'Start Ingestion'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
