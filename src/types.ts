export type UserRole = 'admin' | 'evaluator' | 'candidate';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  phone?: string;
  status: 'active' | 'inactive' | 'pending';
  assignedCount?: number;
  completedCount?: number;
  lastActive: string;
  department?: string;
  title?: string;
}

export interface InterviewQuestion {
  id: string;
  timestamp: number; // seconds
  timestampStr: string;
  question: string;
  transcriptSnippet: string;
}

export interface CandidateEvaluation {
  evaluatorId: string;
  evaluatorName: string;
  evaluatorTitle?: string;
  evaluatorAvatar?: string;
  evaluatedAt: string;
  overallScore: number;
  scores: Record<string, number>;
  rubricWeights?: RubricWeight[];
  decision: 'selected' | 'rejected' | 'shortlist' | 'hold' | 'reject';
  notes: string;
  aiSummary?: string;
  keyStrengths?: string[];
  areasToImprove?: string[];
}

export interface CandidateDocument {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
  downloadUrl?: string;
  adminReviewStatus?: 'pending' | 'accepted' | 'reupload_requested';
  adminFeedback?: string;
}

export interface CandidateVideo {
  id: string;
  candidateName: string;
  candidateEmail: string;
  roleApplied: string;
  department: string;
  submittedAt: string;
  submittedTimeAgo: string;
  questionPrompt?: string;
  status: 'pending' | 'in_review' | 'completed';
  videoUrl: string;
  thumbnailUrl?: string;
  videoDuration: string;
  durationSeconds: number;
  batchName?: string;
  submissionType?: 'self_introduction' | 'technical_interview' | 'portfolio_walkthrough';
  keySkills?: string[];
  bio?: string;
  assignedEvaluatorId?: string;
  assignedEvaluatorName?: string;
  assignedEvaluatorAvatar?: string;
  submissionBatchId?: string;
  adminConfirmed?: boolean;
  adminReviewedAt?: string;
  adminReviewStatus?: 'pending' | 'accepted' | 'reupload_requested';
  wasReuploaded?: boolean;
  previousAdminFeedback?: string;
  adminFeedback?: string;
  experienceYears?: number;
  resumeUrl?: string;
  documents?: CandidateDocument[];
  questions?: InterviewQuestion[];
  evaluation?: CandidateEvaluation;
  evaluationHistory?: CandidateEvaluation[];
  submissionId?: string;
}

export interface ActivityItem {
  id: string;
  type: 'registration' | 'batch_upload' | 'evaluation' | 'alert' | 'assignment';
  title: string;
  actorName?: string;
  target?: string;
  description: string;
  timestamp: string;
  timeAgo: string;
  badge?: string;
  badgeType?: 'success' | 'warning' | 'info';
  icon: string;
  isAlert?: boolean;
}

export interface AdminNotification {
  id: string;
  type: 'candidate_submission' | 'submission_updated' | 'assignment_updated';
  title: string;
  description: string;
  timestamp: string;
  icon: string;
  submissionId: string;
  isRead: boolean;
}

export interface DashboardStats {
  totalUsers: number;
  totalUsersGrowth: string;
  videosUploaded: number;
  videosGrowth: string;
  pendingAssignments: number;
  completedEvals: number;
  completionRate: string;
  avgCompletionTime: string;
  slaCompliance: number;
  activeEvaluatorsCount: number;
  totalEvaluatorsCount: number;
}

export interface EvaluatorStats {
  totalAssigned: number;
  pendingReview: number;
  completed: number;
}

export interface SystemSettings {
  slaTargetHours: number;
  autoAssignNewVideos: boolean;
  aiEvaluationAssistEnabled: boolean;
  emailNotifications: boolean;
  minEvaluatorsPerCandidate: number;
  scoringWeightCommunication: number;
  scoringWeightTechnical: number;
  scoringWeightProblemSolving: number;
  scoringWeightCultureFit: number;
  rubricWeights: RubricWeight[];
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  smtpFromAddress: string;
  smtpFromName: string;
  smtpPasswordConfigured: boolean;
}

export interface RubricWeight {
  id: string;
  name: string;
  weight: number;
}

export type InviteType = 'candidate' | 'evaluator';

export interface InviteLink {
  id: string;
  token: string;
  type: InviteType;
  title: string;
  recipientName: string;
  recipientEmail: string;
  roleApplied?: string;
  department?: string;
  assignedVideoId?: string;
  assignedCandidateName?: string;
  submissionId?: string;
  rubricWeights?: RubricWeight[];
  status: 'active' | 'used' | 'revoked' | 'expired';
  createdAt: string;
  expiresAt: string;
  expiresInHours: number;
  createdBy: string;
  notes?: string;
  url?: string;
  accessCount?: number;
  emailSent?: boolean;
  emailNotice?: string;
}
