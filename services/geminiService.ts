
import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";
import { Word, QuizQuestion, QuizQuestionType, Lesson, LearningQuestion, RichVocabularyCard } from '../types';
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
    if (text.includes('<u>')) return text;

    try {
        const safeTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const speakText = async (text: string) => {
    if (!ai) {
        speakNative(text);
        return;
    }

    try {
        if (!audioContext) {
             audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
        }
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        const cleanText = text.replace(/<[^>]*>/g, '');
        const isSentence = cleanText.trim().includes(' ');
        const prompt = isSentence 
            ? `Read the following sentence naturally, with a soft and soothing tone: "${cleanText}"`
            : `Say the word: ${cleanText}`;

        // INCREASED TIMEOUT TO 15s to prevent timeouts
        const response = await withTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: 'gemini-2.5-flash-preview-tts',
                contents: [{ parts: [{ text: prompt }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: 'Kore' },
                        },
                    },
                },
            }),
            15000 
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

const speakNative = (text: string) => {
    const cleanText = text.replace(/<[^>]*>/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-US';
    
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
        (v.name.includes('Female') || v.name.includes('Google US English') || v.name.includes('Samantha') || v.name.includes('Zira')) 
        && v.lang.startsWith('en')
    );
    
    if (preferredVoice) {
        utterance.voice = preferredVoice;
    }
    
    utterance.rate = 0.9;
    utterance.pitch = 1.15; 

    window.speechSynthesis.speak(utterance);
};


export const getEasyMeaning = async (word: string, context?: string): Promise<string> => {
  if (!ai) return "Meaning not available (Offline).";

  try {
    const prompt = `
      Provide a very short, easy-to-remember explanation or definition for the text "${word}".
      ${context ? `Context: This word refers to: "${context}".` : ''}
      Keep it under 20 words. Simple language.
      Do not add markdown formatting or quotes.
    `;

    const response = await withTimeout<GenerateContentResponse>(
        ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        }),
        8000
    );

    return response.text?.trim() || "No simple meaning available.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Could not generate meaning.";
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
            8000
        );
        return response.text?.trim() || "";
    } catch (e) {
        return "";
    }
};

