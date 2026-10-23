import React, { useState, useEffect, useCallback } from 'react';
import p2pLogo from '../assets/p2plogo.webp';
import {
  User,
  UserRole,
  CandidateVideo,
  DashboardStats,
  EvaluatorStats,
  ActivityItem,
  AdminNotification,
  SystemSettings,
  InviteLink,
  InviteType,
} from './types';
import {
  initialUsers,
  initialVideos,
  initialStats,
  initialEvaluatorStats,
  initialActivities,
  initialSettings,
  initialInviteLinks,
} from './data/mockData';
import { GENERIC_AVATAR, GENERIC_VIDEO_THUMBNAIL } from './data/placeholders';

// Components
import { AuthScreen } from './components/AuthScreen';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { AdminOverview } from './components/AdminOverview';
import { AdminAssignmentsView } from './components/AdminAssignmentsView';
import { EvaluatorDashboard } from './components/EvaluatorDashboard';
import { AllVideosView } from './components/AllVideosView';
import { UsersManagementView } from './components/UsersManagementView';
import { AdminAccountView } from './components/AdminAccountView';
import { SystemSettingsView } from './components/SystemSettingsView';
import { CandidatePortalView } from './components/CandidatePortalView';
import { CandidatePrepGuidelinesView } from './components/CandidatePrepGuidelinesView';
import { getSubmissionId } from './utils/submissions';
import { InviteLinksView } from './components/InviteLinksView';

// Modals
import { VideoPlayerEvaluationModal } from './components/VideoPlayerEvaluationModal';
import { BatchUploadModal } from './components/BatchUploadModal';
import { NewAssignmentModal } from './components/NewAssignmentModal';
import { AddUserModal } from './components/AddUserModal';
import { ReportModal } from './components/ReportModal';
import { HelpGuideModal } from './components/HelpGuideModal';
import { CreateInviteLinkModal } from './components/CreateInviteLinkModal';

