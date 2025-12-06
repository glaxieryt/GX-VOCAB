import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Word, QuizQuestion, QuizQuestionType, Lesson, LearningQuestion } from '../types';
import { allWords } from '../data';

// Helper to safely get API key without crashing if process is undefined (common in pure browser builds)
const getApiKey = () => {
  if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      return process.env.API_KEY;
  }
  // Fallback for Vite environments if injected via import.meta (not standard in this setup but safe to have)
  // or if 'define' plugin handles process.env replacement.
  return undefined;
};

const apiKey = getApiKey();
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Helper to timeout a promise
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error("Timeout"));
        }, ms);
        promise.then(
            (value) => { clearTimeout(timer); resolve(value); },
            (error) => { clearTimeout(timer); reject(error); }
        );
    });
};

export const getEasyMeaning = async (word: string, meaning: string): Promise<string> => {
  if (!ai) return "Meaning not available (Offline).";

  try {
    const prompt = `
      Provide a very short, easy-to-remember explanation or mnemonic for the vocabulary word "${word}" which means "${meaning}".
      Keep it under 25 words. Make it catchy or use a simple analogy.
      Do not add markdown formatting or quotes.
    `;

    const response = await withTimeout<GenerateContentResponse>(
        ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        }),
        5000 // 5s timeout
    );

    return response.text || "No simple meaning available.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Could not generate mnemonic.";
  }
};

export const getSentence = async (word: string, meaning: string): Promise<string> => {
    if (!ai) return "";
    try {
        const prompt = `Write a simple sentence using the word "${word}" (meaning: ${meaning}). Keep it under 20 words. Do not quote the word.`;
        const response = await withTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            }),
            5000
        );
        return response.text?.trim() || "";
    } catch (e) {
        return "";
    }
};

