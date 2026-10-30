import React, { useEffect, useState } from 'react';
import { User, UserRole } from '../types';
import { DataCleanupControls } from './DataCleanupControls';

interface AdminAccountViewProps {
  name: string;
  email: string;
  users: User[];
  searchQuery: string;
  onAddUser: (role: Exclude<UserRole, 'admin'>) => void;
  onDeleteUser: (user: User) => void;
  onCleanupComplete: () => Promise<unknown>;
}

export const AdminAccountView: React.FC<AdminAccountViewProps> = ({
  name,
  email,
  users,
  searchQuery,
  onAddUser,
  onDeleteUser,
  onCleanupComplete,
}) => (
  <AdminAccountContent
    name={name}
    email={email}
    users={users}
    searchQuery={searchQuery}
    onAddUser={onAddUser}
    onDeleteUser={onDeleteUser}
    onCleanupComplete={onCleanupComplete}
  />
);

const AdminAccountContent: React.FC<AdminAccountViewProps> = ({
  name,
  email,
  users,
  searchQuery,
  onAddUser,
  onDeleteUser,
  onCleanupComplete,
}) => {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [listedUsers, setListedUsers] = useState<User[]>(users);
  const [totalUsers, setTotalUsers] = useState(users.length);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const effectiveSearch = searchQuery.trim() || search.trim();
  const pageCount = Math.max(1, Math.ceil(totalUsers / pageSize));

  useEffect(() => {
    setPage(1);
  }, [effectiveSearch, roleFilter, pageSize]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  useEffect(() => {
    const controller = new AbortController();
    const loadUsers = async () => {
      setIsLoadingUsers(true);
      setLoadError(null);
      try {
        const params = new URLSearchParams({
          role: roleFilter,
          search: effectiveSearch,
          page: String(page),
          limit: String(pageSize),
        });
        const response = await fetch(`/api/users?${params.toString()}`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not search users.');
        setListedUsers(Array.isArray(result.items) ? result.items : []);
        setTotalUsers(Number(result.total) || 0);
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoadError(error instanceof Error ? error.message : 'Could not search users.');
      } finally {
        if (!controller.signal.aborted) setIsLoadingUsers(false);
      }
    };
    void loadUsers();
    return () => controller.abort();
  }, [effectiveSearch, roleFilter, page, pageSize, users]);

  return (
  <section className="max-w-5xl space-y-6">
    <header>
      <h2 className="text-2xl font-bold text-[#101010]">User &amp; Roles</h2>
      <p className="mt-1 text-xs text-red-900/60">Manage the administrator account and add portal users.</p>
    </header>

    <div className="grid gap-4 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => onAddUser('candidate')}
        className="flex items-center gap-3 rounded-2xl border border-[#E8E5E1] bg-white p-5 text-left shadow-xs transition-colors hover:border-red-300 hover:bg-rose-50/30"
      >
        <span className="material-symbols-outlined flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">person_add</span>
        <span>
          <span className="block text-sm font-bold text-[#101010]">Add Candidate</span>
          <span className="mt-1 block text-xs text-[#8A8580]">Create a candidate account</span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => onAddUser('evaluator')}
        className="flex items-center gap-3 rounded-2xl border border-[#E8E5E1] bg-white p-5 text-left shadow-xs transition-colors hover:border-red-300 hover:bg-rose-50/30"
      >
        <span className="material-symbols-outlined flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">group_add</span>
        <span>
          <span className="block text-sm font-bold text-[#101010]">Add Manager / Employer</span>
          <span className="mt-1 block text-xs text-[#8A8580]">Create a reviewer account</span>
        </span>
      </button>
    </div>

    <div className="rounded-2xl border border-[#E8E5E1] bg-white p-6 shadow-xs">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700">
          <span className="material-symbols-outlined">admin_panel_settings</span>
        </div>
        <div>
          <h3 className="text-sm font-bold text-[#101010]">{name || 'P2P Admin'}</h3>
          <p className="mt-1 text-xs text-[#8A8580]">Administrator</p>
        </div>
      </div>
      <div className="mt-6 border-t border-[#E8E5E1] pt-4">
        <p className="break-all text-sm font-medium text-[#101010]">{email}</p>
      </div>
    </div>

    <div className="overflow-hidden rounded-2xl border border-[#E8E5E1] bg-white shadow-xs">
      <div className="flex flex-col gap-4 border-b border-[#E8E5E1] px-6 py-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 className="text-sm font-bold text-[#101010]">Users</h3>
          <p className="mt-1 text-xs text-red-900/60">{totalUsers} matching accounts</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative">
            <span className="sr-only">Search users</span>
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base text-[#8A8580]">search</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or email"
              className="w-full rounded-xl border border-[#E8E5E1] py-2 pl-9 pr-3 text-xs text-[#101010] focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 sm:w-56"
            />
          </label>
          <label>
            <span className="sr-only">Filter users by role</span>
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as 'all' | UserRole)}
              className="w-full rounded-xl border border-[#E8E5E1] bg-white px-3 py-2 text-xs text-[#101010] focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 sm:w-48"
            >
              <option value="all">All roles</option>
              <option value="candidate">Candidates</option>
              <option value="evaluator">Managers / Employers</option>
              <option value="admin">Administrators</option>
            </select>
          </label>
        </div>
      </div>
      {loadError && <p role="alert" className="border-b border-red-100 bg-red-50 px-6 py-2 text-xs text-red-700">{loadError}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[#E8E5E1] bg-red-50/40 text-[10px] font-bold uppercase tracking-wider text-red-900/60">
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">Email</th>
              <th className="px-6 py-3">Role</th>
              <th className="px-6 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E8E5E1] text-xs">
            {isLoadingUsers ? (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-[#8A8580]">Searching users...</td></tr>
            ) : listedUsers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-[#8A8580]">
                  {users.length ? 'No users match your search and filter.' : 'No users have been added yet.'}
                </td>
              </tr>
            ) : listedUsers.map((user) => (
              <tr key={user.id} className="hover:bg-rose-50/30">
                <td className="px-6 py-4 font-semibold text-[#101010]">{user.name}</td>
                <td className="px-6 py-4 text-[#8A8580]">{user.email}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    user.role === 'evaluator'
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : user.role === 'candidate'
                      ? 'border-gray-200 bg-gray-50 text-gray-700'
                      : 'border-gray-200 bg-gray-900 text-white'
                  }`}>
                    {user.role === 'evaluator' ? 'Manager / Employer' : user.role}
                  </span>
                </td>
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
      <div className="flex flex-col gap-3 border-t border-[#E8E5E1] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs text-[#8A8580]">
          <span>Rows per page</span>
          <select
            value={pageSize}
            onChange={(event) => setPageSize(Number(event.target.value))}
            className="rounded-lg border border-[#E8E5E1] bg-white px-2 py-1.5 text-xs text-[#101010]"
            aria-label="Rows per page"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
          <span>· Showing {totalUsers ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, totalUsers)} of {totalUsers}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-[#E8E5E1] px-3 py-1.5 text-xs font-semibold text-[#8A8580] hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <span className="min-w-16 text-center text-xs text-[#8A8580]">Page {page} of {pageCount}</span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
            disabled={page >= pageCount}
            className="rounded-lg border border-[#E8E5E1] px-3 py-1.5 text-xs font-semibold text-[#8A8580] hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
    <DataCleanupControls onComplete={onCleanupComplete} />
  </section>
  );
};
