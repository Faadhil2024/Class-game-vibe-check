export type AnswerChoice = 'A' | 'B';

export type StudentStatus = 'Joined' | 'In Progress' | 'Completed';

export interface PollQuestion {
  id: string;
  number: number;
  prompt: string;
  optionA: string;
  optionB: string;
}

export const POLL_QUESTIONS: readonly PollQuestion[] = [
  {
    id: 'q1',
    number: 1,
    prompt: 'Your ideal workspace:',
    optionA: 'Multiple monitors',
    optionB: 'One screen is enough',
  },
  {
    id: 'q2',
    number: 2,
    prompt: 'Dark mode or light mode?',
    optionA: 'Dark',
    optionB: 'Light',
  },
  {
    id: 'q3',
    number: 3,
    prompt: 'Tabs or spaces?',
    optionA: 'Tabs',
    optionB: 'Spaces',
  },
  {
    id: 'q4',
    number: 4,
    prompt: 'Something breaks. First move:',
    optionA: 'Restart it',
    optionB: 'Google the error',
  },
  {
    id: 'q5',
    number: 5,
    prompt: 'When do you code best?',
    optionA: 'Night',
    optionB: 'Morning',
  },
  {
    id: 'q6',
    number: 6,
    prompt: 'Keyboard:',
    optionA: 'Loud and clicky',
    optionB: 'Silent',
  },
  {
    id: 'q7',
    number: 7,
    prompt: 'Learning something new:',
    optionA: 'Read the docs',
    optionB: 'Watch a YouTube tutorial',
  },
  {
    id: 'q8',
    number: 8,
    prompt: 'Code comments:',
    optionA: 'Comment everything',
    optionB: 'Future me will understand',
  },
  {
    id: 'q9',
    number: 9,
    prompt: 'Your coding audio setup:',
    optionA: 'Over-ear headphones 🎧',
    optionB: 'Earphones 🎵',
  },
  {
    id: 'q10',
    number: 10,
    prompt: 'Finding internships:',
    optionA: 'LinkedIn 💼',
    optionB: 'Asking around through friends & connections 🤝',
  },
] as const;

export const PLAYFUL_REACTIONS: readonly string[] = [
  'Hmm, I see... interesting 👀',
  'Ooh, noted!',
  'Interesting choice!',
  "That's a vibe!",
  'I see what you did there.',
  'Noted. Very noted.',
] as const;

export type AnswersMap = Record<string, AnswerChoice>;

export interface SessionPublicInfo {
  id: string;
  label: string;
  joinCode: string;
  createdAt: string;
}

export interface QuestionAggregate {
  questionId: string;
  totalVotes: number;
  countA: number;
  countB: number;
  percentA: number;
  percentB: number;
}

export interface PublicLiveResults {
  session: SessionPublicInfo;
  totalJoined: number;
  completedCount: number;
  stillAnsweringCount: number;
  questions: QuestionAggregate[];
  updatedAt: string;
}

export interface StudentSelfState {
  id: string;
  sessionId: string;
  name: string;
  status: StudentStatus;
  answers: AnswersMap;
  answeredCount: number;
  joinedAt: string;
  completedAt: string | null;
}

export interface TaStudentRecord {
  id: string;
  name: string;
  status: StudentStatus;
  answers: AnswersMap;
  answeredCount: number;
  joinedAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface TaQuestionBreakdown {
  questionId: string;
  totalAnswered: number;
  countA: number;
  countB: number;
  percentA: number;
  percentB: number;
  studentsA: string[];
  studentsB: string[];
}

export interface TaDashboardPayload {
  session: SessionPublicInfo;
  stats: {
    totalJoined: number;
    completedCount: number;
    inProgressCount: number;
    joinedOnlyCount: number;
    stillAnsweringCount: number;
    completionRate: number;
  };
  students: TaStudentRecord[];
  questionBreakdowns: TaQuestionBreakdown[];
  updatedAt: string;
}
