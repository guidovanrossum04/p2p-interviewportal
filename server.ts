import express from "express";
import path from "path";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import nodemailer from "nodemailer";
import { initialStats, initialUsers, initialVideos, initialActivities, initialSettings, initialInviteLinks } from "./src/data/mockData";
import { CandidateVideo, User, ActivityItem, SystemSettings, InviteLink } from "./src/types";
import { databaseEnabled } from "./src/server/db/database";
import { createPortalRouter } from "./src/server/routes/portalRoutes";
import { attachAdminNotificationSocket, closeAdminSession } from "./src/server/services/AdminNotificationHub";

let currentStats = { ...initialStats };
let currentUsers: User[] = [...initialUsers];
let currentVideos: CandidateVideo[] = [...initialVideos];
let currentActivities: ActivityItem[] = [...initialActivities];
let currentSettings: SystemSettings = { ...initialSettings };
let currentInviteLinks: InviteLink[] = [...initialInviteLinks];

const ADMIN_EMAIL = 'p2precruitment2025@gmail.com';
const ADMIN_PASSWORD = 'Sachin@99#';
const adminSessions = new Map<string, number>();

// Optional lazy Gemini client
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    try {
      geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    } catch (e) {
      console.warn("Failed to initialize GoogleGenAI client:", e);
    }
  }
  return geminiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  if (databaseEnabled) {
    app.use("/api", createPortalRouter());
  }

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.post('/api/auth/admin/login', (req, res) => {
    const { email, password } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedPassword = String(password || '');

    if (normalizedEmail !== ADMIN_EMAIL.toLowerCase() || normalizedPassword !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid admin credentials.' });
    }

    const sessionToken = randomUUID();
    adminSessions.set(sessionToken, Date.now() + 12 * 60 * 60 * 1000);
    return res.json({
      success: true,
      sessionToken,
      user: {
        id: 'usr-admin-recruitment',
        name: 'P2P Admin',
        email: ADMIN_EMAIL,
        role: 'admin',
      },
    });
  });

  app.post('/api/auth/admin/session', (req, res) => {
    const sessionToken = String(req.body?.sessionToken || '');
    const expiresAt = adminSessions.get(sessionToken);
    if (!expiresAt || expiresAt <= Date.now()) {
      adminSessions.delete(sessionToken);
      return res.status(401).json({ error: 'Admin session expired. Please sign in again.' });
    }
    return res.json({
      success: true,
      expiresAt,
      user: {
        id: 'usr-admin-recruitment',
        name: 'P2P Admin',
        email: ADMIN_EMAIL,
        role: 'admin',
      },
    });
  });

  app.post('/api/auth/admin/logout', (req, res) => {
    const sessionToken = String(req.body?.sessionToken || '');
    adminSessions.delete(sessionToken);
    closeAdminSession(sessionToken);
    res.json({ success: true });
  });

  // Stats
  app.get("/api/stats", (req, res) => {
    const pending = currentVideos.filter(v => v.status === 'pending' || v.status === 'in_review').length;
    const completed = currentVideos.filter(v => v.status === 'completed').length;
    const total = currentVideos.length;
    const completionRate = total > 0 ? `${Math.round((completed / total) * 100)}% completion rate` : '100% completion rate';

    res.json({
      ...currentStats,
      videosUploaded: currentStats.videosUploaded + (currentVideos.length - initialVideos.length),
      pendingAssignments: currentStats.pendingAssignments + (pending - 2),
      completedEvals: currentStats.completedEvals + (completed - 2),
      completionRate,
    });
  });

  // Evaluator specific stats
  app.get("/api/evaluator/:id/stats", (req, res) => {
    const evaluatorId = req.params.id;
    const assigned = currentVideos.filter(v => v.assignedEvaluatorId === evaluatorId);
    const pending = assigned.filter(v => v.status === 'pending' || v.status === 'in_review').length;
    const completed = assigned.filter(v => v.status === 'completed').length;

    res.json({
      totalAssigned: assigned.length || 24,
      pendingReview: pending || 8,
      completed: completed || 16,
    });
  });

  // Videos
  app.get("/api/videos", (req, res) => {
    const { status, evaluatorId, search, page, limit } = req.query;
    let results = [...currentVideos];

    if (status && typeof status === 'string' && status !== 'all') {
      results = results.filter(v => v.status === status);
    }

    if (evaluatorId && typeof evaluatorId === 'string') {
      results = results.filter(v => v.assignedEvaluatorId === evaluatorId);
    }

    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      results = results.filter(v => 
        v.candidateName.toLowerCase().includes(q) || 
        v.roleApplied.toLowerCase().includes(q) || 
        v.department.toLowerCase().includes(q)
      );
    }

    const pageNumber = Number(page) > 0 ? Number(page) : 1;
    const pageLimit = Number(limit) > 0 ? Number(limit) : 0;
    if (pageLimit > 0) {
      const total = results.length;
      const start = (pageNumber - 1) * pageLimit;
      return res.json({ items: results.slice(start, start + pageLimit), page: pageNumber, limit: pageLimit, total });
    }

    res.json(results);
  });

  app.get("/api/videos/:id", (req, res) => {
    const video = currentVideos.find(v => v.id === req.params.id);
    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }
    res.json(video);
  });

  app.get('/api/users', (req, res) => {
    const { page, limit } = req.query;
    const pageNumber = Number(page) > 0 ? Number(page) : 1;
    const pageLimit = Number(limit) > 0 ? Number(limit) : 0;

    if (pageLimit > 0) {
      const start = (pageNumber - 1) * pageLimit;
      const total = currentUsers.length;
      return res.json({ items: currentUsers.slice(start, start + pageLimit), page: pageNumber, limit: pageLimit, total });
    }

    res.json(currentUsers);
  });

  // Batch upload
  app.post("/api/videos/batch-upload", (req, res) => {
    const { batchName, roleApplied, department, candidates, assignedEvaluatorId } = req.body;
    const evaluator = currentUsers.find(u => u.id === assignedEvaluatorId) || currentUsers.find(u => u.role === 'evaluator');

    const createdVideos: CandidateVideo[] = (candidates || []).map((cand: { name: string; email: string }, idx: number) => {
      const vidId = `vid-${Date.now()}-${idx}`;
      return {
        id: vidId,
        candidateName: cand.name || `Candidate #${idx + 1}`,
        candidateEmail: cand.email || `candidate${idx + 1}@example.com`,
        roleApplied: roleApplied || 'Software Engineer',
        department: department || 'Engineering',
        submittedAt: new Date().toISOString(),
        submittedTimeAgo: 'Just now',
        status: 'pending',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=600',
        videoDuration: '05:00',
        durationSeconds: 300,
        batchName: batchName || 'New Batch Ingestion',
        assignedEvaluatorId: evaluator?.id || 'usr-1',
        assignedEvaluatorName: evaluator?.name || 'Sarah Jenkins',
        experienceYears: 4 + idx,
        questions: [
          {
            id: `q-${vidId}-1`,
            timestamp: 0,
            timestampStr: '00:00',
            question: 'Introduce yourself and highlight your most challenging recent technical accomplishment.',
            transcriptSnippet: 'Hello, in my recent role I spearheaded the migration of monolithic workflows...',
          },
          {
            id: `q-${vidId}-2`,
            timestamp: 90,
            timestampStr: '01:30',
            question: 'How do you handle unexpected system downtime and team coordination under pressure?',
            transcriptSnippet: 'My first priority is triage and mitigation, followed by clear stakeholder communication...',
          }
        ]
      };
    });

    currentVideos = [...createdVideos, ...currentVideos];

    const newActivity: ActivityItem = {
      id: `act-${Date.now()}`,
      type: 'batch_upload',
      title: `Batch upload completed: ${batchName || 'New Batch'} (${createdVideos.length} videos).`,
      description: `Batch upload completed: ${batchName || 'New Batch'} (${createdVideos.length} videos).`,
      timestamp: new Date().toISOString(),
      timeAgo: 'Just now',
      icon: 'upload_file',
    };
    currentActivities = [newActivity, ...currentActivities];

    res.json({ success: true, count: createdVideos.length, videos: createdVideos });
  });

  // Evaluate candidate video
  app.post("/api/evaluate", (req, res) => {
    const { videoId, evaluatorId, evaluatorName, scores, decision, notes, aiSummary, keyStrengths, areasToImprove } = req.body;
    const videoIndex = currentVideos.findIndex(v => v.id === videoId);
    if (videoIndex === -1) {
      return res.status(404).json({ error: "Video not found" });
    }

    const rubricWeights = currentSettings.rubricWeights;
    const normalizedScores = Object.fromEntries(rubricWeights.map((criterion) => [
      criterion.id,
      Number.isInteger(scores?.[criterion.id]) ? scores[criterion.id] : 4,
    ]));
    const overallScore = Math.round(
      rubricWeights.reduce((total, criterion) => total + normalizedScores[criterion.id] * criterion.weight, 0) / 5,
    );
    const normalizedDecision: 'selected' | 'rejected' = decision === 'rejected' ? 'rejected' : 'selected';

    const evaluation = {
      evaluatorId: evaluatorId || 'usr-1',
      evaluatorName: evaluatorName || 'Sarah Jenkins',
      evaluatedAt: new Date().toISOString(),
      overallScore,
      scores: normalizedScores,
      rubricWeights,
      decision: normalizedDecision,
      notes: notes || 'Candidate showed strong competency across rubrics.',
      aiSummary: aiSummary || undefined,
      keyStrengths: keyStrengths || undefined,
      areasToImprove: areasToImprove || undefined,
    };

    currentVideos[videoIndex] = {
      ...currentVideos[videoIndex],
      status: 'completed',
      evaluation,
    };

    const newActivity: ActivityItem = {
      id: `act-${Date.now()}`,
      type: 'evaluation',
      title: `${evaluatorName || 'Evaluator'} completed evaluation for ${currentVideos[videoIndex].candidateName}.`,
      description: `completed evaluation for candidate #${videoId.replace('vid-', '')}.`,
      timestamp: new Date().toISOString(),
      timeAgo: 'Just now',
      badge: 'Completed',
      badgeType: 'success',
      icon: 'gavel',
    };
    currentActivities = [newActivity, ...currentActivities];

    res.json({ success: true, video: currentVideos[videoIndex] });
  });

  // Gemini AI Analysis Assistance
  app.post("/api/ai/evaluate-summary", async (req, res) => {
    const { candidateName, roleApplied, notes, scores, transcript } = req.body;
    const ai = getGeminiClient();

    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `You are an executive HR talent evaluation assistant for InterviewPro. 
Analyze this candidate video interview assessment:
Candidate: ${candidateName}
Role Applied: ${roleApplied}
Scores (1-5): Communication: ${scores?.communication}, Technical: ${scores?.technical}, Problem Solving: ${scores?.problemSolving}, Culture: ${scores?.cultureFit}
Evaluator Raw Notes: ${notes}
Interview Snippets: ${transcript || 'Standard structured competency questions.'}

Return a concise JSON object in this exact format:
{
  "summary": "2 concise sentences summarizing the candidate fit and demeanor.",
  "keyStrengths": ["Strength 1", "Strength 2", "Strength 3"],
  "areasToImprove": ["Area 1", "Area 2"]
}`
        });

        const text = response.text || "";
        // Clean markdown backticks if any
        const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
        try {
          const parsed = JSON.parse(cleaned);
          return res.json(parsed);
        } catch {
          return res.json({
            summary: text.slice(0, 200),
            keyStrengths: ["High technical articulation", "Structured problem breakdown", "Strong collaborative mindset"],
            areasToImprove: ["Deeper explanation of edge-case handling"]
          });
        }
      } catch (err) {
        console.error("Gemini API generation error:", err);
      }
    }

    // Heuristic fallback if Gemini API is offline or not configured
    const avgScore = ((scores?.communication || 4) + (scores?.technical || 4) + (scores?.problemSolving || 4) + (scores?.cultureFit || 4)) / 4;
    res.json({
      summary: `${candidateName} demonstrates robust foundational mastery for the ${roleApplied} position with clear communication and structured thinking.`,
      keyStrengths: [
        scores?.technical >= 4 ? "Solid domain engineering depth" : "Good conceptual clarity",
        scores?.communication >= 4 ? "Crisp and engaging communication" : "Direct response style",
        "Clear alignment with organizational standards and team practices"
      ],
      areasToImprove: [
        scores?.problemSolving < 4 ? "Could provide more structured breakdown on ambiguity" : "Further quantify past project metrics",
        "Elaborate on cross-functional conflict resolution"
      ]
    });
  });

  // Users & Evaluators
  app.get("/api/users", (req, res) => {
    const { role } = req.query;
    if (role && typeof role === 'string') {
      return res.json(currentUsers.filter(u => u.role === role));
    }
    res.json(currentUsers);
  });

  app.post("/api/users", (req, res) => {
    const { name, email, role, department, title, phone } = req.body;
    const newUser: User = {
      id: `usr-${Date.now()}`,
      name: name || 'New Team Member',
      email: email || 'user@company.com',
      role: role || 'evaluator',
      avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256`,
      status: 'active',
      department: department || 'General',
      title: title || (role === 'evaluator' ? 'Evaluator' : 'User'),
      phone: phone || '',
      assignedCount: 0,
      completedCount: 0,
      lastActive: 'Just now',
    };
    currentUsers = [newUser, ...currentUsers];

    const newActivity: ActivityItem = {
      id: `act-${Date.now()}`,
      type: 'registration',
      title: `${newUser.name} registered as a new ${newUser.role}.`,
      description: `registered as a new ${newUser.role}.`,
      timestamp: new Date().toISOString(),
      timeAgo: 'Just now',
      icon: 'person_add',
    };
    currentActivities = [newActivity, ...currentActivities];

    res.json(newUser);
  });

  app.delete("/api/users/:id", (req, res) => {
    const user = currentUsers.find((item) => item.id === req.params.id);
    if (!user) return res.status(404).json({ error: "User not found." });
    if (user.role === 'admin') return res.status(409).json({ error: 'Administrator accounts cannot be deleted here.' });
    if (user.role === 'evaluator' && currentVideos.some((video) => video.assignedEvaluatorId === user.id)) {
      return res.status(409).json({ error: 'This evaluator has assignments. Reassign or complete them before deleting the account.' });
    }
    currentUsers = currentUsers.filter((item) => item.id !== user.id);
    res.json({ success: true });
  });

  // Activities
  app.get("/api/activities", (req, res) => {
    res.json(currentActivities);
  });

  // Settings
  app.get("/api/settings", (req, res) => {
    res.json(currentSettings);
  });

  app.put("/api/settings", (req, res) => {
    const { smtpPassword: _smtpPassword, ...settings } = req.body || {};
    currentSettings = { ...currentSettings, ...settings, smtpPasswordConfigured: false };
    res.json(currentSettings);
  });

  app.post("/api/settings/email/test", async (req, res) => {
    const { recipient, smtpPassword, ...settings } = req.body || {};
    if (typeof recipient !== 'string' || !/^\S+@\S+\.\S+$/.test(recipient)) {
      return res.status(400).json({ error: 'Enter a valid test recipient email.' });
    }
    if (!settings.smtpHost || !settings.smtpUsername || !smtpPassword || !settings.smtpFromAddress) {
      return res.status(400).json({ error: 'Configure SMTP host, username, password, and sender address first.' });
    }
    try {
      const transport = nodemailer.createTransport({
        host: settings.smtpHost,
        port: Number(settings.smtpPort),
        secure: Boolean(settings.smtpSecure),
        auth: { user: settings.smtpUsername, pass: smtpPassword },
      });
      await transport.sendMail({
        from: { name: settings.smtpFromName || 'P2P Recruitment', address: settings.smtpFromAddress },
        to: recipient,
        subject: 'P2P Recruitment SMTP test',
        text: 'SMTP delivery is configured correctly.',
      });
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Could not send the test email.' });
    }
  });

  // Shareable Invites & Access Links
  app.get("/api/invites", (req, res) => {
    const page = Number(req.query.page) > 0 ? Number(req.query.page) : 1;
    const limit = Math.min(50, Number(req.query.limit) > 0 ? Number(req.query.limit) : 10);
    const type = typeof req.query.type === 'string' ? req.query.type : 'all';
    const status = typeof req.query.status === 'string' ? req.query.status : 'all';
    const search = typeof req.query.search === 'string' ? req.query.search.toLowerCase() : '';
    const filtered = currentInviteLinks.filter((link) => {
      const isExpired = new Date(link.expiresAt) <= new Date();
      const isActive = link.status === 'active' && !isExpired;
      return (type === 'all' || link.type === type)
        && (status === 'all' || (status === 'active' ? isActive : !isActive))
        && (!search || [link.recipientName, link.recipientEmail, link.roleApplied || '', link.assignedCandidateName || '']
          .some((value) => value.toLowerCase().includes(search)));
    });
    res.json({
      items: filtered.slice((page - 1) * limit, page * limit).map((link) => ({ ...link, token: '' })),
      total: filtered.length,
      page,
      limit,
    });
  });

  app.post("/api/invites", (req, res) => {
    const { type, recipientName, recipientEmail, roleApplied, department, assignedVideoId, expiresInHours = 48, notes, createdBy } = req.body;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const token = type === 'candidate' ? `INV-CAND-${randomSuffix}` : `INV-EVAL-${randomSuffix}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (Number(expiresInHours) || 48) * 3600000).toISOString();

    let assignedCandidateName: string | undefined;
    if (assignedVideoId) {
      const v = currentVideos.find(v => v.id === assignedVideoId);
      if (v) assignedCandidateName = v.candidateName;
    }
    if (type === 'evaluator' && assignedVideoId) {
      const selectedVideo = currentVideos.find((video) => video.id === assignedVideoId);
      if (!selectedVideo?.adminConfirmed || selectedVideo.status === 'completed' || selectedVideo.assignedEvaluatorId) {
        return res.status(409).json({ error: 'Select an unassigned video that has been approved by the administrator.' });
      }
      const submissionBatchId = selectedVideo.submissionBatchId;
      const batchVideos = submissionBatchId
        ? currentVideos.filter((video) => video.submissionBatchId === submissionBatchId)
        : [selectedVideo];
      if (batchVideos.some((video) => !video.adminConfirmed || video.adminReviewStatus !== 'accepted')) {
        return res.status(409).json({ error: 'Approve every video in this candidate upload before assigning it to a Manager / Employer.' });
      }
    }

    const newInvite: InviteLink = {
      id: `inv-${Date.now()}`,
      token,
      type: type || 'candidate',
      title: type === 'candidate' ? 'Candidate Self-Intro Video Upload Invite' : 'Technical Video Evaluation Assignment Link',
      recipientName: recipientName || (type === 'candidate' ? 'Invited Candidate' : 'Assigned Evaluator'),
      recipientEmail: recipientEmail || '',
      roleApplied: roleApplied || 'Candidate Assessment',
      department: department || 'Engineering',
      assignedVideoId: assignedVideoId || undefined,
      assignedCandidateName,
      status: 'active',
      createdAt: now.toISOString(),
      expiresAt,
      expiresInHours: Number(expiresInHours) || 48,
      createdBy: createdBy || 'Admin',
      notes: notes || '',
      accessCount: 0,
    };

    currentInviteLinks = [newInvite, ...currentInviteLinks];
    if (newInvite.type === 'evaluator' && newInvite.assignedVideoId) {
      const evaluator = currentUsers.find((user) => user.email.toLowerCase() === newInvite.recipientEmail.toLowerCase());
      currentVideos = currentVideos.map((video) => video.id === newInvite.assignedVideoId
        ? {
            ...video,
            assignedEvaluatorId: evaluator?.id,
            assignedEvaluatorName: evaluator?.name || newInvite.recipientName,
            status: 'in_review',
          }
        : video);
    }

    const newActivity: ActivityItem = {
      id: `act-${Date.now()}`,
      type: 'assignment',
      title: `Admin created ${newInvite.type === 'candidate' ? 'candidate upload link' : 'evaluator review link'} for ${newInvite.recipientName}.`,
      description: `Generated secure access link token ${newInvite.token}.`,
      timestamp: new Date().toISOString(),
      timeAgo: 'Just now',
      icon: 'link',
    };
    currentActivities = [newActivity, ...currentActivities];

    res.json(newInvite);
  });

  app.get("/api/invites/validate/:token", (req, res) => {
    const token = req.params.token.trim().toUpperCase();
    const invite = currentInviteLinks.find(i => i.token.toUpperCase() === token);
    if (!invite) {
      return res.status(404).json({ valid: false, error: "Invalid invitation token or link." });
    }
    if (invite.status === 'revoked') {
      return res.status(403).json({ valid: false, error: "This invitation link has been revoked by the administrator." });
    }
    if (invite.type !== 'candidate' && new Date(invite.expiresAt) < new Date()) {
      return res.status(410).json({ valid: false, error: "This invitation link has expired." });
    }

    // Increment access count
    invite.accessCount = (invite.accessCount || 0) + 1;
    const uploadLinks = invite.type === 'candidate'
      ? currentInviteLinks
          .filter((item) => item.type === 'candidate' && item.recipientEmail.toLowerCase() === invite.recipientEmail.toLowerCase())
          .map((item) => ({ ...item, token: '' }))
      : [];
    res.json({ valid: true, invite, videos: [], uploadLinks });
  });

  app.post("/api/invites/:id/revoke", (req, res) => {
    const invite = currentInviteLinks.find(i => i.id === req.params.id);
    if (!invite) {
      return res.status(404).json({ error: "Invite link not found" });
    }
    invite.status = 'revoked';
    res.json({ success: true, invite });
  });

  // Vite middleware in dev / static in prod
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = createServer(app);
  attachAdminNotificationSocket(server, (sessionToken) => {
    const expiresAt = adminSessions.get(sessionToken);
    if (!expiresAt) return undefined;
    if (expiresAt <= Date.now()) {
      adminSessions.delete(sessionToken);
      return undefined;
    }
    return expiresAt;
  });
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`InterviewPro backend running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
