import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { Pool, PoolClient } from 'pg';
import { CandidateVideo, InviteLink, RubricWeight, SystemSettings, User, UserRole } from '../../types';
import { initialSettings } from '../../data/mockData';

export interface CreateInviteInput {
  type: 'candidate' | 'evaluator';
  tokenHash: string;
  tokenCiphertext: string;
  tokenPreview: string;
  recipientName: string;
  recipientEmail: string;
  roleApplied: string;
  department: string;
  assignedVideoId?: string;
  expiresAt: Date;
  notes: string;
  createdBy: string;
}

export interface UploadInput {
  candidateName: string;
  candidateEmail: string;
  roleApplied: string;
  department: string;
  videos: { filePath: string; originalFilename: string; mimeType: string }[];
  documents: { id: string; filePath: string; originalFilename: string; mimeType: string; size: number }[];
  submissionType?: string;
  bio: string;
  keySkills: string[];
}

export interface EvaluationInput {
  videoId: string;
  scores: Record<string, number>;
  rubricWeights?: RubricWeight[];
  decision: 'selected' | 'rejected';
  notes: string;
  aiSummary?: string;
  keyStrengths?: string[];
  areasToImprove?: string[];
}

export interface ShareLinkRecord {
  id: string;
  purpose: 'upload' | 'review';
  recipient_name: string;
  recipient_email: string;
  role_applied: string;
  department: string;
  video_id: string | null;
  evaluator_id: string | null;
  evaluator_name?: string | null;
  candidate_name?: string | null;
  status: 'active' | 'used' | 'revoked';
  notes: string;
  created_by: string;
  access_count: number;
  created_at: Date;
  expires_at: Date;
  token_preview: string;
  token_ciphertext?: string;
  submission_id: string;
  rubric_weights?: RubricWeight[];
}

export interface SubmissionPageFilters {
  page: number;
  limit: number;
  status?: string;
  department?: string;
  search?: string;
  reviewStatus?: string;
}

export interface SubmissionPage {
  items: CandidateVideo[];
  total: number;
}

export type CleanupResource = 'submissions' | 'videos' | 'users' | 'links';

export interface CleanupResult {
  deleted: Record<string, number>;
  filesToDelete: string[];
}

type VideoRow = Record<string, any>;

const userFromRow = (row: Record<string, any>): User => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role as UserRole,
  avatar: '',
  phone: row.phone || '',
  status: row.status,
  department: row.department || '',
  title: row.title || '',
  assignedCount: Number(row.assigned_count || 0),
  completedCount: Number(row.completed_count || 0),
  lastActive: 'Recently active',
});

const videoFromRow = (row: VideoRow): CandidateVideo => {
  const details = row.details || {};
  const scores = row.scores || {};
  return {
    id: row.id,
    candidateName: row.candidate_name,
    candidateEmail: row.candidate_email,
    roleApplied: row.role_applied,
    department: row.department,
    submittedAt: new Date(row.created_at).toISOString(),
    submittedTimeAgo: 'Recently',
    status: row.status,
    videoUrl: `/api/videos/${encodeURIComponent(row.id)}/file`,
    videoDuration: row.duration_seconds ? `${Math.floor(row.duration_seconds / 60)}:${String(row.duration_seconds % 60).padStart(2, '0')}` : '00:00',
    durationSeconds: Number(row.duration_seconds || 0),
    bio: details.bio || '',
    keySkills: details.keySkills || [],
    submissionType: details.submissionType,
    submissionBatchId: details.submissionId || details.submissionBatchId,
    submissionId: details.submissionId || details.submissionBatchId || row.id,
    adminConfirmed: Boolean(row.admin_confirmed),
    adminReviewedAt: row.admin_reviewed_at ? new Date(row.admin_reviewed_at).toISOString() : undefined,
    adminReviewStatus: row.admin_review_status || 'pending',
    wasReuploaded: Boolean(details.wasReuploaded),
    previousAdminFeedback: details.adminPreviousFeedback || '',
    adminFeedback: row.admin_feedback || '',
    documents: Array.isArray(details.documents) ? details.documents.map((document: Record<string, any>) => {
      const url = `/api/videos/${encodeURIComponent(row.id)}/documents/${encodeURIComponent(document.id)}`;
      return {
        id: document.id,
        name: document.originalFilename,
        mimeType: document.mimeType,
        size: Number(document.size || 0),
        url,
        downloadUrl: `${url}?download=1`,
        adminReviewStatus: document.adminReviewStatus || 'pending',
        adminFeedback: document.adminFeedback || '',
      };
    }) : [],
    batchName: 'Share-link submissions',
    assignedEvaluatorId: row.evaluator_id || undefined,
    assignedEvaluatorName: row.evaluator_name || undefined,
    evaluation: row.evaluation_id ? {
      evaluatorId: row.evaluator_id,
      evaluatorName: row.evaluator_name || 'Evaluator',
      evaluatedAt: new Date(row.submitted_at).toISOString(),
      overallScore: Number(row.overall_score),
      scores,
      decision: row.decision,
      notes: row.evaluation_notes || '',
      aiSummary: row.extra?.aiSummary,
      keyStrengths: row.extra?.keyStrengths,
      areasToImprove: row.extra?.areasToImprove,
      rubricWeights: row.extra?.rubricWeights,
    } : undefined,
    evaluationHistory: Array.isArray(details.evaluationHistory) ? details.evaluationHistory : [],
  };
};

