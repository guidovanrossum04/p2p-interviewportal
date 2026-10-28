import React, { useState } from 'react';

type CleanupResource = 'submissions' | 'videos' | 'users' | 'links';

interface DataCleanupControlsProps {
  onComplete: () => Promise<unknown>;
}

interface CleanupAction {
  resource: CleanupResource;
  title: string;
  description: string;
  details: string;
}

const cleanupActions: CleanupAction[] = [
  {
    resource: 'submissions',
    title: 'Clean Submissions',
    description: 'Remove all submission records and associated content.',
    details: 'Deletes videos, supporting documents, assignments, evaluations, and links associated with submissions. User accounts are kept.',
  },
  {
    resource: 'videos',
    title: 'Clean Video Files',
    description: 'Remove uploaded video files but keep submission records.',
    details: 'Video files are permanently removed. Submission metadata, evaluations, and supporting documents are retained.',
  },
  {
    resource: 'users',
    title: 'Clean User Listing',
    description: 'Remove all non-admin Candidate and Manager / Employer accounts.',
    details: 'The admin account is preserved. Manager / Employer assignments and evaluations are removed, and affected submissions return to pending review.',
  },
  {
    resource: 'links',
    title: 'Delete All Links',
    description: 'Remove all shareable upload and review links.',
    details: 'Assignments and evaluations connected to review links are deleted too. Submission and video records remain.',
  },
];

export const DataCleanupControls: React.FC<DataCleanupControlsProps> = ({ onComplete }) => {
  const [selectedAction, setSelectedAction] = useState<CleanupAction | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [isCleaning, setIsCleaning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const closeDialog = () => {
    if (isCleaning) return;
    setSelectedAction(null);
    setConfirmation('');
    setError(null);
  };

  const runCleanup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedAction || confirmation !== 'DELETE') return;
    setIsCleaning(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/cleanup/${selectedAction.resource}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Cleanup could not be completed.');
      const counts = Object.entries(result.deleted || {})
        .map(([key, count]) => `${count} ${key}`)
        .join(', ');
      const fileWarning = Array.isArray(result.fileErrors) && result.fileErrors.length
        ? ` ${result.fileErrors.length} file(s) could not be removed.`
        : '';
      setNotice(`Cleanup complete. Removed ${counts || 'no records'}; ${result.removedFiles || 0} file(s).${fileWarning}`);
      await onComplete();
      setSelectedAction(null);
      setConfirmation('');
    } catch (cleanupError) {
      setError(cleanupError instanceof Error ? cleanupError.message : 'Cleanup could not be completed.');
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-red-200 bg-white p-6 shadow-xs">
      <div>
        <h3 className="text-sm font-bold text-red-800">Data Cleanup</h3>
        <p className="mt-1 text-xs text-[#8A8580]">These actions affect all records in the selected category and cannot be undone.</p>
      </div>
      {notice && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{notice}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {cleanupActions.map((action) => (
          <div key={action.resource} className="rounded-xl border border-[#E8E5E1] p-4">
            <h4 className="text-xs font-bold text-[#101010]">{action.title}</h4>
            <p className="mt-1 min-h-8 text-[11px] text-[#8A8580]">{action.description}</p>
            <button
              type="button"
              onClick={() => {
                setSelectedAction(action);
                setError(null);
              }}
              className="mt-3 rounded-lg border border-red-200 px-3 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-50"
            >
              Clean up
            </button>
          </div>
        ))}
      </div>

      {selectedAction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="presentation">
          <form onSubmit={runCleanup} className="w-full max-w-lg space-y-4 rounded-2xl border border-red-200 bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="cleanup-dialog-title">
            <div>
              <h3 id="cleanup-dialog-title" className="text-base font-bold text-red-800">{selectedAction.title}?</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#5A5550]">{selectedAction.details}</p>
              <p className="mt-2 text-xs font-bold text-red-700">This applies to all records in this category, not only the current page.</p>
            </div>
            <label className="block text-xs font-semibold text-[#101010]">
              Type DELETE to confirm
              <input
                type="text"
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E8E5E1] px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </label>
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeDialog} disabled={isCleaning} className="rounded-xl border border-[#E8E5E1] px-4 py-2 text-xs font-semibold text-[#8A8580] disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={isCleaning || confirmation !== 'DELETE'} className="rounded-xl bg-red-700 px-4 py-2 text-xs font-bold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50">
                {isCleaning ? 'Cleaning...' : 'Confirm cleanup'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};
