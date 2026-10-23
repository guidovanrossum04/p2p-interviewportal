import { CandidateVideo } from '../types';

export const getSubmissionId = (video: CandidateVideo): string =>
  video.submissionId || video.submissionBatchId || video.id;

export interface VideoSubmission {
  id: string;
  videos: CandidateVideo[];
}

export const groupVideosBySubmission = (videos: CandidateVideo[]): VideoSubmission[] => {
  const groups = new Map<string, CandidateVideo[]>();
  videos.forEach((video) => {
    const id = getSubmissionId(video);
    groups.set(id, [...(groups.get(id) || []), video]);
  });
  return Array.from(groups, ([id, submissionVideos]) => ({ id, videos: submissionVideos }));
};

export const fetchAssignableSubmissions = async (signal?: AbortSignal): Promise<CandidateVideo[]> => {
  const limit = 100;
  const submissions: CandidateVideo[] = [];
  let page = 1;
  let total = 0;

  do {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      reviewStatus: 'ready_to_assign',
    });
    const response = await fetch(`/api/submissions?${params.toString()}`, { signal });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not load submissions ready for assignment.');
    if (!Array.isArray(result.items)) throw new Error('The server returned an invalid assignable-submissions response.');
    submissions.push(...(result.items as CandidateVideo[]));
    total = Number(result.total) || 0;
    page += 1;
  } while ((page - 1) * limit < total);

  return submissions;
};
