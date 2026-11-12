import { RubricWeight } from '../types';

export const adminReviewRubric = [
  { id: 'spoken-english', name: 'Spoken English & clarity' },
  { id: 'presentation', name: 'Presentation & confidence' },
  { id: 'answer-relevance', name: 'Answer relevance' },
  { id: 'professionalism', name: 'Professionalism & engagement' },
] as const;

export const standardEvaluationRubric: RubricWeight[] = adminReviewRubric.map((criterion) => ({
  ...criterion,
  weight: 25,
}));
