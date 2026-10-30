import { createHash, randomBytes } from 'node:crypto';
import { CandidateVideo, InviteLink } from '../../types';
import { CreateInviteInput, EvaluationInput, PortalRepository, ShareLinkRecord, UploadInput } from '../repositories/PortalRepository';

export class PortalError extends Error {
  constructor(message: string, public readonly statusCode = 400) {
    super(message);
  }
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export class PortalService {
  constructor(private readonly repository: PortalRepository) {}

  async createInvite(input: Omit<CreateInviteInput, 'tokenHash' | 'tokenCiphertext' | 'tokenPreview' | 'expiresAt'> & { expiresAt: string }): Promise<InviteLink> {
    if (!input.recipientName.trim()) throw new PortalError('Recipient name is required.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.recipientEmail.trim())) {
      throw new PortalError('A valid recipient email address is required to send the invitation.');
    }
    if (input.type === 'evaluator' && !input.assignedVideoId) {
      throw new PortalError('Choose an evaluator and a video for the review link.');
    }
    const expiresAt = new Date(input.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) throw new PortalError('Choose a future expiry date and time.');

    const token = randomBytes(32).toString('hex');
    const invite = await this.repository.createInvite({
      ...input,
      tokenHash: hashToken(token),
      tokenCiphertext: this.repository.encryptInviteToken(token),
      tokenPreview: `...${token.slice(-8)}`,
      expiresAt,
    });
    return { ...invite, token };
  }

  async validateInvite(token: string): Promise<{ invite: InviteLink; video: CandidateVideo | null; videos: CandidateVideo[]; record: ShareLinkRecord }> {
    if (!token || token.length > 200) throw new PortalError('Invalid share link.', 404);
    const record = await this.repository.findInvite(hashToken(token));
    if (!record) throw new PortalError('Invalid share link.', 404);
    if (record.status === 'revoked') throw new PortalError('This share link has been revoked.', 403);
    if (record.status === 'used' && record.purpose === 'review') throw new PortalError('This review link has already been submitted.', 410);
    const expired = record.status === 'active' && new Date(record.expires_at) <= new Date();
    if (expired && record.purpose !== 'upload') throw new PortalError('This share link has expired.', 410);
    const submittedVideos = record.purpose === 'upload' && record.status === 'used'
      ? await this.repository.listSubmissionVideos(record.submission_id)
      : [];
    const invite: InviteLink = {
      id: record.id,
      submissionId: record.submission_id,
      token,
      type: record.purpose === 'upload' ? 'candidate' : 'evaluator',
      title: record.purpose === 'upload' ? 'Candidate video upload link' : 'Evaluator video review link',
      recipientName: record.recipient_name,
      recipientEmail: record.recipient_email,
      roleApplied: record.role_applied,
      department: record.department,
      assignedVideoId: record.video_id || undefined,
      assignedCandidateName: record.candidate_name || undefined,
      status: expired ? 'expired' : record.status,
      createdAt: new Date(record.created_at).toISOString(),
      expiresAt: new Date(record.expires_at).toISOString(),
      expiresInHours: Math.max(0, Math.ceil((new Date(record.expires_at).getTime() - new Date(record.created_at).getTime()) / 3600000)),
      createdBy: record.created_by,
      notes: record.notes,
      accessCount: record.access_count,
      ...(record.purpose === 'upload'
        ? {
            answerMode: record.answer_mode === 'record' ? 'record' : 'upload',
            videoCount: Number.isFinite(Number(record.video_count)) ? Math.max(1, Number(record.video_count)) : 1,
            questionPrompt: (() => {
              const questionPrompts = typeof record.question_prompt === 'string' && record.question_prompt.trim()
                ? (() => {
                    try {
                      const parsed = JSON.parse(record.question_prompt);
                      return Array.isArray(parsed) ? parsed.filter((prompt): prompt is string => typeof prompt === 'string' && Boolean(prompt.trim())) : [record.question_prompt.trim()];
                    } catch {
                      return [record.question_prompt.trim()];
                    }
                  })()
                : [];
              return questionPrompts[0];
            })(),
            questionPrompts: (() => {
              const questionPrompts = typeof record.question_prompt === 'string' && record.question_prompt.trim()
                ? (() => {
                    try {
                      const parsed = JSON.parse(record.question_prompt);
                      return Array.isArray(parsed) ? parsed.filter((prompt): prompt is string => typeof prompt === 'string' && Boolean(prompt.trim())) : [record.question_prompt.trim()];
                    } catch {
                      return [record.question_prompt.trim()];
                    }
                  })()
                : [];
              return questionPrompts.length ? questionPrompts : undefined;
            })(),
          }
        : {}),
      ...(record.purpose === 'review'
        ? {
            rubricWeights: Array.isArray(record.rubric_weights) && record.rubric_weights.length
              ? record.rubric_weights
              : (await this.repository.getSystemSettings()).rubricWeights,
          }
        : {}),
    };
    const assignedVideo = await this.repository.getAssignedVideo(record);
    const assignedVideos = record.purpose === 'review'
      ? await this.repository.getAssignedVideos(record)
      : submittedVideos;
    if (record.purpose === 'review') {
      assignedVideos.forEach((video) => {
        video.videoUrl = `/api/public/links/${encodeURIComponent(token)}/video?videoId=${encodeURIComponent(video.id)}`;
        video.documents = (video.documents || []).map((document) => {
          const documentUrl = `/api/public/links/${encodeURIComponent(token)}/documents/${encodeURIComponent(video.id)}/${encodeURIComponent(document.id)}`;
          return {
            ...document,
            url: documentUrl,
            downloadUrl: `${documentUrl}?download=1`,
          };
        });
      });
    }
    const redactAdminData = (video: CandidateVideo): CandidateVideo => ({
      ...video,
      evaluation: undefined,
      evaluationHistory: [],
      assignedEvaluatorId: undefined,
      assignedEvaluatorName: undefined,
    });
    const video = assignedVideo ? redactAdminData(assignedVideo) : null;
    const videos = assignedVideos.map(redactAdminData);
    return { invite, video, videos, record };
  }

  async uploadCandidate(token: string, input: UploadInput): Promise<CandidateVideo[]> {
    if (!input.candidateName.trim() || !input.candidateEmail.trim() || input.videos.length < 1 || input.videos.length > 6
      || input.videos.some((video) => !video.questionPrompt?.trim())) {
      throw new PortalError('Candidate name, email, and a valid video response for each requested question are required.');
    }
    if (input.documents.length > 20) throw new PortalError('Upload no more than 20 supporting documents.');
    return this.repository.createCandidateVideos(hashToken(token), input);
  }

  async reuploadCandidateVideo(token: string, videoId: string, input: Pick<UploadInput, 'videos' | 'documents'>): Promise<CandidateVideo> {
    if (input.videos.length !== 1) throw new PortalError('Choose exactly one replacement video.');
    if (input.documents.length > 20) throw new PortalError('Upload no more than 20 supporting documents.');
    return this.repository.replaceRequestedVideo(hashToken(token), videoId, input.videos[0], input.documents);
  }

  async submitEvaluation(token: string, input: EvaluationInput): Promise<CandidateVideo> {
    if (!input.videoId) throw new PortalError('Choose a video from this submission before submitting feedback.');
    if (!input.scores || typeof input.scores !== 'object' || Array.isArray(input.scores)) {
      throw new PortalError('Rate every Standard Evaluation Rubric criterion before submitting.');
    }
    const values = Object.values(input.scores);
    if (values.length < 1 || values.length > 12 || values.some((score) => !Number.isInteger(score) || score < 1 || score > 5)) {
      throw new PortalError('Every rubric score must be between 1 and 5.');
    }
    if (!['selected', 'rejected'].includes(input.decision)) throw new PortalError('Choose Selected or Rejected as the evaluation decision.');
    if (typeof input.notes !== 'string' || !input.notes.trim() || input.notes.trim().length > 4000) {
      throw new PortalError('Feedback is required (maximum 4,000 characters). Explain why the candidate should be recruited or rejected.');
    }
    return this.repository.submitEvaluation(hashToken(token), input);
  }
}