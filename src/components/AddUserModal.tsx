import React, { useState } from 'react';
import { UserRole } from '../types';

interface AddUserModalProps {
  onClose: () => void;
  initialRole?: Exclude<UserRole, 'admin'>;
  onAddUser: (user: {
    name: string;
    email: string;
    role: UserRole;
    department: string;
    title: string;
    phone?: string;
  }) => Promise<void>;
}

export const AddUserModal: React.FC<AddUserModalProps> = ({ onClose, initialRole = 'evaluator', onAddUser }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Exclude<UserRole, 'admin'>>(initialRole);
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;
    setIsSubmitting(true);
    try {
      await onAddUser({ name, email, role, department: '', title: '', phone });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-[#E8E5E1] animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-[#E8E5E1] flex justify-between items-center bg-gradient-to-r from-red-50/50 via-white to-red-50/30">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-red-600 text-xl">person_add</span>
            <h3 className="font-bold text-sm text-[#101010]">Register New User</h3>
          </div>
          <button onClick={onClose} className="text-[#8A8580] hover:text-red-700 cursor-pointer">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#101010] mb-1">Full Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Jessica Martinez"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-[#E8E5E1] px-3 py-2 text-xs text-[#101010] focus:ring-1 focus:ring-red-500 focus:border-red-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#101010] mb-1">Email Address</label>
            <input
              type="email"
              required
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-[#E8E5E1] px-3 py-2 text-xs text-[#101010] focus:ring-1 focus:ring-red-500 focus:border-red-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#101010] mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full rounded-xl border border-[#E8E5E1] px-3 py-2 text-xs text-[#101010] focus:ring-1 focus:ring-red-500 focus:border-red-500 focus:outline-none bg-white cursor-pointer"
            >
              <option value="evaluator">Manager / Employer</option>
              <option value="candidate">Candidate</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#101010] mb-1">Phone Number (Optional)</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="w-full rounded-xl border border-[#E8E5E1] px-3 py-2 text-xs text-[#101010] focus:ring-1 focus:ring-red-500 focus:border-red-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#8A8580] hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white rounded-xl text-xs font-bold transition-all shadow-xs shadow-red-500/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-base">person_add</span>
              {isSubmitting ? 'Saving...' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
