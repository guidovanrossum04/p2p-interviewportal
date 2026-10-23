import { CandidateVideo, User, ActivityItem, DashboardStats, SystemSettings, InviteLink } from '../types';

export const initialStats: DashboardStats = {
  totalUsers: 0,
  totalUsersGrowth: '0%',
  videosUploaded: 0,
  videosGrowth: '0%',
  pendingAssignments: 0,
  completedEvals: 0,
  completionRate: '0% completion rate',
  avgCompletionTime: '0hrs',
  slaCompliance: 0,
  activeEvaluatorsCount: 0,
  totalEvaluatorsCount: 0,
};

export const initialEvaluatorStats = {
  totalAssigned: 0,
  pendingReview: 0,
  completed: 0,
  thisWeekChange: '0 this week',
};

export const initialUsers: User[] = [];

export const initialVideos: CandidateVideo[] = [];

export const initialActivities: ActivityItem[] = [];

export const initialSettings: SystemSettings = {
  slaTargetHours: 24,
  autoAssignNewVideos: true,
  aiEvaluationAssistEnabled: true,
  emailNotifications: true,
  minEvaluatorsPerCandidate: 1,
  scoringWeightCommunication: 25,
  scoringWeightTechnical: 35,
  scoringWeightProblemSolving: 25,
  scoringWeightCultureFit: 15,
  rubricWeights: [
    { id: 'communication', name: 'Communication & Articulation', weight: 25 },
    { id: 'technical', name: 'Technical Depth & Precision', weight: 35 },
    { id: 'problem-solving', name: 'Problem Solving & Reasoning', weight: 25 },
    { id: 'culture-fit', name: 'Culture Fit & Alignment', weight: 15 },
  ],
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpUsername: '',
  smtpFromAddress: '',
  smtpFromName: 'P2P Recruitment',
  smtpPasswordConfigured: false,
};

export const initialInviteLinks: InviteLink[] = [];