export const generateContextQuizQuestion = async (word: Word, distractors: string[]): Promise<QuizQuestion> => {
    if (!ai) {
         throw new Error("No API Key");
    }

    const prompt = `
      Create a "Context" quiz question for the word "${word.term}" (meaning: ${word.meaning}).
      
      Task: Write a single clear sentence that uses the word "${word.term}".
      Format: Return ONLY the sentence. Wrap the word "${word.term}" (or its variation like ${word.term}ed) in HTML <u> tags.
      
      Example Input: Word: Abate
      Example Output: The storm began to <u>abate</u>, allowing us to leave.
    `;

    try {
        const response = await withTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            }),
            6000
        );
        
        let sentence = response.text?.trim() || "";
        // Cleanup if model adds labels
        sentence = sentence.replace(/^sentence:\s*/i, '');
        sentence = sentence.replace(/`/g, '');
        
        // Ensure underlining if the model forgot
        if (!sentence.includes("<u>")) {
            const regex = new RegExp(`\\b${word.term}\\w*\\b`, 'i');
            sentence = sentence.replace(regex, (match) => `<u>${match}</u>`);
        }

        const options = [...distractors, word.meaning];
        // Shuffle
        for (let i = options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [options[i], options[j]] = [options[j], options[i]];
        }

        return {
            id: `q_${word.id}_context_gen`,
            type: QuizQuestionType.CONTEXT,
            word: word,
            questionText: sentence,
            options: options,
            correctOptionIndex: options.indexOf(word.meaning),
        };
    } catch (error) {
        console.error("Error generating context question", error);
        throw error;
    }
}

// --- Guided Learning Content Generation ---

export const generateLessonContent = async (word: Word, previousWords: Word[] = []): Promise<Lesson> => {
  // Use fallback immediately if no AI
  if (!ai) {
      return generateFallbackLesson(word);
  }

  try {
    const prompt = `
      Generate a vocabulary lesson for the word: "${word.term}" (Meaning: "${word.meaning}").
      
      Output JSON format ONLY:
      {
        "introSentence": "A clear, simple sentence using the word.",
        "questions": [
           {
             "sentence": "A sentence using ${word.term}",
             "correctMeaning": "Correct meaning interpretation",
             "wrongMeaning1": "Wrong meaning 1",
             "wrongMeaning2": "Wrong meaning 2",
             "wrongMeaning3": "Wrong meaning 3"
           }
        ]
      }
      Generate 3 distinct questions.
    `;

    const response = await withTimeout<GenerateContentResponse>(
        ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        }),
        8000 // 8s timeout for lesson generation
    );

    const data = JSON.parse(response.text || "{}");
    
    if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
        throw new Error("Invalid AI response format");
    }

    // Construct Lesson Object
    const questions: LearningQuestion[] = data.questions.map((q: any, idx: number) => {
        const opts = [
            { id: 'opt_c', text: q.correctMeaning, isCorrect: true },
            { id: 'opt_w1', text: q.wrongMeaning1, isCorrect: false },
            { id: 'opt_w2', text: q.wrongMeaning2, isCorrect: false },
            { id: 'opt_w3', text: q.wrongMeaning3, isCorrect: false },
        ];
        
        // Shuffle options
        for (let i = opts.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [opts[i], opts[j]] = [opts[j], opts[i]];
        }

        return {
            id: `leq_${word.id}_${idx}`,
            type: idx === 0 ? 'COMPREHENSION' : 'PRACTICE',
            word: word,
            sentence: q.sentence,
            questionText: "What does this sentence mean?",
            options: opts
        };
    });

    return {
        targetWord: word,
        intro: {
            definition: word.meaning,
            exampleSentence: data.introSentence || word.sentence || `The word ${word.term} is used in English.`
        },
        queue: questions
    };

  } catch (error) {
    console.error("Gemini Lesson Gen Error (Falling back to local):", error);
    return generateFallbackLesson(word);
  }
};

export const generateReviewQuestion = async (word: Word): Promise<LearningQuestion> => {
    if (!ai) {
        return generateFallbackReview(word);
    }
    
    try {
        const prompt = `
          Generate a multiple choice question for the word "${word.term}".
          JSON Output: { "sentence": "Sentence using ${word.term}", "correct": "Meaning", "distractor1": "...", "distractor2": "...", "distractor3": "..." }
        `;
        const response = await withTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { responseMimeType: "application/json" }
            }),
            4000
        );
        const d = JSON.parse(response.text || "{}");
        const opts = [
            { id: 'c', text: d.correct || word.meaning, isCorrect: true },
            { id: 'w1', text: d.distractor1 || "Wrong 1", isCorrect: false },
            { id: 'w2', text: d.distractor2 || "Wrong 2", isCorrect: false },
            { id: 'w3', text: d.distractor3 || "Wrong 3", isCorrect: false }
        ];
        // Shuffle
        opts.sort(() => Math.random() - 0.5);
        
        return {
            id: `rev_${word.id}_${Date.now()}`,
            type: 'REVIEW',
            word: word,
            sentence: d.sentence || `${word.term} is the word here.`,
            questionText: `What does "${word.term}" mean in this context?`,
            options: opts
        };
    } catch {
        return generateFallbackReview(word);
    }
}

// Fallbacks used if offline or error
const generateFallbackLesson = (word: Word): Lesson => {
    const fallbackQ = (idx: number): LearningQuestion => {
        // Pick random distractors from data
        const distractors = [];
        for(let i=0; i<3; i++) {
             const r = Math.floor(Math.random() * allWords.length);
             distractors.push(allWords[r]?.meaning || "Another meaning");
        }
        
        const opts = [
            { id: 'c', text: word.meaning, isCorrect: true },
            ...distractors.map((d, i) => ({ id: `w${i}`, text: d, isCorrect: false }))
        ].sort(() => Math.random() - 0.5);

        return {
            id: `fb_${word.id}_${idx}`,
            type: idx === 0 ? 'COMPREHENSION' : 'PRACTICE',
            word: word,
            sentence: word.sentence || `The word is ${word.term}.`,
            questionText: `What is the definition of ${word.term}?`,
            options: opts
        };
    };

    return {
        targetWord: word,
        intro: {
            definition: word.meaning,
            exampleSentence: word.sentence || "Example unavailable (Offline Mode)."
        },
        queue: Array.from({length: 3}, (_, i) => fallbackQ(i))
    };
};

const generateFallbackReview = (word: Word): LearningQuestion => {
     const distractors = [];
     for(let i=0; i<3; i++) {
          const r = Math.floor(Math.random() * allWords.length);
          distractors.push(allWords[r]?.meaning || "Another meaning");
     }
     const opts = [
         { id: 'c', text: word.meaning, isCorrect: true },
         ...distractors.map((d, i) => ({ id: `w${i}`, text: d, isCorrect: false }))
     ].sort(() => Math.random() - 0.5);

     return {
         id: `rev_fb_${word.id}`,
         type: 'REVIEW',
         word: word,
         sentence: `Review Word: ${word.term}`,
         questionText: `What is the definition of ${word.term}?`,
         options: opts
     };
}