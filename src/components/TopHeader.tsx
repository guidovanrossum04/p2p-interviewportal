import React, { useState } from 'react';
import { UserRole, AdminNotification } from '../types';

interface TopHeaderProps {
  userRole: UserRole;
  currentTab: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  adminNotifications: AdminNotification[];
  onOpenAdminNotification: (notification: AdminNotification) => void;
  onMarkAllAdminNotificationsRead: () => void;
  onSwitchRole: (role: UserRole) => void;
  onLogout: () => void;
  onOpenSettings: () => void;
  onOpenMobileMenu?: () => void;
  onOpenHelpModal: () => void;
  currentUserName?: string;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  userRole,
  currentTab,
  searchQuery,
  setSearchQuery,
  adminNotifications,
  onOpenAdminNotification,
  onMarkAllAdminNotificationsRead,
  onSwitchRole,
  onLogout,
  onOpenSettings,
  onOpenMobileMenu,
  onOpenHelpModal,
  currentUserName,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const unreadCount = adminNotifications.filter((notification) => !notification.isRead).length;

  const pageTitle =
    userRole === 'admin'
      ? currentTab === 'overview'
        ? 'Admin Dashboard Overview'
        : currentTab === 'users'
        ? 'User & Roles'
        : currentTab === 'videos'
        ? 'Submissions'
        : currentTab === 'assignments'
        ? 'Assignments'
        : 'System Settings'
      : userRole === 'candidate'
      ? 'Candidate Video & Evaluation Portal'
      : currentTab === 'dashboard'
      ? 'Interview Evaluation Platform'
      : currentTab === 'videos'
      ? 'Candidate Video Review Queue'
      : currentTab === 'evaluations'
      ? 'My Evaluations & Rubrics'
      : 'Manager / Employer Portal';

  const nameForInitials = currentUserName || (userRole === 'candidate' ? 'Candidate' : userRole === 'evaluator' ? 'Manager / Employer' : 'Admin');
  const initials = nameForInitials.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  const defaultName =
    userRole === 'admin'
      ? 'Administrator'
      : userRole === 'candidate'
      ? 'Candidate'
      : 'Manager / Employer';

  const roleLabel = userRole === 'evaluator' ? 'Manager / Employer' : userRole;
  const displayName = currentUserName ? `${currentUserName} (${roleLabel})` : defaultName;

  return (
    <header
      id="top-navigation-header"
      className="h-16 bg-white border-b border-[#E8E5E1] flex items-center justify-between px-4 md:px-8 sticky top-0 z-40 select-none shadow-xs"
    >
      {/* Left: Mobile Menu + Project / Page Tag */}
      <div className="flex items-center gap-3">
        <button
          id="mobile-menu-toggle-btn"
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 text-[#101010] hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
          aria-label="Open menu"
        >
          <span className="material-symbols-outlined text-2xl">menu</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-red-900 px-3 py-1 bg-red-50/80 border border-red-200/60 rounded-lg">
            {pageTitle}
          </span>
        </div>
      </div>

      {/* Right: Status Indicators + Search + Notifications + Help + Profile Avatar */}
      <div className="flex items-center gap-3 md:gap-5">
        {/* Search */}
        <div className="relative hidden sm:block">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-red-400 text-[18px]">
            search
          </span>
          <input
            id="global-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidates, videos, Managers / Employers..."
            className="pl-9 pr-4 py-1.5 border border-[#E8E5E1] rounded-xl text-xs text-[#101010] bg-[#F5F2EE] focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none w-52 lg:w-64 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-red-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* Admin notifications */}
        {userRole === 'admin' && <div className="relative">
          <button
            id="notifications-btn"
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfileMenu(false);
            }}
            className="p-2 text-[#8A8580] hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors relative cursor-pointer"
            title="Notifications"
          >
            <span className="material-symbols-outlined text-xl">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white ring-2 ring-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white border border-[#E8E5E1] rounded-2xl shadow-xl z-50 p-4 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex justify-between items-center pb-3 border-b border-red-100">
                <h4 className="font-bold text-xs text-red-950 uppercase tracking-wider">Notifications</h4>
                {unreadCount > 0 && (
                  <button
                    onClick={() => {
                      onMarkAllAdminNotificationsRead();
                    }}
                    className="text-xs text-red-600 hover:text-red-700 font-semibold cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="py-2 divide-y divide-red-50 max-h-72 overflow-y-auto">
                {adminNotifications.length === 0 ? (
                  <p className="text-xs text-[#8A8580] py-4 text-center">No new notifications</p>
                ) : (
                  adminNotifications.map((notification) => {
                    const body = (
                      <>
                        <span className={`material-symbols-outlined mt-0.5 text-xs p-1.5 rounded-lg ${
                          'isAlert' in notification && notification.isAlert ? 'bg-red-100 text-red-700' : 'bg-red-50 text-red-600'
                        }`}>
                          {notification.icon}
                        </span>
                        <span className="flex-1 min-w-0 text-left">
                          <span className="block text-xs text-[#101010] leading-snug font-medium">{notification.title}</span>
                          {notification.description && <span className="mt-0.5 block truncate text-[10px] text-[#8A8580]">{notification.description}</span>}
                          <span className="text-[10px] text-red-900/60 mt-0.5 block">
                            {'timeAgo' in notification && notification.timeAgo
                              ? notification.timeAgo
                              : new Date(notification.timestamp).toLocaleString()}
                          </span>
                        </span>
                        {!notification.isRead && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-red-600" />}
                      </>
                    );
                    return (
                      <div key={notification.id} className="border-b border-red-50 last:border-0">
                        <button
                          type="button"
                          onClick={() => {
                            onOpenAdminNotification(notification);
                            setShowNotifications(false);
                          }}
                          className="flex w-full items-start gap-2.5 py-2.5 text-left hover:bg-red-50/60"
                        >
                          {body}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>}

        {/* Help button */}
        <button
          id="help-guide-btn"
          onClick={onOpenHelpModal}
          className="p-2 text-[#8A8580] hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
          title="Help & Guidelines"
        >
          <span className="material-symbols-outlined text-xl">help_outline</span>
        </button>

        {/* User Profile Avatar with dropdown */}
        <div className="relative">
          <button
            id="user-profile-menu-btn"
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2 p-1 rounded-xl hover:bg-red-50 transition-all cursor-pointer ring-1 ring-[#E8E5E1]"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden border border-red-300 bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center text-white text-xs font-bold shadow-xs">
              {initials}
            </div>
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-72 bg-white border border-[#E8E5E1] rounded-2xl shadow-xl z-50 p-2 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="p-3 border-b border-red-100 mb-1 bg-red-50/50 rounded-xl">
                <p className="text-xs font-bold text-red-950 truncate">{displayName}</p>
                <span className="inline-block mt-1 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-600 text-white shadow-xs">
                  {userRole} mode
                </span>
              </div>

              <div className="py-2 px-3 text-xs space-y-2">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-red-900/60 font-medium">Session Role:</span>
                  <span className="font-bold text-[#101010] uppercase tracking-wide">{userRole}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-red-900/60 font-medium">Access Control:</span>
                  <span className="font-semibold text-emerald-700">Link-Verified</span>
                </div>
              </div>

              <div className="pt-2 mt-1 border-t border-red-100">
                {userRole === 'admin' && (
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      onOpenSettings();
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-[#101010] hover:bg-red-50 rounded-xl flex items-center gap-2 font-semibold cursor-pointer transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">settings</span>
                    Settings
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onLogout();
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-2 font-bold cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-base">logout</span>
                  Sign Out / Switch Portal
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
