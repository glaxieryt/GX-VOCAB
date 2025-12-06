
import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";
import { Word, QuizQuestion, QuizQuestionType, Lesson, LearningQuestion } from '../types';
import { allWords } from '../data';

// Safe API Key access
const apiKey = process.env.API_KEY;
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

// Helper to shuffle array in place
const shuffleArray = (array: any[]) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array;
};

// --- Helper for Underlining ---
const highlightWord = (text: string, term: string): string => {
    if (!text) return "";
    // If already contains HTML tags for underline, assume it's good (or partially good)
    if (text.includes('<u>')) return text;

    try {
        // Escape special regex characters in the term
        const safeTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Match word boundary, allow for suffixes like 'd', 'ed', 's', 'ing' (basic heuristic)
        // \w* allows for 'Abate' matching 'Abated'
        const regex = new RegExp(`\\b${safeTerm}\\w*\\b`, 'gi');
        
        return text.replace(regex, (match) => `<u>${match}</u>`);
    } catch (e) {
        return text;
    }
};

// --- Audio Handling ---

let audioContext: AudioContext | null = null;

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Convert PCM 16-bit to Float32 (-1.0 to 1.0)
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const speakText = async (text: string) => {
    // 1. Browser Native Fallback (Offline or No Key)
    if (!ai) {
        speakNative(text);
        return;
    }

    try {
        // Initialize Audio Context on user gesture
        if (!audioContext) {
             audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
        }
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        // Clean HTML tags for pronunciation
        const cleanText = text.replace(/<[^>]*>/g, '');
        
        // Adjust prompt based on whether it is a single word or a sentence
        const isSentence = cleanText.trim().includes(' ');
        const prompt = isSentence 
            ? `Read the following sentence naturally, with a soft and soothing tone: "${cleanText}"`
            : `Say the word: ${cleanText}`;

        const response = await withTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: 'gemini-2.5-flash-preview-tts',
                contents: [{ parts: [{ text: prompt }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: 'Kore' }, // Kore is typically the female voice
                        },
                    },
                },
            }),
            5000 
        );

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        
        if (!base64Audio) throw new Error("No audio data received");

        const audioBuffer = await decodeAudioData(
            decode(base64Audio),
            audioContext,
            24000,
            1
        );

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start();

    } catch (error) {
        console.error("Gemini TTS Failed, falling back to browser:", error);
        speakNative(text);
    }
};

// Fallback to browser speech
const speakNative = (text: string) => {
    const cleanText = text.replace(/<[^>]*>/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-US';
    
    // Try to find a female voice or a "Google" voice which is often higher quality
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
        (v.name.includes('Female') || v.name.includes('Google US English')) && v.lang.startsWith('en')
    );
    
    if (preferredVoice) {
        utterance.voice = preferredVoice;
    }
    
    // Make it slightly softer/slower if possible
    utterance.rate = 0.9;
    utterance.pitch = 1.1; 

    window.speechSynthesis.speak(utterance);
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
        sentence = highlightWord(sentence, word.term);

        const options = [...distractors, word.meaning];
        shuffleArray(options);

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
        "introSentence": "A clear, simple sentence using the word. Wrap the word ${word.term} in <u> tags.",
        "questions": [
           {
             "sentence": "A sentence using ${word.term} (wrap word in <u> tags)",
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
        
        shuffleArray(opts);

        return {
            id: `leq_${word.id}_${idx}`,
            type: idx === 0 ? 'COMPREHENSION' : 'PRACTICE',
            word: word,
            sentence: highlightWord(q.sentence, word.term),
            questionText: "What does this sentence mean?",
            options: opts
        };
    });

    return {
        targetWord: word,
        intro: {
            definition: word.meaning,
            exampleSentence: highlightWord(data.introSentence || word.sentence || `The word ${word.term} is used in English.`, word.term)
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
        
        shuffleArray(opts);
        
        return {
            id: `rev_${word.id}_${Date.now()}`,
            type: 'REVIEW',
            word: word,
            sentence: highlightWord(d.sentence || `${word.term} is the word here.`, word.term),
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
        ];
        
        shuffleArray(opts);

        return {
            id: `fb_${word.id}_${idx}`,
            type: idx === 0 ? 'COMPREHENSION' : 'PRACTICE',
            word: word,
            sentence: highlightWord(word.sentence || `The word is ${word.term}.`, word.term),
            questionText: `What is the definition of ${word.term}?`,
            options: opts
        };
    };

    return {
        targetWord: word,
        intro: {
            definition: word.meaning,
            exampleSentence: highlightWord(word.sentence || "Example unavailable (Offline Mode).", word.term)
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
     ];
     
     shuffleArray(opts);

     return {
         id: `rev_fb_${word.id}`,
         type: 'REVIEW',
         word: word,
         sentence: `Review Word: <u>${word.term}</u>`,
         questionText: `What is the definition of ${word.term}?`,
         options: opts
     };
}