export default function App() {
  const emptyAdminUser: User = {
    id: 'admin-session',
    name: 'P2P Admin',
    email: 'p2precruitment2025@gmail.com',
    role: 'admin',
    avatar: '',
    status: 'active',
    assignedCount: 0,
    completedCount: 0,
    lastActive: 'Just now',
  };

  const adminSeed = initialUsers.find((user) => user.role === 'admin') || emptyAdminUser;
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isRestoringAdminSession, setIsRestoringAdminSession] = useState(true);
  const [currentUser, setCurrentUser] = useState<User>(adminSeed);
  const [userRole, setUserRole] = useState<UserRole>('admin');
  const [activeInvite, setActiveInvite] = useState<InviteLink | null>(null);

  // Navigation State
  const [currentTab, setCurrentTab] = useState<string>('overview');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Data State
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [evaluatorStats, setEvaluatorStats] = useState<EvaluatorStats>(initialEvaluatorStats);
  const [videos, setVideos] = useState<CandidateVideo[]>(initialVideos);
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [activities, setActivities] = useState<ActivityItem[]>(initialActivities);
  const [adminSessionToken, setAdminSessionToken] = useState('');
  const [adminNotifications, setAdminNotifications] = useState<AdminNotification[]>(() => {
    try {
      const saved: unknown = JSON.parse(window.localStorage.getItem('p2p_admin_notifications_v1') || '[]');
      if (!Array.isArray(saved)) return [];
      return saved.filter((item): item is AdminNotification =>
        item
        && typeof item.id === 'string'
        && ['candidate_submission', 'submission_updated', 'assignment_updated'].includes(item.type)
        && typeof item.title === 'string'
        && typeof item.description === 'string'
        && typeof item.timestamp === 'string'
        && typeof item.icon === 'string'
        && typeof item.submissionId === 'string'
        && typeof item.isRead === 'boolean',
      ).slice(0, 50);
    } catch (error) {
      console.warn('Could not restore admin notifications from browser storage.', error);
      return [];
    }
  });
  const [sidebarCounts, setSidebarCounts] = useState({ candidatePending: 0, employerPending: 0 });
  const [focusedSubmissionId, setFocusedSubmissionId] = useState('');
  const [settings, setSettings] = useState<SystemSettings>(initialSettings);
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>(initialInviteLinks);
  const [candidateUploadLinks, setCandidateUploadLinks] = useState<InviteLink[]>([]);
  const [invitePage, setInvitePage] = useState(1);
  const [inviteTotal, setInviteTotal] = useState(0);
  const [invitePageSize] = useState(10);
  const [isLoadingInvites, setIsLoadingInvites] = useState(false);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [assignmentRefreshKey, setAssignmentRefreshKey] = useState(0);

  // Modals
  const [selectedVideoForEval, setSelectedVideoForEval] = useState<CandidateVideo | null>(null);
  const [showBatchUploadModal, setShowBatchUploadModal] = useState<boolean>(false);
  const [showNewAssignmentModal, setShowNewAssignmentModal] = useState<boolean>(false);
  const [assignmentDefaultVideoId, setAssignmentDefaultVideoId] = useState<string | undefined>();
  const [showAddUserModal, setShowAddUserModal] = useState<boolean>(false);
  const [newUserRole, setNewUserRole] = useState<Exclude<UserRole, 'admin'>>('evaluator');
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [showCreateInviteModal, setShowCreateInviteModal] = useState<boolean>(false);
  const [createInviteDefaultType, setCreateInviteDefaultType] = useState<InviteType>('candidate');

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 3500);
  };

  const fetchInvitePage = useCallback(async (
    page: number,
    type: string,
    status: string,
    search: string,
  ) => {
    setIsLoadingInvites(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(invitePageSize),
        type,
        status,
        search,
      });
      const response = await fetch(`/api/invites?${params.toString()}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load access links.');
      setInviteLinks(Array.isArray(result.items) ? result.items : []);
      setInvitePage(Number(result.page) || page);
      setInviteTotal(Number(result.total) || 0);
    } catch (error) {
      console.error('Could not load invite page', error);
    } finally {
      setIsLoadingInvites(false);
    }
  }, [invitePageSize]);

  // Direct Token Access (Zero Login Required for Candidate & Evaluator)
  const applyInviteDirectAccess = (invite: InviteLink, assignedVideo?: CandidateVideo | null) => {
    setActiveInvite(invite);
    setIsAuthenticated(true);

    if (invite.type === 'candidate') {
      setSelectedVideoForEval(null);
      const candidateUser: User = {
        id: `usr-cand-${invite.id}`,
        name: invite.recipientName,
        email: invite.recipientEmail || 'candidate@invited.email',
        role: 'candidate',
        department: invite.department || 'General',
        avatar: GENERIC_AVATAR,
        title: invite.roleApplied ? `Candidate for ${invite.roleApplied}` : 'Applicant / Candidate',
        status: 'active',
        lastActive: 'Active via Link',
        assignedCount: 0,
        completedCount: 0,
      };
      setCurrentUser(candidateUser);
      setUserRole('candidate');
      setCurrentTab('candidate_hub');
      showToast(`Welcome, ${invite.recipientName}! Video upload portal opened (No login needed)`);
    } else {
      const evaluatorUser: User = {
        id: `usr-eval-${invite.id}`,
        name: invite.recipientName,
        email: invite.recipientEmail || 'evaluator@company.com',
        role: 'evaluator',
        department: invite.department || 'General',
        avatar: GENERIC_AVATAR,
        title: 'Designated Video Evaluator',
        status: 'active',
        lastActive: 'Active via Link',
        assignedCount: 4,
        completedCount: 2,
      };
      setCurrentUser(evaluatorUser);
      setUserRole('evaluator');
      setCurrentTab('dashboard');

      if (invite.assignedVideoId) {
        const assignedVid = assignedVideo || videos.find((v) => v.id === invite.assignedVideoId);
        if (assignedVid) {
          setSelectedVideoForEval(assignedVid);
        }
      }
      showToast(`Welcome, ${invite.recipientName}! Manager / Employer review queue opened (No login needed)`);
    }
  };

  const handleLogout = () => {
    window.localStorage.removeItem('p2p_admin_session');
    if (adminSessionToken) {
      void fetch('/api/auth/admin/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken: adminSessionToken }),
      });
    }
    setAdminSessionToken('');
    setIsAuthenticated(false);
    setActiveInvite(null);
    setSelectedVideoForEval(null);
    setCurrentTab('overview');
    showToast('Signed out successfully');
  };

  // Fetch data on load & auto-authenticate via invite link token if provided
  const fetchAllData = useCallback(async () => {
    setIsDashboardLoading(true);
    setDashboardError(null);
    const fetchResource = async <T,>(url: string): Promise<T | null> => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`${url} returned ${response.status}`);
        return await response.json();
      } catch (error) {
        console.error(`Could not load ${url}`, error);
        return null;
      }
    };

    try {
      const [statsRes, videosRes, usersRes, setRes, invRes] = await Promise.all([
        fetchResource<{
          stats?: DashboardStats;
          evaluatorStats?: EvaluatorStats;
          candidatePendingCount?: number;
          employerPendingCount?: number;
        }>('/api/stats'),
        fetchResource<CandidateVideo[] | { items?: CandidateVideo[] }>('/api/videos'),
        fetchResource<User[] | { items?: User[] }>('/api/users'),
        fetchResource<SystemSettings>('/api/settings'),
        fetchResource<InviteLink[] | { items?: InviteLink[]; page?: number; total?: number }>(
          `/api/invites?page=1&limit=${invitePageSize}`,
        ),
      ]);

      const normalizedVideos = Array.isArray(videosRes) ? videosRes : videosRes?.items || [];
      const normalizedUsers = Array.isArray(usersRes) ? usersRes : usersRes?.items || [];
      const normalizedInvites = Array.isArray(invRes) ? invRes : invRes?.items || [];

      if (statsRes?.stats) setStats(statsRes.stats);
      if (statsRes?.evaluatorStats) setEvaluatorStats(statsRes.evaluatorStats);
      if (statsRes) {
        setSidebarCounts({
          candidatePending: Number(statsRes.candidatePendingCount) || 0,
          employerPending: Number(statsRes.employerPendingCount) || 0,
        });
      }
      if (videosRes) setVideos(normalizedVideos);
      if (usersRes) setUsers(normalizedUsers);
      if (setRes) setSettings(setRes);
      if (invRes) setInviteLinks(normalizedInvites);
      if (invRes && !Array.isArray(invRes)) {
        setInvitePage(Number(invRes.page) || 1);
        setInviteTotal(Number(invRes.total) || 0);
      }
      if (!statsRes || !videosRes) {
        setDashboardError('Some dashboard data could not be loaded. Check the server connection and try again.');
      }
      return normalizedInvites;
    } finally {
      setIsDashboardLoading(false);
    }
  }, [invitePageSize]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    const portalParam = params.get('portal');
    if (!tokenParam) {
      const savedSessionToken = window.localStorage.getItem('p2p_admin_session');
      if (savedSessionToken) {
        void fetch('/api/auth/admin/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionToken: savedSessionToken }),
        })
          .then(async (response) => {
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Admin session expired.');
            setAdminSessionToken(savedSessionToken);
            setCurrentUser({
              ...emptyAdminUser,
              id: result.user?.id || emptyAdminUser.id,
              name: result.user?.name || emptyAdminUser.name,
              email: result.user?.email || emptyAdminUser.email,
            });
            setUserRole('admin');
            setCurrentTab('overview');
            setIsAuthenticated(true);
          })
          .catch((error) => {
            console.info('Saved admin session could not be restored.', error);
            window.localStorage.removeItem('p2p_admin_session');
          })
          .finally(() => setIsRestoringAdminSession(false));
      } else {
        setIsRestoringAdminSession(false);
      }
    } else {
      setIsRestoringAdminSession(false);
    }
    if (!tokenParam) {
      void fetchAllData();
      if (portalParam === 'candidate') {
        setUserRole('candidate');
        setCurrentTab('candidate_hub');
      } else if (portalParam === 'evaluator') {
        setUserRole('evaluator');
        setCurrentTab('dashboard');
      }
      return;
    }

    fetch(`/api/invites/validate/${encodeURIComponent(tokenParam)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data?.valid || !data?.invite) throw new Error(data?.error || 'This share link is invalid or expired.');
        return data;
      })
      .then((data) => {
        const video = data.video as CandidateVideo | null;
        const submissionVideos = Array.isArray(data.videos) ? data.videos as CandidateVideo[] : video ? [video] : [];
        setVideos(submissionVideos);
        setCandidateUploadLinks(Array.isArray(data.uploadLinks) ? data.uploadLinks : [data.invite]);
        applyInviteDirectAccess(data.invite, video);
      })
      .catch((error: Error) => {
        const local = initialInviteLinks.find((invite) => invite.token.toUpperCase() === tokenParam.toUpperCase());
        if (local) {
          if (local.type === 'evaluator') setVideos(initialVideos);
          applyInviteDirectAccess(local);
        } else {
          showToast(error.message || 'Invalid share link.');
        }
      });
  }, [fetchAllData]);

  useEffect(() => {
    if (isAuthenticated && userRole === 'admin' && (currentTab === 'overview' || currentTab === 'assignments')) {
      void fetchAllData();
    }
  }, [currentTab, fetchAllData, isAuthenticated, userRole]);

  useEffect(() => {
    try {
      window.localStorage.setItem('p2p_admin_notifications_v1', JSON.stringify(adminNotifications.slice(0, 50)));
    } catch (error) {
      console.warn('Could not persist admin notifications in browser storage.', error);
    }
  }, [adminNotifications]);

  useEffect(() => {
    if (!isAuthenticated || userRole !== 'admin' || !adminSessionToken) return;

    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    let disposed = false;
    const connect = () => {
      if (disposed) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(`${protocol}//${window.location.host}/api/admin/notifications`);
      socket.onopen = () => {
        socket?.send(JSON.stringify({ type: 'authenticate', token: adminSessionToken }));
      };
      socket.onmessage = (event) => {
        if (typeof event.data !== 'string') return;
        try {
          const payload = JSON.parse(event.data);
          if (payload.type !== 'notification' || !payload.notification) return;
          const notification = payload.notification as Omit<AdminNotification, 'isRead'>;
          if (
            typeof notification.id !== 'string'
            || typeof notification.submissionId !== 'string'
            || typeof notification.title !== 'string'
            || typeof notification.description !== 'string'
            || typeof notification.timestamp !== 'string'
            || typeof notification.icon !== 'string'
          ) return;
          setAdminNotifications((current) => [
            { ...notification, isRead: current.find((item) => item.id === notification.id)?.isRead ?? false },
            ...current.filter((item) => item.id !== notification.id),
          ].slice(0, 50));
          setAssignmentRefreshKey((current) => current + 1);
          void fetchAllData();
        } catch (error) {
          console.warn('Received an invalid admin notification message.', error);
        }
      };
      socket.onclose = () => {
        if (!disposed) reconnectTimer = window.setTimeout(connect, 1500);
      };
      socket.onerror = () => socket?.close();
    };

    connect();
    return () => {
      disposed = true;
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [adminSessionToken, fetchAllData, isAuthenticated, userRole]);

  // Admin Link Generation & Revocation handlers
  const handleCreateInvite = async (inviteData: {
    type: 'candidate' | 'evaluator';
    recipientName: string;
    recipientEmail: string;
    roleApplied?: string;
    department?: string;
    assignedVideoId?: string;
    expiresAt: string;
    notes?: string;
  }): Promise<InviteLink> => {
    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...inviteData, createdBy: currentUser.name }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Could not create the share link.');
      const created: InviteLink = result;
      if (created.type === 'evaluator') {
        await fetchAllData();
        setAssignmentRefreshKey((current) => current + 1);
      } else {
        setInviteLinks((prev) => [created, ...prev]);
        setInviteTotal((total) => total + 1);
      }
      showToast(created.emailNotice
        ? `Link created. Email not sent: ${created.emailNotice}`
        : created.emailSent ? `Link created and emailed to ${created.recipientEmail}.` : `Created link for ${created.recipientName}`);
      return created;
    } catch (e) {
      console.error('Could not create and email the share link.', e);
      if (e instanceof TypeError) {
        throw new Error('The server is unavailable, so the link could not be created or emailed.');
      }
      throw e;
    }
  };

  const handleRevokeInvite = async (id: string) => {
    try {
      const response = await fetch(`/api/invites/${id}/revoke`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not revoke this link.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not revoke this link.');
      return;
    }
    setInviteLinks((prev) => prev.map((l) => (l.id === id ? { ...l, status: 'revoked' } : l)));
    showToast('Link revoked successfully');
  };

  const handleExtendInviteExpiry = async (id: string, expiresAt: string) => {
    const response = await fetch(`/api/invites/${encodeURIComponent(id)}/extend-expiry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresAt: new Date(expiresAt).toISOString() }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not extend this link.');
    setInviteLinks((previous) => previous.map((link) => link.id === id
      ? {
          ...link,
          status: 'active',
          expiresAt: result.expiresAt,
          ...(typeof result.shareToken === 'string' && result.shareToken ? { token: result.shareToken } : {}),
        }
      : link));
    showToast(result.emailNotice
      ? `Link expiry extended. Email not sent: ${result.emailNotice}`
      : result.emailSent ? 'Link expiry extended and recipient notified.' : 'Link expiry extended.');
  };

  // 1-Click Test Link: Directly opens Candidate Upload or Evaluator Review (No login needed!)
  const handleTestLink = (invite: InviteLink) => {
    applyInviteDirectAccess(invite);
  };

  // Switch role handler (Top header switcher)
  const handleSwitchRole = (role: UserRole) => {
    setUserRole(role);
    if (role === 'admin') {
      const adminUser = users.find((u) => u.role === 'admin') || initialUsers[2];
      setCurrentUser(adminUser);
      setCurrentTab('overview');
      showToast('Switched to Administrator Mode');
    } else if (role === 'evaluator') {
      const evaluatorUser = users.find((u) => u.role === 'evaluator') || initialUsers[0];
      setCurrentUser(evaluatorUser);
      setCurrentTab('dashboard');
      showToast('Switched to Evaluator Mode');
    } else {
      const candidateUser = users.find((u) => u.role === 'candidate') || initialUsers[4];
      setCurrentUser(candidateUser);
      setCurrentTab('candidate_hub');
      showToast('Switched to Candidate Mode');
    }
  };

  // Candidate uploads new self-introduction video
  const handleUploadNewVideos = (newVideos: CandidateVideo[], emailNotice = '') => {
    const existingIds = new Set(videos.map((video) => video.id));
    const newlyCreatedCount = newVideos.filter((video) => !existingIds.has(video.id)).length;
    setVideos((previous) => {
      const updatedById = new Map(newVideos.map((video) => [video.id, video]));
      return [...newVideos, ...previous.filter((video) => !updatedById.has(video.id))];
    });
    if (activeInvite?.type === 'candidate') {
      setCurrentUser((current) => ({ ...current, name: newVideos[0].candidateName, email: newVideos[0].candidateEmail }));
    }

    // Create activity item
    const newActivity: ActivityItem = {
      id: `act-${Date.now()}`,
      type: 'batch_upload',
      title: 'New Video Upload Received',
      actorName: currentUser.name,
      description: `Uploaded ${newVideos.length} video${newVideos.length === 1 ? '' : 's'} for ${newVideos[0].roleApplied} (${newVideos[0].department}).`,
      timestamp: new Date().toISOString(),
      timeAgo: 'Just now',
      badge: 'Video Ingestion',
      badgeType: 'info',
      icon: 'videocam',
    };
    setActivities((prev) => [newActivity, ...prev]);

    setStats((prev) => ({
      ...prev,
      videosUploaded: prev.videosUploaded + newlyCreatedCount,
      pendingAssignments: prev.pendingAssignments + newlyCreatedCount,
    }));

    showToast(emailNotice
      ? `Upload received, but notification email failed: ${emailNotice}`
      : 'Upload received and confirmation email sent.');
  };

  // Evaluation submission
  const handleSubmitEvaluation = async (evaluationData: {
    videoId: string;
    scores: Record<string, number>;
    rubricWeights: SystemSettings['rubricWeights'];
    decision: 'selected' | 'rejected';
    notes: string;
    aiSummary?: string;
    keyStrengths?: string[];
    areasToImprove?: string[];
  }) => {
    let notificationEmailNotice = '';
    try {
      const reviewUrl = activeInvite?.type === 'evaluator'
        ? `/api/public/links/${encodeURIComponent(activeInvite.token)}/review`
        : '/api/evaluate';
      const res = await fetch(reviewUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...evaluationData,
          evaluatorId: currentUser.id,
          evaluatorName: currentUser.name,
        }),
      });

      if (!res.ok && activeInvite?.type === 'evaluator') {
        const result = await res.json();
        throw new Error(result.error || 'Could not submit this review.');
      }

      if (res.ok) {
        const result = await res.json();
        notificationEmailNotice = typeof result.emailNotice === 'string' ? result.emailNotice : '';
        if (result.video) {
          setVideos((prev) => prev.map((v) => (v.id === result.video.id ? result.video : v)));
        }
      } else {
        // Local fallback update
        const overallScore = Math.round(
          settings.rubricWeights.reduce(
            (total, criterion) => total + (evaluationData.scores[criterion.id] || 1) * criterion.weight,
            0,
          ) / 5,
        );

        setVideos((prev) =>
          prev.map((v) =>
            v.id === evaluationData.videoId
              ? {
                  ...v,
                  status: 'completed',
                  evaluation: {
                    evaluatorId: currentUser.id,
                    evaluatorName: currentUser.name,
                    evaluatorTitle: currentUser.title || 'Senior Evaluator',
                    evaluatorAvatar: currentUser.avatar,
                    evaluatedAt: new Date().toISOString(),
                    scores: evaluationData.scores,
                    rubricWeights: evaluationData.rubricWeights,
                    overallScore,
                    decision: evaluationData.decision,
                    notes: evaluationData.notes,
                    aiSummary: evaluationData.aiSummary,
                    keyStrengths: evaluationData.keyStrengths,
                    areasToImprove: evaluationData.areasToImprove,
                  },
                }
              : v
          )
        );
      }

      setEvaluatorStats((prev) => ({
        ...prev,
        pendingReview: Math.max(0, prev.pendingReview - 1),
        completed: prev.completed + 1,
      }));

      setStats((prev) => ({
        ...prev,
        pendingAssignments: Math.max(0, prev.pendingAssignments - 1),
        completedEvals: prev.completedEvals + 1,
      }));

      showToast(notificationEmailNotice
        ? `Evaluation recorded, but admin email failed: ${notificationEmailNotice}`
        : `Evaluation recorded for candidate! Status: ${evaluationData.decision.toUpperCase()}`);
    } catch (e) {
      console.error('Evaluation submit error', e);
      showToast(e instanceof Error ? e.message : 'Could not submit this evaluation.');
      throw e;
    }
  };

  // Batch Video Upload
  const handleBatchSubmit = async (batchData: {
    batchName: string;
    roleApplied: string;
    department: string;
    assignedEvaluatorId: string;
    candidates: { name: string; email: string }[];
  }) => {
    try {
      const res = await fetch('/api/videos/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchData),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.addedVideos) {
          setVideos((prev) => [...result.addedVideos, ...prev]);
        }
      } else {
        // Local fallback
        const newVids: CandidateVideo[] = batchData.candidates.map((c, i) => ({
          id: `vid-batch-${Date.now()}-${i}`,
          candidateName: c.name,
          candidateEmail: c.email,
          roleApplied: batchData.roleApplied,
          department: batchData.department,
          submittedAt: new Date().toISOString(),
          submittedTimeAgo: 'Just now',
          status: 'pending',
          videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
          thumbnailUrl: GENERIC_VIDEO_THUMBNAIL,
          durationSeconds: 300,
          videoDuration: '05:00',
          batchName: batchData.batchName,
          assignedEvaluatorId: batchData.assignedEvaluatorId,
          assignedEvaluatorName:
            users.find((u) => u.id === batchData.assignedEvaluatorId)?.name || 'Sarah Jenkins',
        }));
        setVideos((prev) => [...newVids, ...prev]);
      }

      setStats((prev) => ({
        ...prev,
        videosUploaded: prev.videosUploaded + batchData.candidates.length,
        pendingAssignments: prev.pendingAssignments + batchData.candidates.length,
      }));

      showToast(`Batch "${batchData.batchName}" (${batchData.candidates.length} candidates) ingested successfully!`);
    } catch (e) {
      console.error('Batch upload error', e);
      showToast('Batch created in workspace.');
    }
  };

  // Add User
  const handleAddUser = async (newUserData: {
    name: string;
    email: string;
    role: UserRole;
    department: string;
    title: string;
    phone?: string;
  }) => {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUserData),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.user) {
          setUsers((prev) => [result.user, ...prev]);
        }
      } else {
        const newUser: User = {
          id: `usr-${Date.now()}`,
          name: newUserData.name,
          email: newUserData.email,
          role: newUserData.role,
          department: newUserData.department,
          title: newUserData.title,
          phone: newUserData.phone,
          status: 'active',
          avatar: GENERIC_AVATAR,
          lastActive: 'Just now',
          assignedCount: 0,
          completedCount: 0,
        };
        setUsers((prev) => [newUser, ...prev]);
      }

      setStats((prev) => ({ ...prev, totalUsers: prev.totalUsers + 1 }));
      showToast(`User ${newUserData.name} registered as ${newUserData.role}`);
    } catch (e) {
      console.error('Add user error', e);
      showToast('User created locally.');
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!window.confirm(`Delete ${user.role} account for ${user.name}? Candidate submissions are retained.`)) return;
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(user.id)}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not delete this account.');
      setUsers((previous) => previous.filter((item) => item.id !== user.id));
      setStats((previous) => ({ ...previous, totalUsers: Math.max(0, previous.totalUsers - 1) }));
      showToast(`${user.name}'s account was deleted.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not delete this account.');
    }
  };

  // Dispatch Assignment
  const handleDispatchAssignment = async (assignment: {
    videoId: string;
    evaluatorId: string;
    priority: 'normal' | 'urgent';
    slaHours: number;
  }) => {
    let videoToAssign = videos.find((video) => video.id === assignment.videoId);
    if (!videoToAssign) {
      const response = await fetch(`/api/videos/${encodeURIComponent(assignment.videoId)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load the selected submission.');
      videoToAssign = result as CandidateVideo;
    }
    const evaluator = users.find((u) => u.id === assignment.evaluatorId);
    if (!evaluator || evaluator.role !== 'evaluator') {
      throw new Error('Choose an evaluator account to receive the assignment.');
    }
    const expiresAt = new Date(Date.now() + assignment.slaHours * 60 * 60 * 1000).toISOString();
    await handleCreateInvite({
      type: 'evaluator',
      recipientName: evaluator.name,
      recipientEmail: evaluator.email,
      roleApplied: videoToAssign.roleApplied,
      department: videoToAssign.department,
      assignedVideoId: assignment.videoId,
      expiresAt,
      notes: `${assignment.priority === 'urgent' ? 'Urgent priority' : 'Standard priority'}; SLA ${assignment.slaHours} hours.`,
    });
    showToast(`Submission assigned to ${evaluator?.name || 'Manager / Employer'} (SLA: ${assignment.slaHours}h)`);
    await fetchAllData();
    setAssignmentRefreshKey((current) => current + 1);
  };

  const handleReviewVideo = async (videoId: string, decision: 'accepted' | 'reupload_requested', feedback: string): Promise<CandidateVideo> => {
    const response = await fetch(`/api/videos/${encodeURIComponent(videoId)}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, feedback }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not save this review.');
    const reviewedVideo = result.video as CandidateVideo;
    setVideos((previous) => previous.map((video) => video.id === videoId ? reviewedVideo : video));
    setAssignmentRefreshKey((current) => current + 1);
    setSelectedVideoForEval(reviewedVideo);
    showToast(result.emailNotice
      ? `Review saved. Email not sent: ${result.emailNotice}`
      : result.emailSent
      ? 'Review saved and candidate notified by email.'
      : decision === 'accepted' ? 'Video accepted for Manager / Employer assignment.' : 'Reupload requested.');
    return reviewedVideo;
  };

  // Save System Settings
  const handleSaveSettings = async (newSettings: SystemSettings, smtpPassword: string) => {
    const response = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newSettings, smtpPassword }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not save system settings.');
    setSettings(result as SystemSettings);
    showToast(smtpPassword && !result.smtpPasswordConfigured
      ? 'Settings saved, but this server cannot persist SMTP passwords without database-backed settings.'
      : 'System settings saved.');
  };

  const handleTestEmail = async (emailSettings: SystemSettings, smtpPassword: string, recipient: string) => {
    const response = await fetch('/api/settings/email/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...emailSettings, smtpPassword, recipient }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not send test email.');
    showToast(`SMTP test email sent to ${recipient}.`);
  };

  // Fallback Login handler if user explicitly signed out
  const handleLogin = (
    role: UserRole,
    email: string,
    name: string,
    activeInviteItem?: InviteLink,
    sessionToken?: string,
  ) => {
    if (activeInviteItem) {
      applyInviteDirectAccess(activeInviteItem);
      return;
    }
    const existing = role === 'admin'
      ? users.find((user) => user.role === 'admin')
      : users.find((user) => user.email.toLowerCase() === email.toLowerCase());
    const userToSet: User = existing || {
      id: `usr-${Date.now()}`,
      name,
      email,
      role,
      department:
        role === 'admin'
          ? 'Talent Operations'
          : role === 'evaluator'
          ? 'Software Engineering'
          : 'Engineering Applicant',
      avatar: GENERIC_AVATAR,
      title: role === 'admin' ? 'Lead Administrator' : role === 'evaluator' ? 'Video Evaluator' : 'Applicant',
      status: 'active',
      lastActive: 'Just now',
      assignedCount: role === 'evaluator' ? 4 : 0,
      completedCount: role === 'evaluator' ? 2 : 0,
    };
    setCurrentUser(userToSet);
    setUserRole(role);
    setAdminSessionToken(role === 'admin' ? sessionToken || '' : '');
    if (role === 'admin' && sessionToken) {
      window.localStorage.setItem('p2p_admin_session', sessionToken);
    } else {
      window.localStorage.removeItem('p2p_admin_session');
    }
    setIsRestoringAdminSession(false);
    setIsAuthenticated(true);
    setCurrentTab(role === 'admin' ? 'overview' : role === 'evaluator' ? 'dashboard' : 'candidate_hub');
    showToast(`Signed in as ${name}`);
  };

  const handleOpenAdminNotification = (notification: AdminNotification) => {
    setAdminNotifications((current) => current.map((item) => (
      item.id === notification.id ? { ...item, isRead: true } : item
    )));
    setFocusedSubmissionId(notification.submissionId);
    setCurrentTab('assignments');
  };

  const handleMarkAllAdminNotificationsRead = () => {
    setAdminNotifications((current) => current.map((notification) => ({ ...notification, isRead: true })));
  };

  // If explicitly logged out, render AuthScreen
  if (isRestoringAdminSession) {
    return (
      <div className="min-h-screen bg-[#FAF4F4] flex items-center justify-center text-sm font-medium text-red-900">
        Restoring your admin session...
      </div>
    );
  }
  if (!isAuthenticated) {
    return (
      <AuthScreen
        onLogin={handleLogin}
        initialPortal="admin"
        inviteLinks={inviteLinks}
      />
    );
  }

  const evaluators = users.filter((u) => u.role === 'evaluator');
  const selectedSubmissionVideos = selectedVideoForEval && (userRole === 'evaluator' || userRole === 'admin')
    ? videos.filter((video) => getSubmissionId(video) === getSubmissionId(selectedVideoForEval))
    : [];
  return (
    <div className="min-h-screen bg-[#FAF4F4] text-[#1F1617] flex selection:bg-red-600 selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1F1617] text-white px-4 py-2.5 rounded-xl shadow-xl border border-red-900/50 flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <span className="material-symbols-outlined text-red-400 text-base">check_circle</span>
          <span className="text-xs font-medium">{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-red-200 hover:text-white ml-2 text-xs cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Desktop Sidebar */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          setCurrentTab(tab);
          setMobileMenuOpen(false);
        }}
        userRole={userRole}
        currentUserName={currentUser.name}
        candidatePendingCount={sidebarCounts.candidatePending}
        employerPendingCount={sidebarCounts.employerPending}
        onOpenSettings={() => {
          setCurrentTab('settings');
          setMobileMenuOpen(false);
        }}
      />

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs md:hidden flex" onClick={() => setMobileMenuOpen(false)}>
          <div
            className="w-72 bg-white text-[#1F1617] h-full p-4 flex flex-col border-r border-[#F5DADB] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-4 border-b border-[#F5DADB] mb-4">
              <div className="flex items-center gap-2.5">
                <img src={p2pLogo} alt="" className="w-8 h-8 object-contain" />
                <span className="font-bold text-[#1F1617] text-sm tracking-tight">Interview<span className="text-red-600">Pro</span></span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="text-[#6B7280] hover:text-red-700 cursor-pointer">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="space-y-1">
              {userRole === 'candidate' ? (
                <>
                  <button
                    onClick={() => {
                      setCurrentTab('candidate_hub');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center gap-2.5 transition-colors cursor-pointer ${
                      currentTab === 'candidate_hub' ? 'bg-red-50 text-red-700 font-bold border border-red-100' : 'text-[#6B7280] hover:text-[#1F1617] hover:bg-red-50/50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">video_library</span> My Submissions
                  </button>
                  <button
                    onClick={() => {
                      setCurrentTab('guidelines');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center gap-2.5 transition-colors cursor-pointer ${
                      currentTab === 'guidelines' ? 'bg-red-50 text-red-700 font-bold border border-red-100' : 'text-[#6B7280] hover:text-[#1F1617] hover:bg-red-50/50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">help_outline</span> Prep &amp; Guidelines
                  </button>
                </>
              ) : userRole === 'admin' ? (
                <>
                  <button
                    onClick={() => {
                      setCurrentTab('overview');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center gap-2.5 transition-colors cursor-pointer ${
                      currentTab === 'overview' ? 'bg-red-50 text-red-700 font-bold border border-red-100' : 'text-[#6B7280] hover:text-[#1F1617] hover:bg-red-50/50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">dashboard</span> Overview
                  </button>
                  <button
                    onClick={() => {
                      setCurrentTab('links');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center gap-2.5 transition-colors cursor-pointer ${
                      currentTab === 'links' ? 'bg-red-50 text-red-700 font-bold border border-red-100' : 'text-[#6B7280] hover:text-[#1F1617] hover:bg-red-50/50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">link</span> Shareable Links
                  </button>
                  <button
                    onClick={() => {
                      setCurrentTab('users');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center gap-2.5 transition-colors cursor-pointer ${
                      currentTab === 'users' ? 'bg-red-50 text-red-700 font-bold border border-red-100' : 'text-[#6B7280] hover:text-[#1F1617] hover:bg-red-50/50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">group</span> User &amp; Roles
                  </button>
                  <button
                    onClick={() => {
                      setCurrentTab('videos');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center gap-2.5 transition-colors cursor-pointer ${
                      currentTab === 'videos' ? 'bg-red-50 text-red-700 font-bold border border-red-100' : 'text-[#6B7280] hover:text-[#1F1617] hover:bg-red-50/50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">video_library</span> Submissions
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setCurrentTab('dashboard');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center gap-2.5 transition-colors cursor-pointer ${
                      currentTab === 'dashboard' ? 'bg-red-50 text-red-700 font-bold border border-red-100' : 'text-[#6B7280] hover:text-[#1F1617] hover:bg-red-50/50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">dashboard</span> Dashboard
                  </button>
                </>
              )}
              {userRole === 'admin' && (
                <button
                  onClick={() => {
                    setCurrentTab('settings');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center gap-2.5 transition-colors cursor-pointer ${
                    currentTab === 'settings' ? 'bg-red-50 text-red-700 font-bold border border-red-100' : 'text-[#6B7280] hover:text-[#1F1617] hover:bg-red-50/50'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">settings</span> Settings
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:ml-64 min-w-0">
        {/* Zero-Login Link Session Banner (Active when in Candidate or Evaluator mode or via link) */}
        {activeInvite && (
          <div className="bg-[#1F1617] text-white px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-3 border-b border-red-900/40 shadow-xs animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-red-500">vpn_key</span>
              <span>
                <strong>Verified Direct Link Session:</strong> {currentUser.name} (
                {userRole === 'candidate' ? 'User / Video Upload Portal' : 'Evaluator Assessment Portal'})
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/30">
                No Login Required
              </span>
              <span className="text-red-200/80 font-mono text-[10px] hidden sm:inline">
                Token: {activeInvite.token}
              </span>
            </div>
          </div>
        )}

        {/* Top Header */}
        <TopHeader
          userRole={userRole}
          currentTab={currentTab}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          adminNotifications={adminNotifications}
          onOpenAdminNotification={handleOpenAdminNotification}
          onMarkAllAdminNotificationsRead={handleMarkAllAdminNotificationsRead}
          onSwitchRole={handleSwitchRole}
          onLogout={handleLogout}
          onOpenSettings={() => setCurrentTab('settings')}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenHelpModal={() => setShowHelpModal(true)}
          currentUserName={currentUser.name}
        />

        {/* Body View Content */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          {/* Shareable Links View (Admin Access Hub) */}
          {currentTab === 'links' && userRole === 'admin' ? (
            <InviteLinksView
              inviteLinks={inviteLinks}
              videos={videos}
              page={invitePage}
              pageSize={invitePageSize}
              total={inviteTotal}
              isLoading={isLoadingInvites}
              onQueryChange={fetchInvitePage}
              onReviewVideo={(video) => setSelectedVideoForEval(video)}
              onOpenCreateLink={() => {
                setCreateInviteDefaultType('candidate');
                setShowCreateInviteModal(true);
              }}
              onRevokeLink={handleRevokeInvite}
              onExtendExpiry={handleExtendInviteExpiry}
            />
          ) : userRole === 'candidate' && currentTab === 'guidelines' ? (
            <CandidatePrepGuidelinesView />
          ) : userRole === 'candidate' || currentTab === 'candidate_hub' || currentTab === 'candidate_portal' ? (
            <CandidatePortalView
              currentUser={currentUser}
              videos={videos}
              uploadLinks={candidateUploadLinks.length > 0
                ? candidateUploadLinks
                : activeInvite?.type === 'candidate' ? [activeInvite] : []}
              onUploadNewVideos={handleUploadNewVideos}
              canCreateSubmission={activeInvite?.status === 'active' && new Date(activeInvite.expiresAt) > new Date()}
              linkToken={activeInvite?.type === 'candidate' ? activeInvite.token : undefined}
            />
          ) : userRole === 'admin' && currentTab === 'overview' ? (
            <AdminOverview
              stats={stats}
              videos={videos}
              inviteLinks={inviteLinks}
              onOpenCreateLink={(type) => {
                if (type) setCreateInviteDefaultType(type);
                setShowCreateInviteModal(true);
              }}
              onOpenLinksView={() => setCurrentTab('links')}
              onGenerateReport={() => setShowReportModal(true)}
              onViewAllVideos={() => setCurrentTab('videos')}
              onSelectCandidateVideo={(video) => setSelectedVideoForEval(video)}
              isLoading={isDashboardLoading}
              loadError={dashboardError}
              onRefresh={() => void fetchAllData()}
            />
          ) : userRole === 'admin' && currentTab === 'assignments' ? (
            <AdminAssignmentsView
              videos={videos}
              focusSubmissionId={focusedSubmissionId}
              refreshKey={assignmentRefreshKey}
              onOpenAssignment={(videoId) => {
                setAssignmentDefaultVideoId(videoId);
                setShowNewAssignmentModal(true);
              }}
              onSelectCandidateVideo={(video) => setSelectedVideoForEval(video)}
            />
          ) : (userRole === 'evaluator' && currentTab === 'dashboard') ||
            currentTab === 'evaluations' ||
            currentTab === 'assignments' ? (
            <EvaluatorDashboard
              stats={evaluatorStats}
              videos={videos}
              onSelectCandidateVideo={(video) => setSelectedVideoForEval(video)}
              onSyncAssignments={fetchAllData}
            />
          ) : currentTab === 'videos' ? (
            <AllVideosView
              videos={videos}
              onSelectCandidateVideo={(video) => setSelectedVideoForEval(video)}
              onOpenUploadBatch={() => setShowBatchUploadModal(true)}
              searchQuery={searchQuery}
            />
          ) : userRole === 'admin' && currentTab === 'users' ? (
            <AdminAccountView
              name={currentUser.name}
              email={currentUser.email}
              users={users}
              searchQuery={searchQuery}
              onAddUser={(role) => {
                setNewUserRole(role);
                setShowAddUserModal(true);
              }}
              onDeleteUser={handleDeleteUser}
              onCleanupComplete={fetchAllData}
            />
          ) : userRole === 'evaluator' && currentTab === 'users' ? (
            <UsersManagementView
              users={users}
              onOpenAddUser={() => setShowAddUserModal(true)}
              onDeleteUser={handleDeleteUser}
              searchQuery={searchQuery}
            />
          ) : currentTab === 'settings' ? (
            <SystemSettingsView settings={settings} onSaveSettings={handleSaveSettings} onTestEmail={handleTestEmail} />
          ) : (
            <EvaluatorDashboard
              stats={evaluatorStats}
              videos={videos}
              onSelectCandidateVideo={(video) => setSelectedVideoForEval(video)}
              onSyncAssignments={fetchAllData}
            />
          )}
        </main>
      </div>

      {/* Candidate Video Player & Evaluation Rubric Modal */}
      {selectedVideoForEval && (
        <VideoPlayerEvaluationModal
          video={selectedVideoForEval}
          rubricWeights={activeInvite?.type === 'evaluator' && activeInvite.rubricWeights?.length
            ? activeInvite.rubricWeights
            : settings.rubricWeights}
          submissionVideos={selectedSubmissionVideos}
          onSelectSubmissionVideo={setSelectedVideoForEval}
          onClose={() => setSelectedVideoForEval(null)}
          readOnly={userRole !== 'evaluator'}
          canReviewSubmission={userRole === 'admin'}
          onReviewSubmission={handleReviewVideo}
          onSubmitEvaluation={handleSubmitEvaluation}
        />
      )}

      {/* Create Invite Link Modal */}
      {showCreateInviteModal && (
        <CreateInviteLinkModal
          evaluators={evaluators}
          defaultType={createInviteDefaultType}
          onClose={() => setShowCreateInviteModal(false)}
          onCreateInvite={handleCreateInvite}
          onTestLink={handleTestLink}
        />
      )}

      {/* Batch Upload Modal */}
      {showBatchUploadModal && (
        <BatchUploadModal
          evaluators={evaluators}
          onClose={() => setShowBatchUploadModal(false)}
          onBatchSubmit={handleBatchSubmit}
        />
      )}

      {/* New Assignment Modal */}
      {showNewAssignmentModal && (
        <NewAssignmentModal
          evaluators={evaluators}
          defaultVideoId={assignmentDefaultVideoId}
          onClose={() => {
            setShowNewAssignmentModal(false);
            setAssignmentDefaultVideoId(undefined);
          }}
          onAssignSubmit={handleDispatchAssignment}
        />
      )}

      {/* Add User Modal */}
      {showAddUserModal && (
        <AddUserModal
          initialRole={newUserRole}
          onClose={() => setShowAddUserModal(false)}
          onAddUser={handleAddUser}
        />
      )}

      {/* Report Modal */}
      {showReportModal && (
        <ReportModal stats={stats} videos={videos} onClose={() => setShowReportModal(false)} />
      )}

      {/* Help Modal */}
      {showHelpModal && <HelpGuideModal onClose={() => setShowHelpModal(false)} />}
    </div>
  );
}
