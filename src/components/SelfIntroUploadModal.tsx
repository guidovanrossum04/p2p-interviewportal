import React, { useState } from 'react';
import { Video } from 'lucide-react';
import { CandidateAnswerMode, CandidateVideo, User } from '../types';
import { CandidateVideoResponseInput } from './CandidateVideoResponseInput';

interface SelfIntroUploadModalProps {
  currentUser: User;
  linkToken?: string;
  requiredVideoCount?: number;
  questionPrompt?: string | string[];
  answerMode?: CandidateAnswerMode;
  onClose: () => void;
  onSubmit: (videos: CandidateVideo[], emailNotice?: string) => void;
}

const normalizeQuestionPrompts = (questionPrompt?: string | string[]) => {
  if (Array.isArray(questionPrompt)) {
    return questionPrompt.filter((prompt): prompt is string => typeof prompt === 'string' && Boolean(prompt.trim()));
  }
  if (typeof questionPrompt !== 'string' || !questionPrompt.trim()) return defaultQuestions;
  try {
    const parsed = JSON.parse(questionPrompt);
    if (Array.isArray(parsed)) {
      return parsed.filter((prompt): prompt is string => typeof prompt === 'string' && Boolean(prompt.trim()));
    }
  } catch {
    // Fall back to the legacy single-string format.
  }
  return [questionPrompt.trim()];
};

const defaultQuestions = [
  'Please tell me a little bit about yourself. For example, who you are, your employment history and your current achievements?',
  'Tell me about a time that you provided outstanding customer service?',
  'How would you deal with a difficult patient?',
  'If you were in a situation where you could not read the prescription, what would you do?',
  'Describe a clinical intervention that you have made?',
  'The role as a pharmacist requires you to lead and manage your team. Describe to me how you will lead and manage your team effectively?',
];

const buildQuestionSet = (requiredVideoCount: number, questionPrompt?: string | string[]) => {
  const prompts = normalizeQuestionPrompts(questionPrompt);
  const safeCount = Math.min(Math.max(1, Number(requiredVideoCount) || prompts.length || 1), 6);
  if (safeCount <= 1) return [prompts[0] || defaultQuestions[0]];
  return Array.from({ length: safeCount }, (_, index) => prompts[index] || prompts[prompts.length - 1] || defaultQuestions[index] || defaultQuestions[0]);
};

