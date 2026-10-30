import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { Request, Response, Router, NextFunction } from 'express';
import multer from 'multer';
import { getPool } from '../db/database';
import { PortalRepository, ShareLinkRecord } from '../repositories/PortalRepository';
import { PortalError, PortalService } from '../services/PortalService';
import { EmailService } from '../services/EmailService';
import { publishAdminNotification } from '../services/AdminNotificationHub';
import { adminReviewRubric } from '../../data/adminReviewRubric';
import { CandidateVideo } from '../../types';

const storageDirectory = path.resolve(process.cwd(), 'storage', 'videos');
mkdirSync(storageDirectory, { recursive: true });

const stripCandidatePrivateFields = ({
  documents: _documents,
  adminReviewScores: _adminReviewScores,
  adminOverallRating: _adminOverallRating,
  ...video
}: CandidateVideo) => video;

const upload = multer({
  storage: multer.diskStorage({
    destination: storageDirectory,
    filename: (_request, file, callback) => callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 500 * 1024 * 1024, files: 26 },
  fileFilter: (_request, file, callback) => {
    const mimeType = file.mimetype.split(';', 1)[0].trim().toLowerCase();
    const acceptedTypes = file.fieldname === 'videos'
      ? ['video/mp4', 'video/webm', 'video/quicktime']
      : ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png'];
    if (!acceptedTypes.includes(mimeType)) {
      callback(new PortalError('Upload an MP4, WebM, or MOV video.'));
      return;
    }
    file.mimetype = mimeType;
    callback(null, true);
  },
});

export function createPortalRouter(): Router {
  const router = Router();
  const repository = new PortalRepository(getPool());
  const service = new PortalService(repository);
  const emailService = new EmailService(repository);
  const attemptEmail = async (description: string, deliver: () => Promise<void>): Promise<string> => {
    try {
      await deliver();
      return '';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Email could not be sent.';
      console.error(`${description}: ${message}`);
      return message;
    }
  };

  const authorizeLink = (purpose: 'upload' | 'review') => async (request: Request, response: Response, next: NextFunction) => {
    try {
      const result = await service.validateInvite(request.params.token);
      if ((purpose === 'upload' ? 'candidate' : 'evaluator') !== result.invite.type) {
        throw new PortalError('This link cannot be used for that action.', 403);
      }
      response.locals.shareLink = result.record as ShareLinkRecord;
      next();
    } catch (error) {
      next(error);
    }
  };

  router.get('/stats', async (_request, response, next) => {
    try {
      const counts = await repository.dashboardCounts();
      const total = counts.videosUploaded;
      response.json({
        stats: {
          totalUsers: counts.totalUsers,
          totalUsersGrowth: '',
          videosUploaded: counts.videosUploaded,
          videosGrowth: '',
          pendingAssignments: counts.pendingAssignments,
          completedEvals: counts.completedEvals,
          completionRate: `${total ? Math.round((counts.completedEvals / total) * 100) : 0}% completion rate`,
          avgCompletionTime: '',
          slaCompliance: 0,
          activeEvaluatorsCount: counts.totalEvaluators,
          totalEvaluatorsCount: counts.totalEvaluators,
        },
        evaluatorStats: { totalAssigned: counts.pendingAssignments + counts.completedEvals, pendingReview: counts.pendingAssignments, completed: counts.completedEvals },
        candidatePendingCount: counts.candidatePendingCount,
        employerPendingCount: counts.employerPendingCount,
      });
    } catch (error) { next(error); }
  });

  router.get('/settings', async (_request, response, next) => {
    try { response.json(await repository.getSystemSettings()); }
    catch (error) { next(error); }
  });

  router.put('/settings', async (request, response, next) => {
    try {
      const { smtpPassword = '', ...settings } = request.body || {};
      if (!Array.isArray(settings.rubricWeights) || settings.rubricWeights.length < 1 || settings.rubricWeights.length > 12) {
        throw new PortalError('Add between one and twelve rubric criteria.');
      }
      const totalWeight = settings.rubricWeights.reduce((sum: number, item: { weight: number }) => sum + Number(item.weight), 0);
      const rubricIds = settings.rubricWeights.map((item: { id?: string }) => item.id);
      if (settings.rubricWeights.some((item: { id?: string; name?: string; weight: number }) => !item.id?.trim() || !item.name?.trim() || item.name.length > 100 || !Number.isFinite(Number(item.weight)) || Number(item.weight) < 0 || Number(item.weight) > 100) || new Set(rubricIds).size !== rubricIds.length || Math.abs(totalWeight - 100) > 0.01) {
        throw new PortalError('Rubric criteria need names and weights that total exactly 100%.');
      }
      if (!Number.isInteger(Number(settings.smtpPort)) || Number(settings.smtpPort) < 1 || Number(settings.smtpPort) > 65535) {
        throw new PortalError('SMTP port must be between 1 and 65535.');
      }
      const saved = await repository.saveSystemSettings(settings, String(smtpPassword));
      response.json(saved);
    } catch (error) { next(error); }
  });

  router.post('/settings/email/test', async (request, response, next) => {
    try {
      const { recipient, smtpPassword = '', ...settings } = request.body || {};
      if (typeof recipient !== 'string' || !/^\S+@\S+\.\S+$/.test(recipient)) throw new PortalError('Enter a valid test recipient email.');
      const providedPassword = String(smtpPassword).trim();
      const savedCredentials = providedPassword ? null : await repository.getSmtpCredentials();
      const password = providedPassword || savedCredentials?.password || '';
      await emailService.sendTestEmail(settings, password, recipient);
      response.json({ success: true });
    } catch (error) { next(error); }
  });

  router.get('/evaluator/:id/stats', async (request, response, next) => {
    try {
      const videos = await repository.listVideos({ evaluatorId: request.params.id });
      response.json({ totalAssigned: videos.length, pendingReview: videos.filter((video) => video.status !== 'completed').length, completed: videos.filter((video) => video.status === 'completed').length });
    } catch (error) { next(error); }
  });

  router.get('/videos', async (request, response, next) => {
    try {
      const { status, evaluatorId, search, page, limit } = request.query;
      const pageNumber = Number(page) > 0 ? Number(page) : 1;
      const pageLimit = Number(limit) > 0 ? Number(limit) : 0;
      const items = await repository.listVideos({ status: typeof status === 'string' ? status : undefined, evaluatorId: typeof evaluatorId === 'string' ? evaluatorId : undefined, search: typeof search === 'string' ? search : undefined });

      if (pageLimit > 0) {
        const start = (pageNumber - 1) * pageLimit;
        return response.json({ items: items.slice(start, start + pageLimit), page: pageNumber, limit: pageLimit, total: items.length });
      }

      response.json(items);
    } catch (error) { next(error); }
  });

  router.get('/submissions', async (request, response, next) => {
    try {
      const requestedPage = Number(request.query.page);
      const requestedLimit = Number(request.query.limit);
      const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
      const limit = Number.isSafeInteger(requestedLimit) && requestedLimit > 0 ? Math.min(100, requestedLimit) : 10;
      const result = await repository.listSubmissionPage({
        page,
        limit,
        status: typeof request.query.status === 'string' ? request.query.status : undefined,
        department: typeof request.query.department === 'string' ? request.query.department : undefined,
        search: typeof request.query.search === 'string' ? request.query.search : undefined,
        reviewStatus: typeof request.query.reviewStatus === 'string' ? request.query.reviewStatus : undefined,
      });
      response.json({ ...result, page, limit });
    } catch (error) { next(error); }
  });

  router.post('/admin/cleanup/:resource', async (request, response, next) => {
    try {
      const resource = request.params.resource;
      if (!['submissions', 'videos', 'users', 'links'].includes(resource)) {
        throw new PortalError('Choose a valid cleanup category.');
      }
      const result = await repository.cleanupData(resource as 'submissions' | 'videos' | 'users' | 'links');
      const fileErrors: string[] = [];
      let removedFiles = 0;
      for (const filePath of result.filesToDelete) {
        const absolutePath = path.resolve(process.cwd(), filePath);
        const relativePath = path.relative(storageDirectory, absolutePath);
        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
          fileErrors.push('A stored file path was outside the upload directory and was not removed.');
          continue;
        }
        try {
          await unlink(absolutePath);
          removedFiles += 1;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            fileErrors.push(`Could not remove a stored upload file: ${error instanceof Error ? error.message : 'Unknown file error.'}`);
          }
        }
      }
      response.json({ success: true, deleted: result.deleted, removedFiles, fileErrors });
    } catch (error) { next(error); }
  });

  router.get('/videos/:id/file', async (request, response, next) => {
    try {
      const file = await repository.getVideoFile(request.params.id);
      if (!file) return response.status(404).json({ error: 'Video file not found.' });
      response.type(file.mimeType).sendFile(path.resolve(file.filePath));
    } catch (error) { next(error); }
  });

  router.get('/videos/:id/documents/:documentId', async (request, response, next) => {
    try {
      const file = await repository.getVideoDocument(request.params.id, request.params.documentId);
      if (!file) return response.status(404).json({ error: 'Document not found.' });
      const disposition = request.query.download === '1' ? 'attachment' : 'inline';
      response.type(file.mimeType);
      response.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
      response.sendFile(path.resolve(file.filePath));
    } catch (error) { next(error); }
  });

  router.get('/videos/:id', async (request, response, next) => {
    try {
      const video = await repository.getVideo(request.params.id);
      if (!video) return response.status(404).json({ error: 'Video not found.' });
      response.json(video);
    } catch (error) { next(error); }
  });

  router.post('/videos/:id/review', async (request, response, next) => {
    try {
      const { decision, feedback = '', scores } = request.body || {};
      if (decision !== 'accepted' && decision !== 'reupload_requested') throw new PortalError('Choose accept or request reupload.');
      if (typeof feedback !== 'string' || !feedback.trim() || feedback.length > 4000) {
        throw new PortalError('Enter feedback (maximum 4000 characters) before submitting this review.');
      }
      if (!scores || typeof scores !== 'object' || Array.isArray(scores)
        || Object.keys(scores).length !== adminReviewRubric.length
        || adminReviewRubric.some((criterion) => !Number.isInteger(scores[criterion.id]) || scores[criterion.id] < 1 || scores[criterion.id] > 5)) {
        throw new PortalError('Rate every review criterion from 1 to 5 before saving.');
      }
      const video = await repository.reviewVideo(request.params.id, decision, feedback.trim(), scores as Record<string, number>);
      if (!video) return response.status(404).json({ error: 'Video not found.' });
      const emailNotice = await attemptEmail('Could not email candidate after admin review', () =>
        emailService.sendCandidateReview(video, decision, feedback.trim()));
      response.json({ video, emailSent: !emailNotice, emailNotice });
    } catch (error) { next(error); }
  });

  router.get('/users', async (request, response, next) => {
    try {
      const { role, page, limit, search } = request.query;
      const items = await repository.listUsers(
        typeof role === 'string' ? role : undefined,
        typeof search === 'string' ? search : undefined,
      );
      const pageNumber = Number(page) > 0 ? Number(page) : 1;
      const pageLimit = Number(limit) > 0 ? Number(limit) : 0;

      if (pageLimit > 0) {
        const start = (pageNumber - 1) * pageLimit;
        return response.json({ items: items.slice(start, start + pageLimit), page: pageNumber, limit: pageLimit, total: items.length });
      }

      response.json(items);
    } catch (error) { next(error); }
  });

  router.post('/users', async (request, response, next) => {
    try {
      const { name, email, role, department, title, phone } = request.body;
      if (!name || !email || !['admin', 'evaluator', 'candidate'].includes(role)) throw new PortalError('Name, email, and a valid user role are required.');
      response.status(201).json(await repository.createUser({ name, email, role, department, title, phone }));
    } catch (error) { next(error); }
  });

  router.delete('/users/:id', async (request, response, next) => {
    try {
      if (!await repository.deleteUser(request.params.id)) return response.status(404).json({ error: 'User not found.' });
      response.json({ success: true });
    } catch (error) {
      if (error instanceof Error && /cannot be deleted|has assignments/i.test(error.message)) {
        return response.status(409).json({ error: error.message });
      }
      next(error);
    }
  });

  router.get('/invites', async (request, response, next) => {
    try {
      const { page, limit, type, status, search } = request.query;
      const pageNumber = Number(page) > 0 ? Number(page) : 1;
      const pageLimit = Math.min(50, Number(limit) > 0 ? Number(limit) : 10);
      const result = await repository.listInvites({
        page: pageNumber,
        limit: pageLimit,
        type: typeof type === 'string' ? type : undefined,
        status: typeof status === 'string' ? status : undefined,
        search: typeof search === 'string' ? search : undefined,
      });
      response.json({ ...result, page: pageNumber, limit: pageLimit });
    } catch (error) { next(error); }
  });

  router.post('/invites', upload.fields([{ name: 'adminSupportingDocuments', maxCount: 20 }]), async (request, response, next) => {
    const uploadedDocuments = (request.files as { adminSupportingDocuments?: Express.Multer.File[] } | undefined)?.adminSupportingDocuments || [];
    try {
      const {
        type,
        recipientName,
        recipientEmail = '',
        roleApplied = '',
        department = '',
        assignedVideoId,
        expiresAt,
        notes = '',
        createdBy = '',
        answerMode,
        videoCount,
        questionPrompt,
        questionPrompts,
      } = request.body;
      if (type !== 'candidate' && type !== 'evaluator') throw new PortalError('Link type must be candidate or evaluator.');
      if (type !== 'evaluator' && uploadedDocuments.length > 0) {
        throw new PortalError('Supporting documents can only be attached to a Manager / Employer review link.');
      }
      if (uploadedDocuments.some((document) => document.size > 25 * 1024 * 1024)) {
        throw new PortalError('Each supporting document must be 25 MB or smaller.');
      }
      let parsedQuestionPrompts: unknown = questionPrompts;
      if (typeof questionPrompts === 'string') {
        try {
          parsedQuestionPrompts = JSON.parse(questionPrompts);
        } catch {
          throw new PortalError('The selected interview questions are invalid.');
        }
      }
      const invite = await service.createInvite({
        type,
        recipientName: String(recipientName || ''),
        recipientEmail: String(recipientEmail),
        roleApplied: String(roleApplied),
        department: String(department),
        assignedVideoId,
        expiresAt: String(expiresAt || ''),
        notes: String(notes),
        createdBy: String(createdBy),
        answerMode: answerMode === 'record' ? 'record' : 'upload',
        videoCount: Number(videoCount) || undefined,
        questionPrompt: typeof questionPrompt === 'string' ? questionPrompt : undefined,
        questionPrompts: Array.isArray(parsedQuestionPrompts) ? parsedQuestionPrompts.filter((prompt): prompt is string => typeof prompt === 'string' && Boolean(prompt.trim())) : undefined,
        adminSupportingDocuments: uploadedDocuments.map((file) => ({
          id: randomUUID(),
          filePath: path.relative(process.cwd(), file.path),
          originalFilename: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
        })),
      });
      const origin = process.env.APP_URL || `${request.protocol}://${request.get('host')}`;
      const emailNotice = await attemptEmail(`Could not email ${invite.type} invitation`, () =>
        emailService.sendInvite(invite, `${origin}/?portal=${invite.type}&token=${encodeURIComponent(invite.token)}`));
      response.status(201).json({ ...invite, emailSent: !emailNotice, emailNotice });
    } catch (error) {
      await Promise.all(uploadedDocuments.map((file) => unlink(file.path).catch(() => undefined)));
      next(error);
    }
  });

  router.get('/invites/validate/:token', async (request, response, next) => {
    try {
      response.setHeader('Cache-Control', 'no-store');
      const result = await service.validateInvite(request.params.token);
      const videos = result.invite.type === 'candidate'
        ? result.videos.map(stripCandidatePrivateFields)
        : result.videos;
      response.json({
        valid: true,
        invite: result.invite,
        video: result.video
          ? result.invite.type === 'candidate' ? stripCandidatePrivateFields(result.video) : result.videos.find((item) => item.id === result.video?.id) || result.video
          : null,
        videos,
      });
    } catch (error) { next(error); }
  });

  router.post('/invites/:id/revoke', async (request, response, next) => {
    try {
      if (!await repository.markInviteRevoked(request.params.id)) return response.status(404).json({ error: 'Active link not found.' });
      response.json({ success: true });
    } catch (error) { next(error); }
  });

  router.post('/invites/:id/extend-expiry', async (request, response, next) => {
    try {
      const expiresAt = new Date(String(request.body?.expiresAt || ''));
      if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) throw new PortalError('Choose a future expiry date and time.');
      if (!await repository.extendInviteExpiry(request.params.id, expiresAt)) {
        throw new PortalError('Only unused links can be extended.', 409);
      }
      let emailNotice = '';
      let shareToken: string | undefined;
      let shareType: string | undefined;
      const invite = await repository.getInviteForNotification(request.params.id);
      if (invite?.token) {
        invite.expiresAt = expiresAt.toISOString();
        const origin = process.env.APP_URL || `${request.protocol}://${request.get('host')}`;
        emailNotice = await attemptEmail('Could not email updated link expiry', () =>
          emailService.sendExpiryUpdated(invite, `${origin}/?portal=${invite.type}&token=${encodeURIComponent(invite.token)}`));
        shareToken = invite.token;
        shareType = invite.type;
      } else {
        emailNotice = invite
          ? 'This older link has no stored token to include in the email. Copy and send a newly created link instead.'
          : 'The link expiry was extended, but recipient details were not found for email.';
      }
      response.json({
        success: true,
        expiresAt: expiresAt.toISOString(),
        shareToken,
        shareType,
        emailSent: !emailNotice,
        emailNotice,
      });
    } catch (error) { next(error); }
  });

  router.get('/public/links/:token/video', authorizeLink('review'), async (request, response, next) => {
    try {
      const link = response.locals.shareLink as ShareLinkRecord;
      const requestedVideoId = String(request.query.videoId || link.video_id || '');
      const assignedVideos = await repository.getAssignedVideos(link);
      if (!assignedVideos.some((video) => video.id === requestedVideoId)) {
        throw new PortalError('This video is not part of your assigned submission.', 403);
      }
      const file = await repository.getVideoFile(requestedVideoId);
      if (!file) return response.status(404).json({ error: 'Assigned video file not found.' });
      response.type(file.mimeType).sendFile(path.resolve(file.filePath));
    } catch (error) { next(error); }
  });

  router.get('/public/links/:token/documents/:videoId/:documentId', authorizeLink('review'), async (request, response, next) => {
    try {
      const link = response.locals.shareLink as ShareLinkRecord;
      const assignedVideos = await repository.getAssignedVideos(link);
      if (!assignedVideos.some((video) => video.id === request.params.videoId)) {
        throw new PortalError('This document is not part of your assigned submission.', 403);
      }
      const file = await repository.getVideoDocument(request.params.videoId, request.params.documentId);
      if (!file) return response.status(404).json({ error: 'Document not found.' });
      const disposition = request.query.download === '1' ? 'attachment' : 'inline';
      response.type(file.mimeType);
      response.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
      response.sendFile(path.resolve(file.filePath));
    } catch (error) { next(error); }
  });

  router.post('/public/links/:token/upload', authorizeLink('upload'), upload.fields([
    { name: 'videos', maxCount: 6 },
  ]), async (request, response, next) => {
    const uploadedFiles = request.files as { videos?: Express.Multer.File[] } | undefined;
    try {
      const shareLink = response.locals.shareLink as ShareLinkRecord | undefined;
      const videos = uploadedFiles?.videos || [];
      const requestedAnswerMode = String(request.body.answerMode || '');
      if (requestedAnswerMode !== shareLink?.answer_mode) {
        throw new PortalError('Use the submission method selected for this link.');
      }
      const requiredVideoCount = Math.max(1, Number(shareLink?.video_count || 1));
      if (videos.length !== requiredVideoCount) {
        throw new PortalError(`Submit ${requiredVideoCount} video response${requiredVideoCount === 1 ? '' : 's'} for this link.`);
      }
      let questionPrompts: unknown;
      try {
        questionPrompts = JSON.parse(String(request.body.questionPrompts || ''));
      } catch {
        throw new PortalError('The interview question details are missing. Reload the page and try again.');
      }
      if (!Array.isArray(questionPrompts) || questionPrompts.length !== requiredVideoCount
        || !questionPrompts.every((prompt): prompt is string => typeof prompt === 'string' && Boolean(prompt.trim()))) {
        throw new PortalError(`Submit ${requiredVideoCount} video response${requiredVideoCount === 1 ? '' : 's'} for this link.`);
      }
      const keySkills = String(request.body.keySkills || '').split(',').map((value) => value.trim()).filter(Boolean);
      const result = await service.uploadCandidate(request.params.token, {
        candidateName: String(request.body.candidateName || ''),
        candidateEmail: String(request.body.candidateEmail || ''),
        roleApplied: String(request.body.roleApplied || ''),
        department: String(request.body.department || ''),
        submissionType: String(request.body.submissionType || ''),
        bio: String(request.body.bio || ''),
        keySkills,
        videos: videos.map((file, index) => ({
          filePath: path.relative(process.cwd(), file.path),
          originalFilename: file.originalname,
          mimeType: file.mimetype,
          questionPrompt: questionPrompts[index],
        })),
        documents: [],
      });
      const firstVideo = result[0];
      if (firstVideo) {
        const submissionId = firstVideo.submissionId || firstVideo.submissionBatchId || firstVideo.id;
        publishAdminNotification({
          id: randomUUID(),
          type: 'candidate_submission',
          title: 'New candidate submission received',
          description: `${firstVideo.candidateName} submitted ${result.length} video${result.length === 1 ? '' : 's'} for ${firstVideo.roleApplied}.`,
          timestamp: new Date().toISOString(),
          icon: 'video_library',
          submissionId,
        });
      }
      const emailNotices: string[] = [];
      if (firstVideo) {
        const origin = process.env.APP_URL || `${request.protocol}://${request.get('host')}`;
        const portalUrl = `${origin}/`;
        const candidateEmailNotice = await attemptEmail('Could not send candidate upload confirmation', () =>
          emailService.sendCandidateUploadConfirmation(firstVideo, result.length));
        const adminEmailNotice = await attemptEmail('Could not notify admin of candidate upload', () =>
          emailService.sendAdminSubmissionReceived(firstVideo, result.length, portalUrl));
        if (candidateEmailNotice) emailNotices.push(`Candidate confirmation: ${candidateEmailNotice}`);
        if (adminEmailNotice) emailNotices.push(`Admin notification: ${adminEmailNotice}`);
      }
      response.status(201).json({ videos: result, emailNotice: emailNotices.join(' ') });
    } catch (error) {
      await Promise.all([
        ...(uploadedFiles?.videos || []),
      ].map((file) => unlink(file.path).catch(() => undefined)));
      next(error);
    }
  });

  router.post('/public/links/:token/reupload/:videoId', authorizeLink('upload'), upload.fields([
    { name: 'videos', maxCount: 1 },
  ]), async (request, response, next) => {
    const uploadedFiles = request.files as { videos?: Express.Multer.File[] } | undefined;
    try {
      const videos = uploadedFiles?.videos || [];
      const shareLink = response.locals.shareLink as ShareLinkRecord | undefined;
      if (String(request.body.answerMode || '') !== shareLink?.answer_mode) {
        throw new PortalError('Use the submission method selected for this link.');
      }
      if (videos.length !== 1) throw new PortalError('Select one replacement video.');
      const result = await service.reuploadCandidateVideo(request.params.token, request.params.videoId, {
        videos: videos.map((file) => ({ filePath: path.relative(process.cwd(), file.path), originalFilename: file.originalname, mimeType: file.mimetype })),
        documents: [],
      });
      const submissionId = result.submissionId || result.submissionBatchId || result.id;
      publishAdminNotification({
        id: randomUUID(),
        type: 'submission_updated',
        title: 'Candidate updated a submission',
        description: `${result.candidateName} submitted a replacement video for ${result.roleApplied}.`,
        timestamp: new Date().toISOString(),
        icon: 'upload_file',
        submissionId,
      });
      const origin = process.env.APP_URL || `${request.protocol}://${request.get('host')}`;
      const emailNotices = [
        await attemptEmail('Could not send candidate reupload confirmation', () =>
          emailService.sendCandidateUploadConfirmation(result, 1)),
        await attemptEmail('Could not notify admin of candidate reupload', () =>
          emailService.sendAdminSubmissionUpdated(result, `${origin}/`)),
      ].filter(Boolean);
      response.json({ video: stripCandidatePrivateFields(result), emailNotice: emailNotices.join(' ') });
    } catch (error) {
      await Promise.all((uploadedFiles?.videos || []).map((file) => unlink(file.path).catch(() => undefined)));
      next(error);
    }
  });

  router.post('/public/links/:token/review', authorizeLink('review'), async (request, response, next) => {
    try {
      const { videoId, scores, decision, notes, aiSummary, keyStrengths, areasToImprove } = request.body;
      const video = await service.submitEvaluation(request.params.token, { videoId, scores, decision, notes: String(notes || ''), aiSummary, keyStrengths, areasToImprove });
      const submissionId = video.submissionId || video.submissionBatchId || video.id;
      publishAdminNotification({
        id: randomUUID(),
        type: 'assignment_updated',
        title: 'Manager / Employer completed an assignment',
        description: `${video.assignedEvaluatorName || 'A Manager / Employer'} completed the review for ${video.candidateName}'s ${video.roleApplied} submission.`,
        timestamp: new Date().toISOString(),
        icon: 'fact_check',
        submissionId,
      });
      const origin = process.env.APP_URL || `${request.protocol}://${request.get('host')}`;
      const emailNotice = await attemptEmail('Could not notify admin of completed employer evaluation', () =>
        emailService.sendAdminEvaluationCompleted(video, `${origin}/`));
      response.json({ success: true, video, emailSent: !emailNotice, emailNotice });
    } catch (error) { next(error); }
  });

  router.use((error: Error, _request: Request, response: Response, _next: NextFunction) => {
    const statusCode = error instanceof PortalError
      ? error.statusCode
      : /already exists|duplicate key|rubric for this assignment/i.test(error.message) ? 409 : 400;
    response.status(statusCode).json({ error: error.message || 'Request failed.' });
  });

  return router;
}