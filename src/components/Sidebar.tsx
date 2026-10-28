import React from 'react';
import { UserRole } from '../types';
import p2pLogo from '../../assets/p2plogo.webp';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  userRole: UserRole;
  currentUserName?: string;
  candidatePendingCount?: number;
  employerPendingCount?: number;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  userRole,
  currentUserName,
  candidatePendingCount = 0,
  employerPendingCount = 0,
  onOpenSettings,
}) => {
  let navItems: { id: string; label: string; icon: string; badge?: string; badgeTitle?: string }[] = [];
  let portalTitle: string | null = 'HR Portal';

  if (userRole === 'candidate') {
    portalTitle = 'Candidate Portal';
    navItems = [
      { id: 'candidate_hub', label: 'My Submissions', icon: 'video_library', badge: undefined },
      { id: 'guidelines', label: 'Prep & Guidelines', icon: 'help_outline', badge: undefined },
    ];
  } else if (userRole === 'evaluator') {
    portalTitle = 'Manager / Employer Portal';
    navItems = [
      { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', badge: undefined },
    ];
  } else {
    portalTitle = null;
    navItems = [
      { id: 'overview', label: 'Overview', icon: 'dashboard', badge: undefined },
      { id: 'links', label: 'Shareable Links', icon: 'link', badge: 'Active' },
      { id: 'users', label: 'User & Roles', icon: 'group', badge: undefined },
      {
        id: 'videos',
        label: 'Submissions',
        icon: 'video_library',
        badge: candidatePendingCount > 0 ? `${candidatePendingCount}` : undefined,
        badgeTitle: 'Candidate submissions awaiting completion',
      },
      {
        id: 'assignments',
        label: 'Assignments',
        icon: 'assignment',
        badge: employerPendingCount > 0 ? `${employerPendingCount}` : undefined,
        badgeTitle: 'Manager / Employer assignments awaiting completion',
      },
    ];
  }

  const userTitle = currentUserName || (userRole === 'candidate' ? 'Candidate' : userRole === 'evaluator' ? 'Manager / Employer' : 'Administrator');
  const initials = userTitle.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  return (
    <aside
      id="sidebar-navigation"
      className="hidden md:flex w-64 h-screen fixed left-0 top-0 bg-white text-[#101010] border-r border-[#E8E5E1] flex-col z-50 select-none shadow-xs"
    >
      {/* Brand Header */}
      <div className="p-6 border-b border-[#E8E5E1] flex items-center gap-3 bg-gradient-to-r from-white via-rose-50/40 to-white">
        <img src={p2pLogo} alt="" className="w-8 h-8 object-contain shrink-0" />
        <div>
          <span className="font-bold text-lg tracking-tight text-[#101010] flex items-center gap-1.5">
            Interview<span className="text-red-600">Pro</span>
          </span>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {portalTitle && (
          <div className="px-3 pb-2 text-[10px] font-bold text-red-900/50 uppercase tracking-widest">
            {portalTitle}
          </div>
        )}

        {navItems.map((item) => {
          const isActive =
            currentTab === item.id ||
            (currentTab === 'overview' && item.id === 'dashboard') ||
            (currentTab === 'dashboard' && item.id === 'overview') ||
            (currentTab === 'candidate_hub' && (item.id === 'candidate_hub' || item.id === 'dashboard')) ||
            (currentTab === 'assignments' && item.id === 'evaluations') ||
            (currentTab === 'evaluations' && item.id === 'assignments');

          return (
            <button
              key={item.id}
              id={`nav-item-${item.id}`}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left cursor-pointer ${
                isActive
                  ? 'bg-red-50 text-red-700 font-semibold border-l-3 border-red-600 shadow-xs'
                  : 'text-[#8A8580] hover:text-red-700 hover:bg-rose-50/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`material-symbols-outlined text-[20px] ${isActive ? 'text-red-600' : 'opacity-75'}`}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  title={item.badgeTitle}
                  aria-label={item.badgeTitle ? `${item.badgeTitle}: ${item.badge}` : item.badge}
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white shadow-xs"
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {userRole === 'admin' && (
          <div className="pt-2">
            <button
              id="nav-settings-btn"
              onClick={onOpenSettings}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                currentTab === 'settings'
                  ? 'bg-red-50 text-red-700 font-semibold border-l-3 border-red-600 shadow-xs'
                  : 'text-[#8A8580] hover:text-red-700 hover:bg-rose-50/50'
              }`}
            >
              <span className={`material-symbols-outlined text-[20px] ${currentTab === 'settings' ? 'text-red-600' : 'opacity-75'}`}>
                settings
              </span>
              <span>Settings</span>
            </button>
          </div>
        )}
      </nav>

      {/* User Badge Footer */}
      <div className="p-4 border-t border-[#E8E5E1]">
        <div className="flex items-center gap-3 bg-gradient-to-r from-red-950 via-stone-900 to-red-900 text-white p-3 rounded-xl shadow-xs border border-red-900/30">
          <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">
            {initials}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold truncate text-white">
              {userTitle}
            </span>
            <span className="text-[10px] text-red-300 font-medium uppercase tracking-widest">
              {userRole} Mode
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