const inviteFromRow = (row: ShareLinkRecord, token?: string): InviteLink => ({
  id: row.id,
  token: token || row.token_preview,
  type: row.purpose === 'upload' ? 'candidate' : 'evaluator',
  title: row.purpose === 'upload' ? 'Candidate video upload link' : 'Evaluator video review link',
  recipientName: row.recipient_name,
  recipientEmail: row.recipient_email,
  roleApplied: row.role_applied,
  department: row.department,
  assignedVideoId: row.video_id || undefined,
  assignedCandidateName: row.candidate_name || undefined,
  submissionId: row.submission_id,
  ...(row.purpose === 'review' && Array.isArray(row.rubric_weights) && row.rubric_weights.length
    ? { rubricWeights: row.rubric_weights }
    : {}),
  status: row.status === 'active' && new Date(row.expires_at) < new Date() ? 'expired' : row.status,
  createdAt: new Date(row.created_at).toISOString(),
  expiresAt: new Date(row.expires_at).toISOString(),
  expiresInHours: Math.max(0, Math.ceil((new Date(row.expires_at).getTime() - new Date(row.created_at).getTime()) / 3600000)),
  createdBy: row.created_by,
  notes: row.notes,
  accessCount: Number(row.access_count),
});

const videoSelect = `
  SELECT v.*, a.evaluator_id, u.name AS evaluator_name,
         e.id AS evaluation_id, e.scores, e.overall_score, e.decision,
         e.notes AS evaluation_notes, e.extra, e.submitted_at
  FROM videos v
  LEFT JOIN assignments a ON a.video_id = v.id
  LEFT JOIN users u ON u.id = a.evaluator_id
  LEFT JOIN evaluations e ON e.assignment_id = a.id`;

export class PortalRepository {
  constructor(private readonly pool: Pool) {}

  private settingsTableReady?: Promise<void>;
  private shareLinkRubricReady?: Promise<void>;
  private evaluationDecisionReady?: Promise<void>;

  private ensureEvaluationDecisionConstraint(): Promise<void> {
    if (!this.evaluationDecisionReady) {
      this.evaluationDecisionReady = this.pool.query(
        `ALTER TABLE evaluations DROP CONSTRAINT IF EXISTS evaluations_decision_check;
         ALTER TABLE evaluations ADD CONSTRAINT evaluations_decision_check
           CHECK (decision IN ('selected', 'rejected', 'shortlist', 'hold', 'reject'))`,
      ).then(() => undefined).catch((error) => {
        this.evaluationDecisionReady = undefined;
        throw error;
      });
    }
    return this.evaluationDecisionReady;
  }

  private ensureShareLinkRubricColumn(): Promise<void> {
    if (!this.shareLinkRubricReady) {
      this.shareLinkRubricReady = this.pool.query(
        "ALTER TABLE share_links ADD COLUMN IF NOT EXISTS rubric_weights JSONB NOT NULL DEFAULT '[]'::jsonb",
      ).then(() => undefined).catch((error) => {
        this.shareLinkRubricReady = undefined;
        throw error;
      });
    }
    return this.shareLinkRubricReady;
  }

  private ensureSettingsTable(): Promise<void> {
    if (!this.settingsTableReady) {
      this.settingsTableReady = this.pool.query(
        `CREATE TABLE IF NOT EXISTS system_settings (
           key TEXT PRIMARY KEY,
           value JSONB NOT NULL DEFAULT '{}'::jsonb,
           encrypted_smtp_password TEXT NOT NULL DEFAULT '',
           updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
         )`,
      ).then(() => undefined).catch((error) => {
        this.settingsTableReady = undefined;
        throw error;
      });
    }
    return this.settingsTableReady;
  }

  encryptInviteToken(token: string): string {
    return this.encryptSmtpPassword(token);
  }

  private decryptInviteToken(tokenCiphertext: string): string {
    return this.decryptSmtpPassword(tokenCiphertext);
  }

