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
      <div className="p-6 border-b border-[#E8E5E1] flex items-center gap-3 bg-white">
        <img src={p2pLogo} alt="" className="w-8 h-8 object-contain shrink-0" />
        <div>
          <span className="font-bold text-lg tracking-tight text-[#101010] flex items-center gap-1.5">
            Interview<span className="text-[#101010]">Pro</span>
          </span>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {portalTitle && (
          <div className="px-3 pb-2 text-[10px] font-bold text-[#101010] uppercase tracking-widest">
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
                  ? 'bg-[#F5F2EE] text-[#101010] font-semibold border-l-3 border-[#101010] shadow-xs'
                  : 'text-[#101010] hover:bg-[#F5F2EE]'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[20px] text-[#101010]">
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
                  ? 'bg-[#F5F2EE] text-[#101010] font-semibold border-l-3 border-[#101010] shadow-xs'
                  : 'text-[#101010] hover:bg-[#F5F2EE]'
              }`}
            >
              <span className="material-symbols-outlined text-[20px] text-[#101010]">
                settings
              </span>
              <span>Settings</span>
            </button>
          </div>
        )}
      </nav>

      {/* User Badge Footer */}
      <div className="p-4 border-t border-[#E8E5E1]">
        <div className="flex items-center gap-3 bg-[#101010] text-white p-3 rounded-xl shadow-xs border border-[#101010]">
          <div className="w-8 h-8 rounded-full bg-white text-[#101010] flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">
            {initials}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold truncate text-white">
              {userTitle}
            </span>
            <span className="text-[10px] text-white font-medium uppercase tracking-widest">
              {userRole === 'admin' ? 'P2P Admin Mode' : userRole === 'candidate' ? 'Candidate Portal' : 'Manager / Employer Portal'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
