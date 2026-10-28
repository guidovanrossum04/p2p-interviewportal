import React, { useEffect, useRef, useState } from 'react';
import { Camera, CircleStop, RotateCcw, Upload, Video } from 'lucide-react';
import { CandidateDocument, CandidateVideo, User } from '../types';

interface SelfIntroUploadModalProps {
  currentUser: User;
  linkToken?: string;
  onClose: () => void;
  onSubmit: (videos: CandidateVideo[], emailNotice?: string) => void;
}

const questions = [
  'Please tell me a little bit about yourself. For example, who you are, your employment history and your current achievements?',
  'Tell me about a time that you provided outstanding customer service?',
  'How would you deal with a difficult patient?',
  'If you were in a situation where you could not read the prescription, what would you do?',
  'Describe a clinical intervention that you have made?',
  'The role as a pharmacist requires you to lead and manage your team. Describe to me how you will lead and manage your team effectively?',
];

export const SelfIntroUploadModal: React.FC<SelfIntroUploadModalProps> = ({
  currentUser,
  linkToken,
  onClose,
  onSubmit,
}) => {
  const [candidateName, setCandidateName] = useState(currentUser.name);
  const [candidateEmail, setCandidateEmail] = useState(currentUser.email);
  const [roleApplied, setRoleApplied] = useState(currentUser.title?.replace(/^Candidate for /, '') || '');
  const [answers, setAnswers] = useState<(File | null)[]>(() => questions.map(() => null));
  const [answerModes, setAnswerModes] = useState<('upload' | 'record')[]>(() => questions.map(() => 'upload'));
  const [previewUrls, setPreviewUrls] = useState<(string | null)[]>(() => questions.map(() => null));
  const [selectedDocuments, setSelectedDocuments] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recordingIndex, setRecordingIndex] = useState<number | null>(null);
  const [recordedSeconds, setRecordedSeconds] = useState<number[]>(() => questions.map(() => 0));
  const [recordingStream, setRecordingStream] = useState<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const uploadInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const previewUrlsRef = useRef<(string | null)[]>(questions.map(() => null));

  useEffect(() => {
    const preview = videoPreviewRef.current;
    if (!preview || !recordingStream) return;

    preview.srcObject = recordingStream;
    const playPreview = () => {
      preview.play().then(() => setPreviewError(null)).catch((error: unknown) => {
        console.error('Could not start the live camera preview.', error);
        setPreviewError('Camera is recording, but the live preview could not start. Check browser camera permissions and try again.');
      });
    };

    if (preview.readyState >= HTMLMediaElement.HAVE_METADATA) {
      playPreview();
    } else {
      preview.addEventListener('loadedmetadata', playPreview, { once: true });
    }

    return () => {
      preview.removeEventListener('loadedmetadata', playPreview);
      preview.pause();
      preview.srcObject = null;
    };
  }, [recordingStream]);

  useEffect(() => {
    if (recordingIndex === null) return;
    const timer = window.setInterval(() => {
      setRecordedSeconds((seconds) => seconds.map((value, index) => index === recordingIndex ? value + 1 : value));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [recordingIndex]);

  useEffect(() => () => {
    const recorder = mediaRecorderRef.current;
    if (recorder?.state === 'recording') {
      recorder.onstop = null;
      recorder.stop();
    }
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    previewUrlsRef.current.forEach((url) => {
      if (url) URL.revokeObjectURL(url);
    });
  }, []);

  const replaceAnswer = (index: number, file: File | null, previewUrl: string | null = null) => {
    setAnswers((current) => current.map((answer, answerIndex) => answerIndex === index ? file : answer));
    const previousUrl = previewUrlsRef.current[index];
    if (previousUrl) URL.revokeObjectURL(previousUrl);
    const updatedPreviewUrls = [...previewUrlsRef.current];
    updatedPreviewUrls[index] = previewUrl;
    previewUrlsRef.current = updatedPreviewUrls;
    setPreviewUrls(updatedPreviewUrls);
  };

  const handleStartRecording = async (index: number) => {
    setUploadError(null);
    setPreviewError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setUploadError('Video recording is not supported by this browser. Upload a video file instead.');
      return;
    }
    let requestedStream: MediaStream | null = null;
    try {
      requestedStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const stream = requestedStream;
      if (stream.getVideoTracks().length === 0) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error('No camera was found. Connect a camera and try again.');
      }
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error('No microphone was found. Connect a microphone and try again.');
      }
      audioTracks.forEach((track) => { track.enabled = true; });
      recordingStreamRef.current = stream;
      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/mp4',
      ];
      const mimeType = mimeTypes.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recordingChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setUploadError('The recording could not be completed. Check your camera and microphone permissions, then try again.');
      };
      recorder.onstop = () => {
        const recordedMimeType = recorder.mimeType || mimeType || 'video/webm';
        const containerType = recordedMimeType.split(';', 1)[0].trim().toLowerCase();
        const extension = containerType === 'video/mp4' ? 'mp4' : containerType === 'video/quicktime' ? 'mov' : 'webm';
        const recordedBlob = new Blob(recordingChunksRef.current, { type: recordedMimeType });
        if (recordedBlob.size > 0) {
          const file = new File([recordedBlob], `question-${index + 1}.${extension}`, { type: recordedMimeType });
          replaceAnswer(index, file, URL.createObjectURL(recordedBlob));
          setUploadError(null);
        } else {
          setUploadError('No video was captured. Check camera and microphone permissions, then record again.');
        }
        stream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        setRecordingStream(null);
        setRecordingIndex(null);
        setPreviewError(null);
        mediaRecorderRef.current = null;
      };
      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setRecordingStream(stream);
      setAnswerModes((modes) => modes.map((mode, modeIndex) => modeIndex === index ? 'record' : mode));
      setRecordingIndex(index);
    } catch (error) {
      requestedStream?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      mediaRecorderRef.current = null;
      setRecordingStream(null);
      setRecordingIndex(null);
      setPreviewError(null);
      setUploadError(error instanceof Error ? `Could not start recording: ${error.message}` : 'Could not access your camera and microphone.');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
  };

  const handleRetake = (index: number) => {
    replaceAnswer(index, null);
    setRecordedSeconds((seconds) => seconds.map((value, answerIndex) => answerIndex === index ? 0 : value));
    setUploadError(null);
  };

  const handleDocumentsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.currentTarget.files ? [...event.currentTarget.files] : [];
    if (files.length > 20) {
      setUploadError('Select no more than 20 supporting documents.');
      event.target.value = '';
      return;
    }
    if (files.some((file) => file.size > 25 * 1024 * 1024)) {
      setUploadError('Each supporting document must be 25 MB or smaller.');
      event.target.value = '';
      return;
    }
    setSelectedDocuments(files);
    setUploadError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (answers.some((answer) => !answer)) {
      setUploadError('Provide a video response for each of the six questions before submitting.');
      return;
    }
    if (recordingIndex !== null) {
      setUploadError('Stop the active recording before submitting.');
      return;
    }

    setIsSubmitting(true);
    setUploadError(null);
    try {
      const submittedAnswers = answers.filter((answer): answer is File => answer !== null);
      if (submittedAnswers.length !== questions.length) {
        setUploadError('Provide a video response for each of the six questions before submitting.');
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
        formData.append('questionPrompts', JSON.stringify(questions));
        formData.append('bio', '');
        formData.append('keySkills', '');
        submittedAnswers.forEach((file) => formData.append('videos', file));
        selectedDocuments.forEach((file) => formData.append('documents', file));
        const response = await fetch(`/api/public/links/${encodeURIComponent(linkToken)}/upload`, {
          method: 'POST',
          body: formData,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Video upload failed.');
        if (!Array.isArray(result.videos) || result.videos.length !== questions.length) {
          throw new Error('The server did not confirm all six video responses.');
        }
        newVideos = result.videos as CandidateVideo[];
        emailNotice = typeof result.emailNotice === 'string' ? result.emailNotice : '';
      } else {
        const submittedAt = new Date().toISOString();
        const documents: CandidateDocument[] = selectedDocuments.map((file, index) => {
          const url = URL.createObjectURL(file);
          return { id: `doc-${Date.now()}-${index}`, name: file.name, mimeType: file.type, size: file.size, url, downloadUrl: url };
        });
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
          videoUrl: previewUrls[index] || URL.createObjectURL(file),
          videoDuration: '00:00',
          durationSeconds: 0,
          batchName: 'Pharmacist Assessment',
          documents,
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

  const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

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
        <div className="p-6 border-b border-[#E8E5E1] flex justify-between items-center shrink-0 bg-gradient-to-r from-red-50/40 via-white to-red-50/20">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-[#101010]">
              <Video aria-hidden="true" className="h-5 w-5 text-red-600" />
              Pharmacist Video Assessment
            </h3>
            <p className="text-xs text-red-900/60 mt-0.5">Answer each question with one video. Upload a recording or record your response now.</p>
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
              <section key={question} className="rounded-xl border border-[#E8E5E1] p-4 space-y-3">
                <div className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-50 text-[11px] font-bold text-red-700">{index + 1}</span>
                  <h4 className="font-semibold leading-5 text-[#101010]">{question}</h4>
                </div>
                <div className="flex gap-2 pl-9">
                  <button
                    type="button"
                    onClick={() => {
                      if (recordingIndex !== null && recordingIndex !== index) handleStopRecording();
                      if (answerModes[index] !== 'upload') handleRetake(index);
                      setAnswerModes((modes) => modes.map((current, modeIndex) => modeIndex === index ? 'upload' : current));
                      setUploadError(null);
                      uploadInputRefs.current[index]?.click();
                    }}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-semibold ${answerModes[index] === 'upload' ? 'border-red-600 bg-red-50 text-red-700' : 'border-[#E8E5E1] text-[#8A8580]'}`}
                  >
                    <Upload aria-hidden="true" className="h-4 w-4" />
                    Choose video to upload
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (recordingIndex !== null && recordingIndex !== index) handleStopRecording();
                      if (answerModes[index] !== 'record') handleRetake(index);
                      setAnswerModes((modes) => modes.map((current, modeIndex) => modeIndex === index ? 'record' : current));
                      setUploadError(null);
                    }}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-semibold ${answerModes[index] === 'record' ? 'border-red-600 bg-red-50 text-red-700' : 'border-[#E8E5E1] text-[#8A8580]'}`}
                  >
                    <Camera aria-hidden="true" className="h-4 w-4" />
                    Record video
                  </button>
                </div>

                {answerModes[index] === 'upload' ? (
                  <div className="pl-9 space-y-2">
                    <input
                      ref={(element) => { uploadInputRefs.current[index] = element; }}
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime"
                      aria-label={`Upload video response for question ${index + 1}`}
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0] || null;
                        event.currentTarget.value = '';
                        replaceAnswer(index, file);
                        setUploadError(null);
                      }}
                      className="sr-only"
                    />
                    {answers[index] ? (
                      <p className="flex items-center gap-2 text-[11px] text-emerald-700">
                        <Video aria-hidden="true" className="h-4 w-4 shrink-0" />
                        Ready to upload: {answers[index]?.name}
                      </p>
                    ) : (
                      <p className="text-[11px] text-[#8A8580]">Choose a video file to add your answer.</p>
                    )}
                  </div>
                ) : (
                  <div className="pl-9 space-y-2">
                    {recordingIndex === index ? (
                      <div className="space-y-2">
                        <video ref={videoPreviewRef} autoPlay muted playsInline className="w-full max-w-md rounded-lg bg-black aspect-video" />
                        {previewError && <p role="alert" className="max-w-md text-[11px] text-red-700">{previewError}</p>}
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-[#101010]">{formatTime(recordedSeconds[index])}</span>
                          <button type="button" onClick={handleStopRecording} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 font-semibold text-white">
                            <CircleStop aria-hidden="true" className="h-4 w-4" />
                            Stop recording
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3">
                        {previewUrls[index] && <video src={previewUrls[index] || undefined} controls playsInline muted={false} preload="metadata" className="w-full max-w-md rounded-lg bg-black aspect-video" />}
                        {answers[index] ? (
                          <button type="button" onClick={() => handleRetake(index)} className="inline-flex items-center gap-2 rounded-lg border border-[#E8E5E1] px-3 py-2 font-semibold text-red-700">
                            <RotateCcw aria-hidden="true" className="h-4 w-4" />
                            Record again
                          </button>
                        ) : (
                          <button type="button" onClick={() => handleStartRecording(index)} disabled={recordingIndex !== null} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 font-semibold text-white disabled:opacity-50">
                            <Camera aria-hidden="true" className="h-4 w-4" />
                            Start recording
                          </button>
                        )}
                      </div>
                    )}
                    {answers[index] && recordingIndex !== index && <p className="text-[11px] text-emerald-700">Recording ready to submit.</p>}
                  </div>
                )}
              </section>
            ))}
          </div>

          <div className="rounded-xl border border-[#E8E5E1] p-4 space-y-3">
            <div>
              <h4 className="font-bold text-[#101010]">Supporting Documents (optional)</h4>
              <p className="text-[11px] text-[#8A8580] mt-1">PDF, DOC, DOCX, JPG, or PNG. Up to 20 files, 25 MB each.</p>
            </div>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"
              multiple
              onChange={handleDocumentsChange}
              className="block w-full text-[11px] text-[#8A8580]"
            />
            {selectedDocuments.length > 0 && <p className="text-[11px] text-[#8A8580]">{selectedDocuments.length} document{selectedDocuments.length === 1 ? '' : 's'} selected</p>}
          </div>

          {uploadError && <p role="alert" className="text-xs font-semibold text-red-700">{uploadError}</p>}
          <div className="pt-2 flex justify-end gap-3 border-t border-[#E8E5E1]">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-[#E8E5E1] hover:bg-red-50 rounded-lg font-semibold">Cancel</button>
            <button type="submit" disabled={isSubmitting || answers.some((answer) => !answer) || recordingIndex !== null} className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold disabled:opacity-50">
              {isSubmitting ? 'Submitting...' : 'Submit all video responses'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