  private encryptSmtpPassword(password: string): string {
    const keyHex = process.env.EMAIL_CONFIG_ENCRYPTION_KEY || '';
    if (!/^[0-9a-f]{64}$/i.test(keyHex)) throw new Error('Set EMAIL_CONFIG_ENCRYPTION_KEY to a 32-byte hex key before saving SMTP credentials.');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), iv);
    const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
    return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`;
  }

  private decryptSmtpPassword(encryptedValue: string): string {
    const keyHex = process.env.EMAIL_CONFIG_ENCRYPTION_KEY || '';
    if (!/^[0-9a-f]{64}$/i.test(keyHex)) throw new Error('EMAIL_CONFIG_ENCRYPTION_KEY is missing or invalid.');
    const [ivHex, tagHex, encryptedHex] = encryptedValue.split(':');
    const decipher = createDecipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]).toString('utf8');
  }

  async getSystemSettings(): Promise<SystemSettings> {
    await this.ensureSettingsTable();
    const result = await this.pool.query("SELECT value, encrypted_smtp_password FROM system_settings WHERE key = 'application'");
    const row = result.rows[0];
    return {
      ...initialSettings,
      ...(row?.value || {}),
      smtpPasswordConfigured: Boolean(row?.encrypted_smtp_password),
    };
  }

  async saveSystemSettings(settings: SystemSettings, smtpPassword?: string): Promise<SystemSettings> {
    await this.ensureSettingsTable();
    const current = await this.pool.query("SELECT encrypted_smtp_password FROM system_settings WHERE key = 'application'");
    const encryptedPassword = smtpPassword?.trim()
      ? this.encryptSmtpPassword(smtpPassword)
      : current.rows[0]?.encrypted_smtp_password || '';
    const { smtpPasswordConfigured: _passwordConfigured, ...value } = settings;
    await this.pool.query(
      `INSERT INTO system_settings (key, value, encrypted_smtp_password)
       VALUES ('application', $1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value,
         encrypted_smtp_password = EXCLUDED.encrypted_smtp_password, updated_at = NOW()`,
      [JSON.stringify(value), encryptedPassword],
    );
    return this.getSystemSettings();
  }

  async getSmtpCredentials(): Promise<{ settings: SystemSettings; password: string }> {
    await this.ensureSettingsTable();
    const result = await this.pool.query("SELECT encrypted_smtp_password FROM system_settings WHERE key = 'application'");
    const encryptedPassword = result.rows[0]?.encrypted_smtp_password || '';
    return {
      settings: await this.getSystemSettings(),
      password: encryptedPassword ? this.decryptSmtpPassword(encryptedPassword) : '',
    };
  }

  async listUsers(role?: string, search?: string): Promise<User[]> {
    const result = await this.pool.query(
      `SELECT u.*, COUNT(a.id)::int AS assigned_count,
              COUNT(a.id) FILTER (WHERE a.status = 'completed')::int AS completed_count
       FROM users u LEFT JOIN assignments a ON a.evaluator_id = u.id
       WHERE ($1::text IS NULL OR u.role = $1)
         AND ($2::text IS NULL OR u.name ILIKE '%' || $2 || '%' OR u.email ILIKE '%' || $2 || '%'
              OR (u.role = 'admin' AND ('P2P Admin' ILIKE '%' || $2 || '%' OR 'p2precruitment2025@gmail.com' ILIKE '%' || $2 || '%')))
       GROUP BY u.id ORDER BY u.created_at DESC`,
      [role && role !== 'all' ? role : null, search?.trim() || null],
    );
    return result.rows.map((row) => {
      const user = userFromRow(row);
      return user.role === 'admin'
        ? { ...user, name: 'P2P Admin', email: 'p2precruitment2025@gmail.com' }
        : user;
    });
  }

  async cleanupData(resource: CleanupResource): Promise<CleanupResult> {
    const client = await this.pool.connect();
    const deleted: Record<string, number> = {};
    const filesToDelete: string[] = [];
    const recordCount = (result: { rowCount: number | null }) => result.rowCount || 0;
    try {
      await client.query('BEGIN');

      if (resource === 'submissions') {
        const videos = await client.query('SELECT id, file_path, details FROM videos');
        const videoIds = videos.rows.map((video) => video.id as string);
        const submissionIds = [...new Set(videos.rows.map((video) =>
          video.details?.submissionId || video.details?.submissionBatchId || video.id,
        ))] as string[];
        for (const video of videos.rows) {
          if (video.file_path) filesToDelete.push(video.file_path);
          if (Array.isArray(video.details?.documents)) {
            for (const document of video.details.documents) {
              if (typeof document.filePath === 'string' && document.filePath) filesToDelete.push(document.filePath);
            }
          }
        }
        if (videoIds.length) {
          const assignmentIds = await client.query('SELECT id FROM assignments WHERE video_id = ANY($1::text[])', [videoIds]);
          const ids = assignmentIds.rows.map((row) => row.id as string);
          if (ids.length) deleted.evaluations = recordCount(await client.query('DELETE FROM evaluations WHERE assignment_id = ANY($1::text[])', [ids]));
          deleted.assignments = recordCount(await client.query('DELETE FROM assignments WHERE video_id = ANY($1::text[])', [videoIds]));
          deleted.links = recordCount(await client.query(
            'DELETE FROM share_links WHERE submission_id = ANY($1::text[]) OR video_id = ANY($2::text[])',
            [submissionIds, videoIds],
          ));
          deleted.videos = recordCount(await client.query('DELETE FROM videos WHERE id = ANY($1::text[])', [videoIds]));
        } else {
          deleted.assignments = 0;
          deleted.evaluations = 0;
          deleted.links = 0;
          deleted.videos = 0;
        }
      } else if (resource === 'videos') {
        const videoRows = await client.query("SELECT file_path FROM videos WHERE file_path <> ''");
        filesToDelete.push(...videoRows.rows.map((row) => row.file_path as string));
        deleted.videoFiles = recordCount(await client.query("UPDATE videos SET file_path = '' WHERE file_path <> ''"));
      } else if (resource === 'users') {
        const userRows = await client.query("SELECT id FROM users WHERE role <> 'admin'");
        const userIds = userRows.rows.map((row) => row.id as string);
        const assignmentRows = userIds.length
          ? await client.query('SELECT id, video_id, share_link_id FROM assignments WHERE evaluator_id = ANY($1::text[])', [userIds])
          : { rows: [] };
        const assignmentIds = assignmentRows.rows.map((row) => row.id as string);
        const assignedVideoIds = [...new Set(assignmentRows.rows.map((row) => row.video_id as string))];
        const assignmentLinkIds = [...new Set(assignmentRows.rows.map((row) => row.share_link_id as string))];
        if (assignmentIds.length) {
          deleted.evaluations = recordCount(await client.query('DELETE FROM evaluations WHERE assignment_id = ANY($1::text[])', [assignmentIds]));
          deleted.assignments = recordCount(await client.query('DELETE FROM assignments WHERE id = ANY($1::text[])', [assignmentIds]));
        } else {
          deleted.evaluations = 0;
          deleted.assignments = 0;
        }
        if (assignedVideoIds.length) {
          await client.query("UPDATE videos SET status = 'pending' WHERE id = ANY($1::text[])", [assignedVideoIds]);
        }
        if (userIds.length) {
          deleted.links = recordCount(await client.query(
            'DELETE FROM share_links WHERE evaluator_id = ANY($1::text[]) OR id = ANY($2::text[])',
            [userIds, assignmentLinkIds],
          ));
          deleted.users = recordCount(await client.query("DELETE FROM users WHERE role <> 'admin'"));
        } else {
          deleted.links = 0;
          deleted.users = 0;
        }
      } else {
        const assignmentRows = await client.query('SELECT id, video_id FROM assignments');
        const assignmentIds = assignmentRows.rows.map((row) => row.id as string);
        const videoIds = [...new Set(assignmentRows.rows.map((row) => row.video_id as string))];
        if (assignmentIds.length) {
          deleted.evaluations = recordCount(await client.query('DELETE FROM evaluations WHERE assignment_id = ANY($1::text[])', [assignmentIds]));
          deleted.assignments = recordCount(await client.query('DELETE FROM assignments'));
          await client.query("UPDATE videos SET status = 'pending' WHERE id = ANY($1::text[])", [videoIds]);
        } else {
          deleted.evaluations = 0;
          deleted.assignments = 0;
        }
        deleted.links = recordCount(await client.query('DELETE FROM share_links'));
      }

      await client.query('COMMIT');
      return { deleted, filesToDelete };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async createUser(input: { name: string; email: string; role: UserRole; department?: string; title?: string; phone?: string }): Promise<User> {
    const result = await this.pool.query(
      `INSERT INTO users (id, name, email, role, department, title, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [randomUUID(), input.name, input.email.toLowerCase(), input.role, input.department || '', input.title || '', input.phone || ''],
    );
    return userFromRow(result.rows[0]);
  }

  async deleteUser(id: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const userResult = await client.query('SELECT role FROM users WHERE id = $1 FOR UPDATE', [id]);
      if (!userResult.rowCount) {
        await client.query('ROLLBACK');
        return false;
      }
      if (userResult.rows[0].role === 'admin') throw new Error('Administrator accounts cannot be deleted here.');
      if (userResult.rows[0].role === 'evaluator') {
        const assignments = await client.query('SELECT 1 FROM assignments WHERE evaluator_id = $1 LIMIT 1', [id]);
        if (assignments.rowCount) throw new Error('This evaluator has assignments. Reassign or complete them before deleting the account.');
        await client.query('DELETE FROM share_links WHERE evaluator_id = $1', [id]);
      }
      await client.query('DELETE FROM users WHERE id = $1', [id]);
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listVideos(filters: { status?: string; evaluatorId?: string; search?: string }): Promise<CandidateVideo[]> {
    const result = await this.pool.query(
      `${videoSelect}
       WHERE ($1::text IS NULL OR v.status = $1)
         AND ($2::text IS NULL OR a.evaluator_id = $2)
         AND ($3::text IS NULL OR v.candidate_name ILIKE '%' || $3 || '%' OR v.candidate_email ILIKE '%' || $3 || '%' OR v.role_applied ILIKE '%' || $3 || '%' OR v.department ILIKE '%' || $3 || '%')
       ORDER BY v.created_at DESC`,
      [filters.status && filters.status !== 'all' ? filters.status : null, filters.evaluatorId || null, filters.search || null],
    );
    return result.rows.map(videoFromRow);
  }

  async listSubmissionPage(filters: SubmissionPageFilters): Promise<SubmissionPage> {
    const values: unknown[] = [];
    const conditions: string[] = [];
    const addFilter = (condition: (placeholder: string) => string, value: unknown) => {
      values.push(value);
      conditions.push(condition(`$${values.length}`));
    };

    if (filters.status && filters.status !== 'all') {
      addFilter((placeholder) => `(
        v.status = ${placeholder}
        OR (${placeholder} = 'awaiting_admin' AND NOT v.admin_confirmed)
        OR (${placeholder} = 'admin_confirmed' AND v.admin_confirmed)
      )`, filters.status);
    }
    if (filters.department && filters.department !== 'all') {
      addFilter((placeholder) => `v.department = ${placeholder}`, filters.department);
    }
    if (filters.search?.trim()) {
      addFilter((placeholder) => `(
        v.candidate_name ILIKE '%' || ${placeholder} || '%'
        OR v.candidate_email ILIKE '%' || ${placeholder} || '%'
        OR v.role_applied ILIKE '%' || ${placeholder} || '%'
        OR v.department ILIKE '%' || ${placeholder} || '%'
        OR COALESCE(v.details->>'submissionId', v.details->>'submissionBatchId', v.id) ILIKE '%' || ${placeholder} || '%'
      )`, filters.search.trim());
    }
    if (filters.reviewStatus && filters.reviewStatus !== 'all') {
      if (filters.reviewStatus === 'ready_to_assign') {
        conditions.push(`v.admin_confirmed = TRUE
          AND v.admin_review_status = 'accepted'
          AND v.status <> 'completed'
          AND NOT EXISTS (SELECT 1 FROM assignments a WHERE a.video_id = v.id)
          AND NOT EXISTS (
            SELECT 1 FROM videos submission_video
            WHERE COALESCE(submission_video.details->>'submissionId', submission_video.details->>'submissionBatchId', submission_video.id)
              = COALESCE(v.details->>'submissionId', v.details->>'submissionBatchId', v.id)
              AND (
                submission_video.admin_confirmed IS DISTINCT FROM TRUE
                OR submission_video.admin_review_status <> 'accepted'
                OR submission_video.status = 'completed'
                OR EXISTS (SELECT 1 FROM assignments submission_assignment WHERE submission_assignment.video_id = submission_video.id)
              )
          )`);
      } else if (filters.reviewStatus === 'assigned') {
        conditions.push('EXISTS (SELECT 1 FROM assignments a WHERE a.video_id = v.id)');
      } else if (filters.reviewStatus === 'unassigned') {
        conditions.push('NOT EXISTS (SELECT 1 FROM assignments a WHERE a.video_id = v.id)');
      } else {
        const reviewStatus = filters.reviewStatus === 'awaiting_review' ? 'pending'
          : filters.reviewStatus === 'approved' ? 'accepted'
          : filters.reviewStatus === 'waiting_reupload' ? 'reupload_requested'
          : null;
        if (reviewStatus) {
          addFilter((placeholder) => `v.admin_review_status = ${placeholder}`, reviewStatus);
        }
      }
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await this.pool.query(
      `SELECT COUNT(*)::int AS total
       FROM (
         SELECT COALESCE(v.details->>'submissionId', v.details->>'submissionBatchId', v.id)
         FROM videos v
         ${whereClause}
         GROUP BY COALESCE(v.details->>'submissionId', v.details->>'submissionBatchId', v.id)
       ) submissions`,
      values,
    );
    const total = Number(countResult.rows[0]?.total || 0);
    const pageValues = [...values, filters.limit, (filters.page - 1) * filters.limit];
    const groupsResult = await this.pool.query(
      `SELECT COALESCE(v.details->>'submissionId', v.details->>'submissionBatchId', v.id) AS submission_id,
              MAX(v.created_at) AS latest_created_at
       FROM videos v
       ${whereClause}
       GROUP BY COALESCE(v.details->>'submissionId', v.details->>'submissionBatchId', v.id)
       ORDER BY latest_created_at DESC, submission_id
       LIMIT $${pageValues.length - 1} OFFSET $${pageValues.length}`,
      pageValues,
    );
    const submissionIds = groupsResult.rows.map((row) => row.submission_id as string);
    if (!submissionIds.length) return { items: [], total };

    const videosResult = await this.pool.query(
      `${videoSelect}
       WHERE COALESCE(v.details->>'submissionId', v.details->>'submissionBatchId', v.id) = ANY($1::text[])
       ORDER BY v.created_at DESC, v.id`,
      [submissionIds],
    );
    return { items: videosResult.rows.map(videoFromRow), total };
  }

  async listVideosBySubmissionBatch(batchId: string): Promise<CandidateVideo[]> {
    const result = await this.pool.query(
      `${videoSelect} WHERE COALESCE(v.details->>'submissionId', v.details->>'submissionBatchId', v.id) = $1 ORDER BY v.created_at DESC`,
      [batchId],
    );
    return result.rows.map(videoFromRow);
  }

  async listReuploadRequests(batchId: string): Promise<CandidateVideo[]> {
    const result = await this.pool.query(
      `${videoSelect}
       WHERE COALESCE(v.details->>'submissionId', v.details->>'submissionBatchId', v.id) = $1 AND v.admin_review_status = 'reupload_requested'
       ORDER BY v.created_at DESC`,
      [batchId],
    );
    return result.rows.map(videoFromRow);
  }

  async listSubmissionVideos(batchId: string): Promise<CandidateVideo[]> {
    const result = await this.pool.query(
      `${videoSelect}
       WHERE COALESCE(v.details->>'submissionId', v.details->>'submissionBatchId', v.id) = $1
       ORDER BY v.created_at, v.id`,
      [batchId],
    );
    return result.rows.map(videoFromRow);
  }

  async getVideo(id: string): Promise<CandidateVideo | null> {
    const result = await this.pool.query(`${videoSelect} WHERE v.id = $1`, [id]);
    return result.rowCount ? videoFromRow(result.rows[0]) : null;
  }

  async reviewVideo(id: string, decision: 'accepted' | 'reupload_requested', feedback: string): Promise<CandidateVideo | null> {
    const result = await this.pool.query(
      `UPDATE videos
       SET admin_confirmed = ($2 = 'accepted'), admin_review_status = $2,
           admin_feedback = $3, admin_reviewed_at = NOW()
       WHERE id = $1 RETURNING id`,
      [id, decision, feedback],
    );
    return result.rowCount ? this.getVideo(id) : null;
  }

  async getVideoFile(id: string): Promise<{ filePath: string; mimeType: string; filename: string } | null> {
    const result = await this.pool.query('SELECT file_path, mime_type, original_filename FROM videos WHERE id = $1', [id]);
    if (!result.rowCount || !result.rows[0].file_path) return null;
    return { filePath: result.rows[0].file_path, mimeType: result.rows[0].mime_type, filename: result.rows[0].original_filename };
  }

  async getVideoDocument(videoId: string, documentId: string): Promise<{ filePath: string; mimeType: string; filename: string } | null> {
    const result = await this.pool.query('SELECT details FROM videos WHERE id = $1', [videoId]);
    const documents = result.rows[0]?.details?.documents;
    if (!Array.isArray(documents)) return null;
    const document = documents.find((item: Record<string, any>) => item.id === documentId);
    if (!document) return null;
    return { filePath: document.filePath, mimeType: document.mimeType, filename: document.originalFilename };
  }

  async listInvites(filters: {
    page: number;
    limit: number;
    type?: string;
    status?: string;
    search?: string;
  }): Promise<{ items: InviteLink[]; total: number }> {
    const values = [
      filters.type && filters.type !== 'all' ? filters.type : null,
      filters.status && filters.status !== 'all' ? filters.status : null,
      filters.search?.trim() || null,
      filters.limit,
      (filters.page - 1) * filters.limit,
    ];
    const where = `($1::text IS NULL OR sl.purpose = CASE WHEN $1 = 'candidate' THEN 'upload' ELSE 'review' END)
      AND ($2::text IS NULL
        OR ($2 = 'active' AND sl.status = 'active' AND sl.expires_at > NOW())
        OR ($2 = 'inactive' AND (sl.status <> 'active' OR sl.expires_at <= NOW())))
      AND ($3::text IS NULL OR sl.recipient_name ILIKE '%' || $3 || '%'
        OR sl.recipient_email ILIKE '%' || $3 || '%'
        OR sl.role_applied ILIKE '%' || $3 || '%'
        OR v.candidate_name ILIKE '%' || $3 || '%')`;
    const [itemsResult, countResult] = await Promise.all([
      this.pool.query(
        `SELECT sl.*, v.candidate_name, u.name AS evaluator_name
         FROM share_links sl LEFT JOIN videos v ON v.id = sl.video_id
         LEFT JOIN users u ON u.id = sl.evaluator_id
         WHERE ${where}
         ORDER BY sl.created_at DESC LIMIT $4 OFFSET $5`,
        values,
      ),
      this.pool.query(
        `SELECT COUNT(*)::int AS total
         FROM share_links sl LEFT JOIN videos v ON v.id = sl.video_id
         WHERE ${where}`,
        values.slice(0, 3),
      ),
    ]);
    return {
      items: itemsResult.rows.map((row) => ({
        ...inviteFromRow(row),
        token: row.token_ciphertext ? this.decryptInviteToken(row.token_ciphertext) : '',
      })),
      total: countResult.rows[0].total,
    };
  }

  async listCandidateUploadLinks(email: string): Promise<InviteLink[]> {
    const result = await this.pool.query(
      `SELECT * FROM share_links
       WHERE purpose = 'upload' AND LOWER(recipient_email) = LOWER($1)
       ORDER BY created_at DESC`,
      [email],
    );
    return result.rows.map((row) => ({ ...inviteFromRow(row), token: '' }));
  }

  async getInviteForNotification(id: string): Promise<InviteLink | null> {
    const result = await this.pool.query(
      `SELECT sl.*, v.candidate_name, u.name AS evaluator_name
       FROM share_links sl
       LEFT JOIN videos v ON v.id = sl.video_id
       LEFT JOIN users u ON u.id = sl.evaluator_id
       WHERE sl.id = $1`,
      [id],
    );
    if (!result.rowCount) return null;
    const row = result.rows[0];
    return {
      ...inviteFromRow(row),
      token: row.token_ciphertext ? this.decryptInviteToken(row.token_ciphertext) : '',
    };
  }

  async createInvite(input: CreateInviteInput): Promise<InviteLink> {
    await this.ensureShareLinkRubricColumn();
    const rubricWeights = input.type === 'evaluator'
      ? (await this.getSystemSettings()).rubricWeights
      : [];
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      let evaluatorId: string | null = null;
      let candidateName: string | null = null;
      let assignedVideoIds: string[] = [];
      const id = randomUUID();
      let submissionId = id;
      const purpose = input.type === 'candidate' ? 'upload' : 'review';

      if (purpose === 'review') {
        if (!input.assignedVideoId) throw new Error('Select a video to assign to the evaluator.');
        const video = await client.query('SELECT candidate_name, details FROM videos WHERE id = $1 FOR UPDATE', [input.assignedVideoId]);
        if (!video.rowCount) throw new Error('The selected video does not exist.');
        const batchId = video.rows[0].details?.submissionId
          || video.rows[0].details?.submissionBatchId
          || input.assignedVideoId;
        submissionId = batchId;
        const submissionVideos = batchId
          ? await client.query(
              `SELECT id, status, admin_confirmed, admin_review_status FROM videos
               WHERE COALESCE(details->>'submissionId', details->>'submissionBatchId', id) = $1 FOR UPDATE`,
              [batchId],
            )
          : await client.query(
              'SELECT id, status, admin_confirmed, admin_review_status FROM videos WHERE id = $1 FOR UPDATE',
              [input.assignedVideoId],
            );
        if (submissionVideos.rows.some((item) => !item.admin_confirmed || item.admin_review_status !== 'accepted')) {
          throw new Error('Approve every video in this candidate upload before assigning it to a Manager / Employer.');
        }
        if (submissionVideos.rows.some((item) => item.status === 'completed')) throw new Error('This submission has already been reviewed.');
        assignedVideoIds = submissionVideos.rows.map((item) => item.id);
        const existingAssignments = await client.query(
          'SELECT 1 FROM assignments WHERE video_id = ANY($1::text[]) LIMIT 1',
          [assignedVideoIds],
        );
        if (existingAssignments.rowCount) throw new Error('This submission has already been assigned to a Manager / Employer.');
        candidateName = video.rows[0].candidate_name;

        const existingEvaluator = input.recipientEmail
          ? await client.query("SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND role = 'evaluator'", [input.recipientEmail])
          : { rowCount: 0, rows: [] };
        if (existingEvaluator.rowCount) {
          evaluatorId = existingEvaluator.rows[0].id;
          await client.query('UPDATE users SET name = $2, department = $3 WHERE id = $1', [evaluatorId, input.recipientName, input.department]);
        } else {
          evaluatorId = randomUUID();
          await client.query(
            `INSERT INTO users (id, name, email, role, department, title)
             VALUES ($1, $2, $3, 'evaluator', $4, 'Evaluator')`,
            [evaluatorId, input.recipientName, input.recipientEmail.toLowerCase(), input.department],
          );
        }
      }

      const result = await client.query(
        `INSERT INTO share_links (id, submission_id, token_hash, token_ciphertext, token_preview, purpose, recipient_name, recipient_email,
           role_applied, department, video_id, evaluator_id, notes, created_by, expires_at, rubric_weights)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING *`,
        [id, submissionId, input.tokenHash, input.tokenCiphertext, input.tokenPreview, purpose, input.recipientName, input.recipientEmail,
          input.roleApplied, input.department, input.assignedVideoId || null, evaluatorId,
          input.notes, input.createdBy, input.expiresAt, JSON.stringify(rubricWeights)],
      );

      if (purpose === 'review') {
        for (const videoId of assignedVideoIds) {
          await client.query(
          `INSERT INTO assignments (id, video_id, evaluator_id, share_link_id, status)
           VALUES ($1, $2, $3, $4, 'assigned')`,
            [randomUUID(), videoId, evaluatorId, id],
          );
        }
        await client.query("UPDATE videos SET status = 'in_review' WHERE id = ANY($1::text[])", [assignedVideoIds]);
      }

      await client.query('COMMIT');
      return inviteFromRow({ ...result.rows[0], candidate_name: candidateName }, input.tokenPreview);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findInvite(tokenHash: string): Promise<ShareLinkRecord | null> {
    await this.ensureShareLinkRubricColumn();
    const result = await this.pool.query(
      `SELECT sl.*, v.candidate_name, u.name AS evaluator_name
       FROM share_links sl LEFT JOIN videos v ON v.id = sl.video_id
       LEFT JOIN users u ON u.id = sl.evaluator_id WHERE sl.token_hash = $1`,
      [tokenHash],
    );
    if (!result.rowCount) return null;
    const link = result.rows[0] as ShareLinkRecord;
    if (link.status === 'active' && new Date(link.expires_at) > new Date()) {
      await this.pool.query('UPDATE share_links SET access_count = access_count + 1 WHERE id = $1', [link.id]);
      link.access_count += 1;
    }
    return link;
  }

  async getAssignedVideo(link: ShareLinkRecord): Promise<CandidateVideo | null> {
    if (!link.video_id) return null;
    return this.getVideo(link.video_id);
  }

  async getAssignedVideos(link: ShareLinkRecord): Promise<CandidateVideo[]> {
    if (link.purpose !== 'review') return [];
    const result = await this.pool.query(
      `${videoSelect}
       JOIN assignments batch_assignment ON batch_assignment.video_id = v.id
       WHERE batch_assignment.share_link_id = $1
       ORDER BY v.created_at, v.id`,
      [link.id],
    );
    return result.rows.map(videoFromRow);
  }

  async createCandidateVideos(tokenHash: string, input: UploadInput): Promise<CandidateVideo[]> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const linkResult = await client.query(
        "SELECT * FROM share_links WHERE token_hash = $1 FOR UPDATE",
        [tokenHash],
      );
      const link = linkResult.rows[0] as ShareLinkRecord | undefined;
      if (!link || link.purpose !== 'upload' || link.status !== 'active' || new Date(link.expires_at) <= new Date()) {
        throw new Error('This upload link is invalid, expired, or already used.');
      }

      await client.query(
        `INSERT INTO users (id, name, email, role, department, title)
         VALUES ($1, $2, $3, 'candidate', $4, $5)
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, department = EXCLUDED.department
         WHERE users.role = 'candidate'`,
        [randomUUID(), input.candidateName, input.candidateEmail.toLowerCase(), input.department || link.department, `Applicant for ${input.roleApplied || link.role_applied}`],
      );

      const videoIds: string[] = [];
      for (const video of input.videos) {
        const id = randomUUID();
        videoIds.push(id);
        await client.query(
          `INSERT INTO videos (id, candidate_name, candidate_email, role_applied, department, file_path,
             original_filename, mime_type, details)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [id, input.candidateName, input.candidateEmail, input.roleApplied || link.role_applied,
            input.department || link.department, video.filePath, video.originalFilename, video.mimeType,
            JSON.stringify({
              bio: input.bio,
              keySkills: input.keySkills,
              submissionType: input.submissionType,
              submissionBatchId: link.submission_id,
              submissionId: link.submission_id,
              documents: input.documents.map((document) => ({ ...document, adminReviewStatus: 'pending', adminFeedback: '' })),
            })],
        );
      }
      await client.query("UPDATE share_links SET status = 'used' WHERE id = $1", [link.id]);
      await client.query('COMMIT');
      return Promise.all(videoIds.map(async (id) => (await this.getVideo(id))!));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async replaceRequestedVideo(tokenHash: string, videoId: string, video: UploadInput['videos'][number], documents: UploadInput['documents']): Promise<CandidateVideo> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const linkResult = await client.query('SELECT * FROM share_links WHERE token_hash = $1 FOR UPDATE', [tokenHash]);
      const link = linkResult.rows[0] as ShareLinkRecord | undefined;
      if (!link || link.purpose !== 'upload' || link.status !== 'used') throw new Error('This reupload link is invalid.');

      const videoResult = await client.query(
        'SELECT details, admin_review_status, admin_feedback FROM videos WHERE id = $1 FOR UPDATE',
        [videoId],
      );
      const details = videoResult.rows[0]?.details || {};
      if (!videoResult.rowCount || (details.submissionId || details.submissionBatchId) !== link.submission_id) {
        throw new Error('This video does not have an active reupload request.');
      }

      const assignmentResult = await client.query(
        `SELECT a.id AS assignment_id, a.evaluator_id, u.name AS evaluator_name,
                e.scores, e.overall_score, e.decision, e.notes, e.extra, e.submitted_at
         FROM assignments a
         JOIN users u ON u.id = a.evaluator_id
         LEFT JOIN evaluations e ON e.assignment_id = a.id
         WHERE a.video_id = $1
         FOR UPDATE OF a`,
        [videoId],
      );
      const managerRejection = assignmentResult.rows.find((row) => row.decision === 'rejected' || row.decision === 'reject');
      const adminRequestedReupload = videoResult.rows[0].admin_review_status === 'reupload_requested';
      if (!adminRequestedReupload && !managerRejection) {
        throw new Error('This video does not have an active reupload request.');
      }

      const priorEvaluationHistory = managerRejection
        ? [...(Array.isArray(details.evaluationHistory) ? details.evaluationHistory : []), {
            evaluatorId: managerRejection.evaluator_id,
            evaluatorName: managerRejection.evaluator_name,
            evaluatedAt: managerRejection.submitted_at ? new Date(managerRejection.submitted_at).toISOString() : new Date().toISOString(),
            overallScore: Number(managerRejection.overall_score || 0),
            scores: managerRejection.scores || {},
            decision: managerRejection.decision,
            notes: managerRejection.notes || '',
            aiSummary: managerRejection.extra?.aiSummary,
            keyStrengths: managerRejection.extra?.keyStrengths,
            areasToImprove: managerRejection.extra?.areasToImprove,
            rubricWeights: managerRejection.extra?.rubricWeights,
          }]
        : Array.isArray(details.evaluationHistory) ? details.evaluationHistory : [];

      const nextDocuments = documents.length > 0
        ? documents.map((document) => ({ ...document, adminReviewStatus: 'pending', adminFeedback: '' }))
        : details.documents || [];
      if (managerRejection) {
        await client.query('DELETE FROM evaluations WHERE assignment_id = $1', [managerRejection.assignment_id]);
        await client.query('DELETE FROM assignments WHERE id = $1', [managerRejection.assignment_id]);
      }
      await client.query(
        `UPDATE videos
         SET file_path = $2, original_filename = $3, mime_type = $4, status = 'pending',
             admin_confirmed = FALSE, admin_review_status = 'pending', admin_feedback = '',
             admin_reviewed_at = NULL,
             details = $5
         WHERE id = $1`,
        [videoId, video.filePath, video.originalFilename, video.mimeType, JSON.stringify({
          ...details,
          wasReuploaded: true,
          adminPreviousFeedback: videoResult.rows[0].admin_feedback || details.adminPreviousFeedback || '',
          evaluationHistory: priorEvaluationHistory,
          documents: nextDocuments,
        })],
      );
      await client.query('COMMIT');
      return (await this.getVideo(videoId))!;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async submitEvaluation(tokenHash: string, input: EvaluationInput): Promise<CandidateVideo> {
    await this.ensureShareLinkRubricColumn();
    await this.ensureEvaluationDecisionConstraint();
    const currentRubricWeights = (await this.getSystemSettings()).rubricWeights;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const linkResult = await client.query(
        "SELECT * FROM share_links WHERE token_hash = $1 FOR UPDATE",
        [tokenHash],
      );
      const link = linkResult.rows[0] as ShareLinkRecord | undefined;
      if (!link || link.purpose !== 'review' || link.status !== 'active' || new Date(link.expires_at) <= new Date()) {
        throw new Error('This review link is invalid, expired, or already submitted.');
      }
      const rubricWeights = Array.isArray(link.rubric_weights) && link.rubric_weights.length
        ? link.rubric_weights
        : currentRubricWeights;
      const scoreIds = Object.keys(input.scores || {});
      if (
        scoreIds.length !== rubricWeights.length
        || rubricWeights.some((criterion) => !Object.prototype.hasOwnProperty.call(input.scores, criterion.id))
      ) {
        throw new Error('The evaluation rubric for this assignment is unavailable. Refresh the assignment before submitting.');
      }

      const assignmentResult = await client.query(
        "SELECT id, video_id FROM assignments WHERE share_link_id = $1 AND evaluator_id = $2 AND status <> 'completed' ORDER BY video_id FOR UPDATE",
        [link.id, link.evaluator_id],
      );
      if (!assignmentResult.rowCount || !assignmentResult.rows.some((assignment) => assignment.video_id === input.videoId)) {
        throw new Error('No active assignment exists for this video and review link.');
      }

      const scores = input.scores;
      const overallScore = Math.round(
        rubricWeights.reduce((total, criterion) => total + scores[criterion.id] * criterion.weight, 0) / 5,
      );
      const evaluationValues = JSON.stringify({
        aiSummary: input.aiSummary,
        keyStrengths: input.keyStrengths,
        areasToImprove: input.areasToImprove,
        rubricWeights,
      });
      for (const assignment of assignmentResult.rows) {
        await client.query(
          `INSERT INTO evaluations (id, assignment_id, scores, overall_score, decision, notes, extra)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [randomUUID(), assignment.id, JSON.stringify(scores), overallScore,
            input.decision, input.notes, evaluationValues],
        );
      }
      await client.query(
        "UPDATE assignments SET status = 'completed', completed_at = NOW() WHERE share_link_id = $1 AND status <> 'completed'",
        [link.id],
      );
      await client.query(
        "UPDATE videos SET status = 'completed' WHERE id = ANY($1::text[])",
        [assignmentResult.rows.map((assignment) => assignment.video_id)],
      );
      await client.query("UPDATE share_links SET status = 'used' WHERE id = $1", [link.id]);
      await client.query('COMMIT');
      return (await this.getVideo(input.videoId))!;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async dashboardCounts(): Promise<{
    totalUsers: number;
    videosUploaded: number;
    pendingAssignments: number;
    completedEvals: number;
    totalEvaluators: number;
    candidatePendingCount: number;
    employerPendingCount: number;
  }> {
    const result = await this.pool.query(
      `SELECT (SELECT COUNT(*)::int FROM users) AS total_users,
              (SELECT COUNT(*)::int FROM videos) AS videos_uploaded,
              (SELECT COUNT(*)::int FROM assignments WHERE status <> 'completed') AS pending_assignments,
              (SELECT COUNT(*)::int FROM evaluations) AS completed_evals,
              (SELECT COUNT(*)::int FROM users WHERE role = 'evaluator') AS total_evaluators,
              (SELECT COUNT(*)::int FROM (
                 SELECT submission_id FROM share_links
                 WHERE purpose = 'upload' AND status = 'active' AND expires_at > NOW()
                 UNION
                 SELECT COALESCE(details->>'submissionId', details->>'submissionBatchId', id)
                 FROM videos WHERE admin_review_status = 'reupload_requested'
               ) candidate_pending) AS candidate_pending_count,
              (SELECT COUNT(DISTINCT COALESCE(v.details->>'submissionId', v.details->>'submissionBatchId', v.id))::int
               FROM assignments a JOIN videos v ON v.id = a.video_id
               WHERE a.status <> 'completed') AS employer_pending_count`,
    );
    const row = result.rows[0];
    return {
      totalUsers: row.total_users,
      videosUploaded: row.videos_uploaded,
      pendingAssignments: row.pending_assignments,
      completedEvals: row.completed_evals,
      totalEvaluators: row.total_evaluators,
      candidatePendingCount: row.candidate_pending_count,
      employerPendingCount: row.employer_pending_count,
    };
  }

  async markInviteRevoked(id: string): Promise<boolean> {
    const result = await this.pool.query("UPDATE share_links SET status = 'revoked' WHERE id = $1 AND status = 'active'", [id]);
    return Boolean(result.rowCount);
  }

  async extendInviteExpiry(id: string, expiresAt: Date): Promise<boolean> {
    const result = await this.pool.query(
      "UPDATE share_links SET expires_at = $2 WHERE id = $1 AND status = 'active'",
      [id, expiresAt],
    );
    return Boolean(result.rowCount);
  }
}