export const SelfIntroUploadModal: React.FC<SelfIntroUploadModalProps> = ({
  currentUser,
  linkToken,
  requiredVideoCount = 1,
  questionPrompt,
  answerMode = 'upload',
  onClose,
  onSubmit,
}) => {
  const questions = buildQuestionSet(requiredVideoCount, questionPrompt);
  const [candidateName, setCandidateName] = useState(currentUser.name);
  const [candidateEmail, setCandidateEmail] = useState(currentUser.email);
  const [roleApplied, setRoleApplied] = useState(currentUser.title?.replace(/^Candidate for /, '') || '');
  const [answers, setAnswers] = useState<(File | null)[]>(() => questions.map(() => null));
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (answers.some((answer) => !answer)) {
      setUploadError(`Provide a video response for each of the ${questions.length} requested question${questions.length === 1 ? '' : 's'} before submitting.`);
      return;
    }
    setIsSubmitting(true);
    setUploadError(null);
    try {
      const submittedAnswers = answers.filter((answer): answer is File => answer !== null);
      if (submittedAnswers.length !== questions.length) {
        setUploadError(`Provide a video response for each of the ${questions.length} requested question${questions.length === 1 ? '' : 's'} before submitting.`);
        return;
      }
      let newVideos: CandidateVideo[];
      let emailNotice = '';
      if (linkToken) {
        const formData = new FormData();
        formData.append('candidateName', candidateName);
        formData.append('candidateEmail', candidateEmail);
        formData.append('roleApplied', roleApplied);
        formData.append('department', '');
        formData.append('answerMode', answerMode);
        formData.append('questionPrompts', JSON.stringify(questions));
        formData.append('bio', '');
        formData.append('keySkills', '');
        submittedAnswers.forEach((file) => formData.append('videos', file));
        const response = await fetch(`/api/public/links/${encodeURIComponent(linkToken)}/upload`, {
          method: 'POST',
          body: formData,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Video upload failed.');
        if (!Array.isArray(result.videos) || result.videos.length !== questions.length) {
          throw new Error(`The server did not confirm all ${questions.length} requested video response${questions.length === 1 ? '' : 's'}.`);
        }
        newVideos = result.videos as CandidateVideo[];
        emailNotice = typeof result.emailNotice === 'string' ? result.emailNotice : '';
      } else {
        const submittedAt = new Date().toISOString();
        newVideos = submittedAnswers.map((file, index) => ({
          id: `vid-${Date.now()}-${index}`,
          candidateName,
          candidateEmail,
          roleApplied,
          department: '',
          submittedAt,
          submittedTimeAgo: 'Just now',
          status: 'pending',
          keySkills: [],
          bio: '',
          questionPrompt: questions[index],
          videoUrl: URL.createObjectURL(file),
          videoDuration: '00:00',
          durationSeconds: 0,
          batchName: 'Pharmacist Assessment',
        }));
      }
      onSubmit(newVideos, emailNotice);
      onClose();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Video upload failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="self-intro-upload-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-[#E8E5E1] shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-[#101010]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="p-6 border-b border-[#E8E5E1] flex justify-between items-center shrink-0 bg-white">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-[#101010]">
              <Video aria-hidden="true" className="h-5 w-5 text-red-600" />
              Pharmacist Video Assessment
            </h3>
            <p className="text-xs text-[#4D4A47] mt-0.5">
              {answerMode === 'record'
                ? 'Record one video response for each question requested by the recruitment team.'
                : 'Upload one video for each question requested by the recruitment team.'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-[#8A8580] hover:text-red-700 hover:bg-red-50 transition-colors">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block font-semibold text-[#101010]">
              Full Name *
              <input required value={candidateName} onChange={(event) => setCandidateName(event.target.value)} className="mt-1 w-full rounded-lg border border-[#E8E5E1] px-3 py-2 font-normal focus:border-red-500 focus:outline-none" />
            </label>
            <label className="block font-semibold text-[#101010]">
              Email Address *
              <input type="email" required value={candidateEmail} onChange={(event) => setCandidateEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-[#E8E5E1] px-3 py-2 font-normal focus:border-red-500 focus:outline-none" />
            </label>
            <label className="block font-semibold text-[#101010] sm:col-span-2">
              Role Applied For *
              <input required value={roleApplied} onChange={(event) => setRoleApplied(event.target.value)} placeholder="e.g. Pharmacist" className="mt-1 w-full rounded-lg border border-[#E8E5E1] px-3 py-2 font-normal focus:border-red-500 focus:outline-none" />
            </label>
          </div>

          <div className="space-y-3">
            {questions.map((question, index) => (
              <section key={`${index}-${question}`} className="rounded-xl border border-red-200 bg-red-50/30 p-4 space-y-3">
                <div className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-50 text-[11px] font-bold text-red-700">{index + 1}</span>
                  <h4 className="font-semibold leading-5 text-[#101010]">{question}</h4>
                </div>
                <div className="pl-9">
                  <CandidateVideoResponseInput
                    answerMode={answerMode}
                    questionNumber={index + 1}
                    answer={answers[index]}
                    onChange={(file) => {
                      setAnswers((current) => current.map((answer, answerIndex) => answerIndex === index ? file : answer));
                      setUploadError(null);
                    }}
                  />
                </div>
              </section>
            ))}
          </div>

          {uploadError && <p role="alert" className="text-xs font-semibold text-red-700">{uploadError}</p>}
          <div className="pt-2 flex justify-end gap-3 border-t border-[#E8E5E1]">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-[#E8E5E1] hover:bg-red-50 rounded-lg font-semibold">Cancel</button>
            <button type="submit" disabled={isSubmitting || answers.some((answer) => !answer)} className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold disabled:opacity-50">
              {isSubmitting ? 'Submitting...' : 'Submit all video responses'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
