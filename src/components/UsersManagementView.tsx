import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { GENERIC_AVATAR } from '../data/placeholders';

interface UsersManagementViewProps {
  users: User[];
  onOpenAddUser: () => void;
  onDeleteUser: (user: User) => void;
  searchQuery: string;
}

export const UsersManagementView: React.FC<UsersManagementViewProps> = ({
  users,
  onOpenAddUser,
  onDeleteUser,
  searchQuery,
}) => {
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');

  const filteredUsers = users.filter((u) => {
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.department && u.department.toLowerCase().includes(q)) ||
      (u.title && u.title.toLowerCase().includes(q));

    return matchesRole && matchesSearch;
  });

  return (
    <div id="users-management-view" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-[#E8E5E1] shadow-xs">
        <div>
          <h2 className="text-2xl font-bold text-[#101010]">User & Manager / Employer Directory</h2>
          <p className="text-xs text-red-900/60 mt-1">
            Manage Managers / Employers, recruitment administrators, and candidate accounts.
          </p>
        </div>

        <button
          onClick={onOpenAddUser}
          className="bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm shadow-red-500/20 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          Add New User
        </button>
      </div>

      {/* Role Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {(['admin', 'all', 'evaluator', 'candidate'] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRoleFilter(r)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all capitalize cursor-pointer ${
              roleFilter === r
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-white border border-[#E8E5E1] text-[#8A8580] hover:text-red-700 hover:bg-rose-50/40'
            }`}
          >
            {r === 'all' ? 'All Roles' : r === 'evaluator' ? 'Managers / Employers' : `${r}s`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E8E5E1] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E8E5E1] bg-red-50/40 text-[11px] font-bold text-red-900/60 uppercase tracking-wider">
                <th className="px-6 py-3.5">User</th>
                <th className="px-6 py-3.5">Role</th>
                <th className="px-6 py-3.5">Department / Title</th>
                <th className="px-6 py-3.5">Assigned / Completed</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Last Active</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E5E1] text-xs">
              {filteredUsers.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-[#8A8580]">No users match this filter.</td></tr>
              ) : filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-rose-50/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={user.avatar || GENERIC_AVATAR}
                        alt={user.name}
                        className="w-9 h-9 rounded-full object-cover border border-[#E8E5E1]"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <span className="font-bold text-[#101010] block hover:text-red-700 transition-colors">{user.name}</span>
                        <span className="text-[11px] text-red-900/60">{user.email}</span>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        user.role === 'admin'
                          ? 'bg-gray-900 text-white border-gray-900'
                          : user.role === 'evaluator'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-gray-50 text-gray-700 border-gray-200'
                      }`}
                    >
                      {user.role === 'evaluator' ? 'Manager / Employer' : user.role}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <span className="font-medium text-[#101010] block text-xs">{user.title || user.department}</span>
                    <span className="text-[11px] text-[#8A8580]">{user.department}</span>
                  </td>

                  <td className="px-6 py-4 text-xs font-mono">
                    {user.role === 'evaluator' ? (
                      <span className="text-red-700 font-bold">
                        {user.assignedCount ?? 0} assigned / {user.completedCount ?? 0} done
                      </span>
                    ) : (
                      <span className="text-[#8A8580]">—</span>
                    )}
                  </td>

                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                      Active
                    </span>
                  </td>

                  <td className="px-6 py-4 text-xs text-[#8A8580]">{user.lastActive || 'Recently'}</td>
                  <td className="px-6 py-4 text-right">
                    {user.role !== 'admin' && (
                      <button
                        type="button"
                        onClick={() => onDeleteUser(user)}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-50"
                        aria-label={`Delete ${user.role} account for ${user.name}`}
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
