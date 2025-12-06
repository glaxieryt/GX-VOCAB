
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
