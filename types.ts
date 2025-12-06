
export interface Word {
  id: string;
  term: string;
  meaning: string;
  sentence?: string;
  category?: string;
}

export interface WordGroup {
  id: number | string;
  label: string;
  words: Word[];
}

export enum AppView {
  HOME = 'HOME',
  GROUP_SELECT_LEARN = 'GROUP_SELECT_LEARN',
  GROUP_SELECT_QUIZ = 'GROUP_SELECT_QUIZ',
  LEARN_MODE = 'LEARN_MODE',
  QUIZ_MODE = 'QUIZ_MODE',
  GUIDED_LEARNING = 'GUIDED_LEARNING',
  MISTAKES = 'MISTAKES',
  LEADERBOARD = 'LEADERBOARD',
  BETA_SRS = 'BETA_SRS',
}

export enum QuizQuestionType {
  DEFINITION = 'DEFINITION',
  CONTEXT = 'CONTEXT',
}

export interface QuizQuestion {
  id: string;
  type: QuizQuestionType;
  word: Word;
  questionText: string; // The sentence or the prompt
  options: string[]; // 4 options (meanings)
  correctOptionIndex: number;
}

// --- Learning Mode Types ---

export interface LearningOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface LearningQuestion {
  id: string;
  type: 'COMPREHENSION' | 'PRACTICE' | 'REVIEW';
  word: Word;
  sentence: string; // The sentence with the word
  questionText: string; // "What does this sentence mean?"
  options: LearningOption[];
}

export interface Lesson {
  targetWord: Word;
  intro: {
    definition: string;
    exampleSentence: string;
  };
  queue: LearningQuestion[];
}

// --- Auth Types ---

export interface UserProfile {
  username: string;
  learningIndex: number;
  learnedWords: string[];
  mistakes: Record<string, number>; // wordId -> count of mistakes
  isPublic?: boolean;
  srs_state?: Record<string, SRSState>;
}

// --- ADVANCED BETA TYPES ---

export interface SRSState {
  interval: number; // Days
  nextReview: number; // Timestamp
  easeFactor: number; // Default 2.5
  streak: number;
}

export interface ExerciseOption {
  text: string;
  correct: boolean;
  distractor_type?: string;
}

export interface Exercise {
  type: 'synonym_selection' | 'antonym_identification' | 'sentence_completion' | 'scenario_application' | 'reverse_definition' | 'sentence_creation';
  difficulty: 'easy' | 'medium' | 'hard';
  question?: string;
  scenario?: string;
  definition?: string;
  options?: ExerciseOption[];
  feedback?: {
    correct: string;
    incorrect: string;
  };
  hints?: { level: number; hint: string; pointDeduction: number }[];
  instruction?: string;
}

export interface RichVocabularyCard {
  word: string;
  metadata: {
    partOfSpeech: string;
    difficulty: number;
    frequency: string;
  };
  pronunciation: {
    ipa: string;
    syllables: string[];
  };
  definition: {
    primary: string;
  };
  etymology: {
    origin: string;
    literalMeaning: string;
  };
  memoryHooks: {
    mnemonic: string;
    visual: string;
  };
  examples: {
    sentence: string;
    context: string;
  }[];
  exercises: Exercise[];
}
