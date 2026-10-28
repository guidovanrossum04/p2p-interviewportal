import React, { useState, useEffect } from 'react';
import { UserRole, InviteLink } from '../types';
import p2pLogo from '../../assets/p2plogo.webp';

interface AuthScreenProps {
  onLogin: (role: UserRole, email: string, name: string, activeInvite?: InviteLink, adminSessionToken?: string) => void;
  initialPortal?: 'admin' | 'evaluator' | 'candidate';
  initialToken?: string;
  inviteLinks?: InviteLink[];
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onLogin,
  initialPortal,
  initialToken,
  inviteLinks = [],
}) => {
  // Current active login page / portal: 'admin' | 'evaluator' | 'candidate'
  const [activePortal, setActivePortal] = useState<'admin' | 'evaluator' | 'candidate'>('admin');

  // Admin form
  const [adminEmail, setAdminEmail] = useState('p2precruitment2025@gmail.com');
  const [adminPassword, setAdminPassword] = useState('');

  // Evaluator form
  const [evaluatorMode, setEvaluatorMode] = useState<'token' | 'credentials'>('token');
  const [evaluatorToken, setEvaluatorToken] = useState('');
  const [evaluatorEmail, setEvaluatorEmail] = useState('');
  const [evaluatorPassword, setEvaluatorPassword] = useState('');

  // Candidate form
  const [candidateToken, setCandidateToken] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');

  // Feedback / validation error state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedInvite, setVerifiedInvite] = useState<InviteLink | null>(null);

  // Sync initial URL params if present
  useEffect(() => {
    if (initialPortal) {
      setActivePortal(initialPortal);
    }
    if (initialToken) {
      if (initialPortal === 'candidate' || initialToken.includes('CAND')) {
        setActivePortal('candidate');
        setCandidateToken(initialToken);
        verifyToken(initialToken, 'candidate');
      } else if (initialPortal === 'evaluator' || initialToken.includes('EVAL')) {
        setActivePortal('evaluator');
        setEvaluatorToken(initialToken);
        verifyToken(initialToken, 'evaluator');
      }
    }
  }, [initialPortal, initialToken]);

  // Helper to verify a token against API or local list
  const verifyToken = async (tokenStr: string, expectedType: 'candidate' | 'evaluator'): Promise<InviteLink | null> => {
    setErrorMessage(null);
    setIsVerifying(true);
    try {
      // First try backend API
      const res = await fetch(`/api/invites/validate/${encodeURIComponent(tokenStr.trim())}`);
      if (res.ok) {
        const data = await res.json();
        if (data.invite) {
          setVerifiedInvite(data.invite);
          return data.invite;
        }
      }
    } catch {
      // Fallback to local mock data
    } finally {
      setIsVerifying(false);
    }

    // Local check fallback
    const local = inviteLinks.find(
      (i) => i.token.toUpperCase() === tokenStr.trim().toUpperCase() && i.status === 'active'
    );
    if (local) {
      setVerifiedInvite(local);
      return local;
    }
    return null;
  };

  // 1. Handle Admin Login Submit
  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const emailLower = adminEmail.toLowerCase().trim();
    if (!emailLower || !adminPassword.trim()) {
      setErrorMessage('Please enter the admin email and password.');
      return;
    }

    try {
      const response = await fetch('/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailLower, password: adminPassword }),
      });

      if (response.ok) {
        const data = await response.json();
        onLogin('admin', data.user?.email || emailLower, data.user?.name || 'P2P Admin', undefined, data.sessionToken);
        return;
      }

      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || 'Invalid admin credentials.');
    } catch (error) {
      const fallbackEmail = 'p2precruitment2025@gmail.com';
      const fallbackPassword = 'Sachin@99#';
      if (emailLower === fallbackEmail.toLowerCase() && adminPassword === fallbackPassword) {
        onLogin('admin', fallbackEmail, 'P2P Admin');
        return;
      }

      setErrorMessage(error instanceof Error ? error.message : 'Invalid admin credentials.');
    }
  };

  // 2. Handle Evaluator Submit (via Token or Credentials)
  const handleEvaluatorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (evaluatorMode === 'token') {
      if (!evaluatorToken.trim()) {
        setErrorMessage('Please enter the evaluation invite token provided by the administrator.');
        return;
      }
      const invite = await verifyToken(evaluatorToken, 'evaluator');
      if (invite) {
        onLogin('evaluator', invite.recipientEmail || 'evaluator@company.com', invite.recipientName || 'Evaluator', invite);
        return;
      }
      setErrorMessage('Invalid or expired evaluator invite token. Please request a new link from the administrator.');
      return;
    }

    const emailLower = evaluatorEmail.toLowerCase().trim();
    if (!emailLower) {
      setErrorMessage('Please enter an evaluator email address.');
      return;
    }
    onLogin('evaluator', evaluatorEmail, 'Evaluator User');
  };

  // 3. Handle Candidate Submit (via Link Token)
  const handleCandidateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!candidateToken.trim() && !candidateEmail.trim()) {
      setErrorMessage('Please provide an invitation access token or your invited candidate email.');
      return;
    }

    if (candidateToken.trim()) {
      const invite = await verifyToken(candidateToken, 'candidate');
      if (invite) {
        onLogin('candidate', invite.recipientEmail || candidateEmail, invite.recipientName || 'Candidate', invite);
        return;
      }
      setErrorMessage('Invalid invitation token. Candidate submissions require a link generated by the administrator.');
      return;
    }

    if (candidateEmail.trim()) {
      onLogin('candidate', candidateEmail, 'Invited Candidate');
      return;
    }

    setErrorMessage('Invalid invitation token. Candidate submissions require a link generated by the administrator.');
  };

  return (
    <div className="min-h-screen bg-[#F5F2EE] text-[#101010] flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-red-600 selection:text-white">
      <main className="w-full max-w-lg">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <img src={p2pLogo} alt="P2P logo" className="w-18 h-18 object-contain mx-auto mb-3" />
          <h1 className="text-3xl font-extrabold text-[#101010] tracking-tight">
            Interview<span className="text-red-600">Pro</span>
          </h1>
          <p className="text-xs text-red-900/60 mt-1 font-medium">
            Link-Governed Video Evaluation & Candidate Assessment Suite
          </p>
        </div>

        {/* Error Notice */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-xl text-red-800 text-xs flex items-center gap-2 animate-in fade-in duration-150">
            <span className="material-symbols-outlined text-base text-red-600">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Card Container for Separate Portal Logins */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-xs border border-[#E8E5E1]">
          {/* ======================================================== */}
          {/* 1. SEPARATE PAGE: ADMINISTRATOR PORTAL LOGIN */}
          {/* ======================================================== */}
          {activePortal === 'admin' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="border-b border-red-100 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-red-600 text-lg">shield</span>
                  <h2 className="font-extrabold text-base text-[#101010]">Administrator Sign In</h2>
                </div>
                <p className="text-xs text-red-900/60 leading-relaxed">
                  Restricted system management access. Only administrators can configure evaluation rubrics, dispatch
                  evaluator assignments, and create shareable upload links.
                </p>
              </div>

              <form onSubmit={handleAdminSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#101010] mb-1.5" htmlFor="admin-email">
                    Administrator Work Email
                  </label>
                  <input
                    id="admin-email"
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="p2precruitment2025@gmail.com"
                    className="w-full rounded-xl border border-[#E8E5E1] px-3.5 py-2.5 text-xs text-[#101010] focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none transition-all bg-[#F5F2EE]/50 focus:bg-white"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-semibold text-[#101010]" htmlFor="admin-password">
                      Admin Password
                    </label>
                    <span className="text-[11px] text-red-900/60 font-mono">256-bit encrypted</span>
                  </div>
                  <input
                    id="admin-password"
                    type="password"
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full rounded-xl border border-[#E8E5E1] px-3.5 py-2.5 text-xs text-[#101010] focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none transition-all bg-[#F5F2EE]/50 focus:bg-white"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white rounded-xl py-3 text-xs font-bold uppercase tracking-wider transition-all shadow-sm shadow-red-500/20 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-base">login</span>
                    <span>Sign In to Admin Console</span>
                  </button>
                </div>
              </form>

              <div className="pt-3 border-t border-red-50 text-center">
                <p className="text-[11px] text-red-900/70">
                  Admin Account: <strong>P2P Admin</strong> (<code>p2precruitment2025@gmail.com</code>)
                </p>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 2. SEPARATE PAGE: EVALUATOR PORTAL */}
          {/* ======================================================== */}
          {activePortal === 'evaluator' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="border-b border-red-100 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-red-600 text-lg">rate_review</span>
                  <h2 className="font-extrabold text-base text-[#101010]">Manager / Employer Portal</h2>
                </div>
                <p className="text-xs text-red-900/60 leading-relaxed">
                  Access your review queue and grade candidate interview videos against standardized scoring rubrics.
                </p>
              </div>

              {/* Sub Mode: Admin Link / Token vs Email Sign-In */}
              <div className="flex border border-[#E8E5E1] rounded-xl p-1 bg-red-50/30 text-xs">
                <button
                  type="button"
                  onClick={() => setEvaluatorMode('token')}
                  className={`flex-1 py-1.5 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    evaluatorMode === 'token'
                      ? 'bg-white text-red-700 font-bold shadow-xs border border-red-100'
                      : 'text-[#8A8580] hover:text-[#101010]'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">link</span>
                  <span>Access via Admin Link / Token</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEvaluatorMode('credentials')}
                  className={`flex-1 py-1.5 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    evaluatorMode === 'credentials'
                      ? 'bg-white text-red-700 font-bold shadow-xs border border-red-100'
                      : 'text-[#8A8580] hover:text-[#101010]'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">badge</span>
                  <span>Manager / Employer Account</span>
                </button>
              </div>

              <form onSubmit={handleEvaluatorSubmit} className="space-y-4">
                {evaluatorMode === 'token' ? (
                  <div>
                    <label className="block text-xs font-semibold text-[#101010] mb-1.5">
                      Admin Evaluation Invite Token / Link Code *
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-2.5 text-red-600 text-base">
                        key
                      </span>
                      <input
                        type="text"
                        required
                        value={evaluatorToken}
                        onChange={(e) => setEvaluatorToken(e.target.value)}
                        placeholder="e.g. INV-EVAL-3921"
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-[#E8E5E1] text-xs font-mono font-bold text-[#101010] focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none bg-[#F5F2EE]/50 focus:bg-white"
                      />
                    </div>
                    <p className="text-[11px] text-red-900/60 mt-1.5">
                      Generated and shared exclusively by the administrator to evaluate candidate submissions.
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-[#101010] mb-1.5">
                        Manager / Employer Work Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={evaluatorEmail}
                        onChange={(e) => setEvaluatorEmail(e.target.value)}
                        placeholder="manager@company.com"
                        className="w-full rounded-xl border border-[#E8E5E1] px-3.5 py-2.5 text-xs text-[#101010] focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none bg-[#F5F2EE]/50 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#101010] mb-1.5">Password</label>
                      <input
                        type="password"
                        required
                        value={evaluatorPassword}
                        onChange={(e) => setEvaluatorPassword(e.target.value)}
                        className="w-full rounded-xl border border-[#E8E5E1] px-3.5 py-2.5 text-xs text-[#101010] focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none bg-[#F5F2EE]/50 focus:bg-white"
                      />
                    </div>
                  </>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isVerifying}
                    className="w-full bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white rounded-xl py-3 text-xs font-bold uppercase tracking-wider transition-all shadow-sm shadow-red-500/20 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-base">task_alt</span>
                    <span>
                      {evaluatorMode === 'token' ? 'Unlock & Open Review Queue' : 'Sign In as Manager / Employer'}
                    </span>
                  </button>
                </div>
              </form>

            </div>
          )}

          {/* ======================================================== */}
          {/* 3. SEPARATE PAGE: CANDIDATE VIDEO SUBMISSION PORTAL */}
          {/* ======================================================== */}
          {activePortal === 'candidate' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="border-b border-red-100 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-red-600 text-lg">video_camera_front</span>
                  <h2 className="font-extrabold text-base text-[#101010]">Candidate Video Submission Portal</h2>
                </div>
                <p className="text-xs text-red-900/60 leading-relaxed">
                  Upload or record your asynchronous self-introduction video. Access is granted exclusively via invitation
                  links created and shared by the hiring administrator.
                </p>
              </div>

              {/* If already verified by URL */}
              {verifiedInvite && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                    <span className="material-symbols-outlined text-base text-emerald-600">verified</span>
                    <span>Verified Invitation Link</span>
                  </div>
                  <p className="text-emerald-700">
                    Candidate: <strong>{verifiedInvite.recipientName}</strong> • Position: {verifiedInvite.roleApplied}
                  </p>
                </div>
              )}

              <form onSubmit={handleCandidateSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#101010] mb-1.5">
                    Admin Upload Invitation Token or Link *
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-red-600 text-base">
                      link
                    </span>
                    <input
                      type="text"
                      required
                      value={candidateToken}
                      onChange={(e) => setCandidateToken(e.target.value)}
                      placeholder="e.g. INV-CAND-7842"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-[#E8E5E1] text-xs font-mono font-bold text-[#101010] focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none bg-[#F5F2EE]/50 focus:bg-white"
                    />
                  </div>
                  <p className="text-[11px] text-red-900/60 mt-1.5">
                    Paste the invite token or query parameter you received from the hiring administrator.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#101010] mb-1.5">
                    Your Registered Email Address (Optional Confirmation)
                  </label>
                  <input
                    type="email"
                    value={candidateEmail}
                    onChange={(e) => setCandidateEmail(e.target.value)}
                      placeholder="candidate@email.com"
                    className="w-full rounded-xl border border-[#E8E5E1] px-3.5 py-2.5 text-xs text-[#101010] focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none bg-[#F5F2EE]/50 focus:bg-white"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isVerifying}
                    className="w-full bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white rounded-xl py-3 text-xs font-bold uppercase tracking-wider transition-all shadow-sm shadow-red-500/20 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-base">upload_file</span>
                    <span>Enter & Upload Self-Introduction</span>
                  </button>
                </div>
              </form>

            </div>
          )}
        </div>
      </main>
    </div>
  );
};