export const generateContextQuizQuestion = async (word: Word, distractors: string[]): Promise<QuizQuestion> => {
    if (!ai) throw new Error("No API Key");

    const prompt = `
      Create a "Context" quiz question for the word "${word.term}" (meaning: ${word.meaning}).
      Task: Write a single clear sentence that uses the word "${word.term}".
      Format: Return ONLY the sentence. Wrap the word "${word.term}" (or its variation) in HTML <u> tags.
    `;

    try {
        const response = await withTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            }),
            8000
        );
        
        let sentence = response.text?.trim() || "";
        sentence = sentence.replace(/^sentence:\s*/i, '').replace(/`/g, '');
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

export const generateLessonContent = async (word: Word, previousWords: Word[] = []): Promise<Lesson> => {
  if (!ai) return generateFallbackLesson(word);

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
            config: { responseMimeType: "application/json" }
        }),
        10000
    );

    const data = JSON.parse(response.text || "{}");
    if (!data.questions || !Array.isArray(data.questions)) throw new Error("Invalid format");

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
            exampleSentence: highlightWord(data.introSentence || word.sentence || `The word ${word.term} is used here.`, word.term)
        },
        queue: questions
    };

  } catch (error) {
    return generateFallbackLesson(word);
  }
};

export const generateReviewQuestion = async (word: Word): Promise<LearningQuestion> => {
    if (!ai) return generateFallbackReview(word);
    
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
            8000
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
            sentence: highlightWord(d.sentence || `${word.term} is used here.`, word.term),
            questionText: `What does "${word.term}" mean in this context?`,
            options: opts
        };
    } catch {
        return generateFallbackReview(word);
    }
}

// --- RICH CONTENT GENERATION FOR BETA SRS ---

export const generateRichVocabularyData = async (word: Word): Promise<RichVocabularyCard> => {
    if (!ai) throw new Error("No API connection");

    const prompt = `
    Generate comprehensive vocabulary data for the word "${word.term}" (Meaning: "${word.meaning}").
    Strictly follow this JSON schema:
    {
      "word": "${word.term}",
      "metadata": { "partOfSpeech": "noun/verb/adj", "difficulty": 1-10, "frequency": "low/medium/high" },
      "pronunciation": { "ipa": "/.../", "syllables": ["syll", "a", "ble"] },
      "definition": { "primary": "Clear definition" },
      "etymology": { "origin": "e.g. Latin", "literalMeaning": "literal meaning" },
      "memoryHooks": { "mnemonic": "memorable trick", "visual": "visual description of an image that represents the word" },
      "examples": [ { "sentence": "sentence 1", "context": "context type" }, { "sentence": "sentence 2", "context": "context type" } ],
      "exercises": [
         { 
           "type": "synonym_selection", 
           "difficulty": "easy",
           "question": "Which word is CLOSEST to ${word.term}?",
           "options": [{ "text": "correct synonym", "correct": true }, { "text": "wrong 1", "correct": false }, { "text": "wrong 2", "correct": false }, { "text": "wrong 3", "correct": false }],
           "feedback": { "correct": "Good job!", "incorrect": "Explanation..." }
         },
         {
           "type": "antonym_identification",
           "difficulty": "easy",
           "question": "Which word is OPPOSITE to ${word.term}?",
           "options": [{ "text": "correct antonym", "correct": true }, { "text": "wrong 1", "correct": false }, { "text": "wrong 2", "correct": false }, { "text": "wrong 3", "correct": false }],
           "feedback": { "correct": "Correct!", "incorrect": "Explanation..." }
         },
         {
           "type": "sentence_completion",
           "difficulty": "medium",
           "question": "Fill in the blank: [Sentence with blank]",
           "options": [{ "text": "${word.term}", "correct": true }, { "text": "distractor1", "correct": false }, { "text": "distractor2", "correct": false }, { "text": "distractor3", "correct": false }],
           "feedback": { "correct": "Yes!", "incorrect": "No..." }
         },
         {
            "type": "scenario_application",
            "difficulty": "medium",
            "scenario": "Short scenario description...",
            "question": "Which word describes this?",
            "options": [{ "text": "${word.term}", "correct": true }, { "text": "distractor1", "correct": false }, { "text": "distractor2", "correct": false }, { "text": "distractor3", "correct": false }],
            "feedback": { "correct": "Yes!", "incorrect": "No..." }
         },
         {
            "type": "reverse_definition",
            "difficulty": "hard",
            "definition": "The definition...",
            "hints": [{ "level": 1, "hint": "Starts with...", "pointDeduction": 3 }]
         },
         {
             "type": "sentence_creation",
             "difficulty": "hard",
             "instruction": "Write a sentence using ${word.term}."
         }
      ]
    }`;

    try {
        const response = await withTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { responseMimeType: "application/json" }
            }),
            15000 // 15s timeout for large content
        );
        const text = response.text || "{}";
        const data = JSON.parse(text);
        
        // Basic validation
        if (!data.exercises || !Array.isArray(data.exercises)) throw new Error("Invalid schema");
        
        return data as RichVocabularyCard;
    } catch (e) {
        console.error("Rich Data Gen Failed", e);
        throw e;
    }
}

export const generateWordImage = async (visualDescription: string): Promise<string | null> => {
    if (!ai) return null;
    try {
        // Use gemini-2.5-flash-image as requested in system rules
        // Note: For image GENERATION, usually models like imagen-3.0-generate-001 are used.
        // However, user instructions explicitly asked to use 'gemini-2.5-flash-image' 
        // We will attempt to use it as instructed. 
        // If it's a multimodal input model only, it might not output inlineData.
        
        const response = await withTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: 'gemini-2.5-flash-image', 
                contents: `Create a simple, minimalist educational illustration representing: ${visualDescription}`,
            }),
            15000
        );

        // Check for image parts in response
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData && part.inlineData.mimeType.startsWith('image')) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
        return null;
    } catch (e) {
        console.error("Image generation failed", e);
        return null;
    }
};

const generateFallbackLesson = (word: Word): Lesson => {
    const fallbackQ = (idx: number): LearningQuestion => {
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
            exampleSentence: highlightWord(word.sentence || "Example unavailable.", word.term)
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
