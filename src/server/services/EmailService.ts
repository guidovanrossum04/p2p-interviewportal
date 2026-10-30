import nodemailer from 'nodemailer';
import type { SendMailOptions } from 'nodemailer';
import path from 'node:path';
import { CandidateVideo, InviteLink, SystemSettings } from '../../types';
import { PortalRepository } from '../repositories/PortalRepository';

const ADMIN_EMAILS = ['ivornorth@p2precruitment.com.au', 'developersp2pr@gmail.com'];

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character] || character));

export class EmailService {
  constructor(private readonly repository: PortalRepository) {}

  private async send(to: string, subject: string, html: string, attachments: SendMailOptions['attachments'] = []) {
    const { settings, password } = await this.repository.getSmtpCredentials();
    if (!settings.smtpHost || !settings.smtpUsername || !password || !settings.smtpFromAddress) {
      throw new Error('SMTP is not configured. Save the email server settings first.');
    }

    const transport = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpSecure,
      auth: { user: settings.smtpUsername, pass: password },
    });
    await transport.sendMail({
      from: { name: settings.smtpFromName || 'P2P Recruitment', address: settings.smtpFromAddress },
      to,
      subject,
      html: this.emailLayout(html),
      attachments,
    });
  }

  private emailLayout(content: string): string {
    return `<!doctype html>
      <html><body style="margin:0;padding:24px;background:#F5F2EE;font-family:Archivo,Arial,Helvetica,sans-serif;color:#101010">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #E8E5E1;border-radius:16px;overflow:hidden">
          <tr><td style="padding:22px 28px;background:#D81F27;color:#fff">
            <div style="font-size:20px;font-weight:700">P2P Recruitment</div>
            <div style="font-size:12px;color:#FFE4E6;margin-top:4px">Candidate interview and evaluation portal</div>
          </td></tr>
          <tr><td style="padding:28px;line-height:1.6;font-size:14px">${content}</td></tr>
          <tr><td style="padding:16px 28px;background:#FFF1F2;border-top:1px solid #E8E5E1;color:#5A5550;font-size:11px">
            This is an automated message from P2P Recruitment. Please do not reply directly to this email.
          </td></tr>
        </table>
      </body></html>`;
  }

  private actionButton(url: string, label: string): string {
    return `<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:#D81F27;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700">${escapeHtml(label)}</a></p>`;
  }

  async sendInvite(invite: InviteLink, linkUrl: string): Promise<void> {
    const candidateInvite = invite.type === 'candidate';
    const recipientName = escapeHtml(invite.recipientName);
    const position = escapeHtml(invite.roleApplied || 'Candidate review');
    const safeUrl = escapeHtml(linkUrl);
    const action = candidateInvite
      ? invite.answerMode === 'record' ? 'record your requested video responses' : 'upload your requested video responses'
      : 'review the assigned candidate submission';
    const noteSubject = invite.notes?.match(/^Subject Line:\s*(.+)$/im)?.[1]?.trim();
    const subject = candidateInvite
      ? noteSubject || `Video submission link: ${invite.roleApplied || 'Candidate role'}`
      : `Candidate review assignment: ${invite.roleApplied || 'Review'}`;
    const invitationNotes = (invite.notes || '')
      .replace(/^Subject Line:\s*.+(?:\r?\n|$)/im, '')
      .trim();
    const invitationLines = invitationNotes.split(/\r?\n/);
    const signoffIndex = invitationLines.findIndex((line) => line.trim().toLowerCase() === 'kind regards');
    const invitationBody = (signoffIndex >= 0 ? invitationLines.slice(0, signoffIndex) : invitationLines).join('\n').trim();
    const invitationSignoff = signoffIndex >= 0 ? invitationLines.slice(signoffIndex).filter((line) => line.trim()) : [];
    const notesHtml = invitationNotes
      ? `<div style="margin:20px 0;white-space:pre-line">${escapeHtml(invitationBody)}</div>
         ${invitationSignoff.length
           ? `<div style="margin-top:24px;padding-left:12px;border-left:3px solid #D81F27;line-height:1.55">
                ${invitationSignoff.map((line, index) => `<div style="${index === invitationSignoff.length - 1 ? 'margin-top:4px;color:#5A5550;font-style:italic' : index === 2 ? 'font-weight:700;color:#101010' : 'color:#101010'}">${escapeHtml(line)}</div>`).join('')}
              </div>`
           : ''}`
      : '';
    const logoHtml = candidateInvite
      ? '<p style="margin:0 0 20px"><img src="cid:p2p-recruitment-logo" alt="P2P Recruitment" width="160" style="display:block;width:160px;height:auto"></p>'
      : '';

    await this.send(invite.recipientEmail, subject, `
      ${logoHtml}
      ${candidateInvite && invitationNotes
        ? `<p>Hello ${recipientName},</p>
           ${this.actionButton(linkUrl, invite.answerMode === 'record' ? 'Open recording portal' : 'Open upload portal')}
           <div>${notesHtml}</div>`
        : `<h1 style="font-size:22px;color:#101010;margin:0 0 16px">You have a secure invitation</h1>
           <p>Hello ${recipientName},</p>
           <p>You have been invited to ${action} for <strong>${position}</strong>.</p>
           ${notesHtml}`}
      ${candidateInvite && invitationNotes ? '' : this.actionButton(linkUrl, candidateInvite ? invite.answerMode === 'record' ? 'Open recording portal' : 'Open upload portal' : 'Open review assignment')}
      <p style="font-size:12px;color:#8A8580">This secure link expires at ${escapeHtml(new Date(invite.expiresAt).toLocaleString())}.</p>
      <p style="font-size:12px;color:#8A8580;word-break:break-all">If the button does not work, copy this link:<br>${safeUrl}</p>
      <p>If you were not expecting this message, you can ignore it.</p>
    `, candidateInvite ? [{
      filename: 'p2plogo.webp',
      path: path.resolve(process.cwd(), 'assets', 'p2plogo.webp'),
      cid: 'p2p-recruitment-logo',
    }] : []);
  }

  async sendExpiryUpdated(invite: InviteLink, linkUrl: string): Promise<void> {
    const safeName = escapeHtml(invite.recipientName);
    const safeUrl = escapeHtml(linkUrl);
    await this.send(invite.recipientEmail, 'Your P2P Recruitment link expiry was updated', `
      <h1 style="font-size:22px;color:#101010;margin:0 0 16px">Your link expiry was extended</h1>
      <p>Hello ${safeName},</p>
      <p>Your secure link is now valid until <strong>${escapeHtml(new Date(invite.expiresAt).toLocaleString())}</strong>.</p>
      ${this.actionButton(linkUrl, 'Open your secure link')}
      <p style="font-size:12px;color:#8A8580;word-break:break-all">${safeUrl}</p>
    `);
  }

  async sendCandidateReview(video: CandidateVideo, decision: 'accepted' | 'reupload_requested', feedback: string): Promise<void> {
    const recipientName = escapeHtml(video.candidateName);
    const safeFeedback = escapeHtml(feedback);
    const approved = decision === 'accepted';
    await this.send(
      video.candidateEmail,
      approved ? 'Your video submission was approved' : 'A video reupload is requested',
      `<h1 style="font-size:22px;color:#101010;margin:0 0 16px">${approved ? 'Your submission was approved' : 'A replacement video is requested'}</h1>
        <p>Hello ${recipientName},</p>
        <p>${approved ? 'Your video submission has been approved.' : 'Please reupload the requested video using your existing candidate upload link.'}</p>
        <div style="margin-top:18px;padding:14px;background:#F5F2EE;border-left:4px solid #D81F27;border-radius:6px"><strong>Admin feedback</strong><br>${safeFeedback.replace(/\n/g, '<br>')}</div>`,
    );
  }

  async sendCandidateUploadConfirmation(video: CandidateVideo, videoCount: number): Promise<void> {
    const name = escapeHtml(video.candidateName);
    const role = escapeHtml(video.roleApplied || 'your application');
    await this.send(video.candidateEmail, 'We received your P2P Recruitment submission', `
      <h1 style="font-size:22px;color:#101010;margin:0 0 16px">Submission received</h1>
      <p>Hello ${name},</p>
      <p>Your upload for <strong>${role}</strong> was received successfully. We received ${videoCount} video${videoCount === 1 ? '' : 's'} and your submission is now queued for review.</p>
      <p>We’ll email you if the hiring team needs any changes or when there is an update.</p>
    `);
  }

  async sendAdminSubmissionReceived(video: CandidateVideo, videoCount: number, portalUrl: string): Promise<void> {
    const name = escapeHtml(video.candidateName);
    const email = escapeHtml(video.candidateEmail);
    const role = escapeHtml(video.roleApplied || 'Not specified');
    await this.send(ADMIN_EMAILS.join(', '), `New candidate submission: ${video.candidateName}`, `
      <h1 style="font-size:22px;color:#101010;margin:0 0 16px">New candidate submission</h1>
      <p><strong>${name}</strong> (${email}) submitted ${videoCount} video${videoCount === 1 ? '' : 's'} for <strong>${role}</strong>.</p>
      ${this.actionButton(portalUrl, 'Open admin portal')}
    `);
  }

  async sendAdminSubmissionUpdated(video: CandidateVideo, portalUrl: string): Promise<void> {
    const name = escapeHtml(video.candidateName);
    const email = escapeHtml(video.candidateEmail);
    const role = escapeHtml(video.roleApplied || 'Not specified');
    await this.send(ADMIN_EMAILS.join(', '), `Candidate reupload received: ${video.candidateName}`, `
      <h1 style="font-size:22px;color:#101010;margin:0 0 16px">Candidate reupload received</h1>
      <p><strong>${name}</strong> (${email}) submitted a replacement video for <strong>${role}</strong>.</p>
      ${this.actionButton(portalUrl, 'Open admin portal')}
    `);
  }

  async sendAdminEvaluationCompleted(video: CandidateVideo, portalUrl: string): Promise<void> {
    const name = escapeHtml(video.candidateName);
    const role = escapeHtml(video.roleApplied || 'Not specified');
    const evaluator = escapeHtml(video.assignedEvaluatorName || 'Manager / Employer');
    const decision = escapeHtml(video.evaluation?.decision || 'submitted');
    const notes = escapeHtml(video.evaluation?.notes || '');
    await this.send(ADMIN_EMAILS.join(', '), `Manager / Employer evaluation completed: ${video.candidateName}`, `
      <h1 style="font-size:22px;color:#101010;margin:0 0 16px">Evaluation completed</h1>
      <p>${evaluator} completed the evaluation for <strong>${name}</strong> — ${role}.</p>
      <p><strong>Decision:</strong> ${decision}${video.evaluation?.overallScore !== undefined ? ` · <strong>Score:</strong> ${video.evaluation.overallScore}%` : ''}</p>
      ${notes ? `<div style="margin-top:18px;padding:14px;background:#F5F2EE;border-left:4px solid #D81F27;border-radius:6px"><strong>Evaluation notes</strong><br>${notes.replace(/\n/g, '<br>')}</div>` : ''}
      ${this.actionButton(portalUrl, 'Open admin portal')}
    `);
  }

  async sendTestEmail(settings: SystemSettings, password: string, recipient: string): Promise<void> {
    if (!settings.smtpHost || !settings.smtpUsername || !password || !settings.smtpFromAddress) {
      throw new Error('Configure SMTP host, username, password, and sender address first.');
    }
    const transport = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpSecure,
      auth: { user: settings.smtpUsername, pass: password },
    });
    await transport.sendMail({
      from: { name: settings.smtpFromName || 'P2P Recruitment', address: settings.smtpFromAddress },
      to: recipient,
      subject: 'P2P Recruitment SMTP test',
      html: this.emailLayout('<h1 style="font-size:22px;color:#101010">SMTP test successful</h1><p>HTML email branding and SMTP delivery are configured correctly.</p>'),
    });
  }
}