
import React, { useState, useEffect } from 'react';
import { Word, Lesson, LearningQuestion } from '../types';
import { generateLessonContent, generateReviewQuestion, speakText } from '../services/geminiService';
import { playSuccessSound, playErrorSound } from '../services/audioService';
import { allWords } from '../data';
import Button from './Button';

interface GuidedLearningProps {
  initialIndex: number;
  learnedWordsIds: string[];
  onWordComplete: (wordId: string) => void;
  onMistake: (wordId: string) => void;
  onExit: () => void;
}

const SpeakerIcon = ({ large = false }: { large?: boolean }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={large ? "w-8 h-8" : "w-5 h-5"}>
      <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318 0-2.402.084C2.022 7.667 2 7.787 2 7.917v8.166c0 .13.022.25.106.333.084.084 1.261.084 2.402.084h1.932l4.5 4.5c.945.945 2.56.276 2.56-1.06V4.06zM18.53 12a4.48 4.48 0 00-1.782-3.582c-.39-.292-.936-.217-1.228.172-.292.39-.217.936.172 1.228a2.482 2.482 0 01.988 1.982c0 .822-.39 1.562-.988 2.182-.389.292-.464.838-.172 1.228.292.39.838.464 1.228.172A4.48 4.48 0 0018.53 12z" />
      <path d="M20.94 12c0-3.308-1.838-6.184-4.57-7.653-.408-.22-.916-.07-1.135.337-.22.407-.07.915.337 1.135 2.162 1.162 3.618 3.44 3.618 6.181 0 2.74-1.456 5.02-3.618 6.181-.407.22-.557.728-.337 1.135.22.407.727.557 1.135.337 2.732-1.469 4.57-4.345 4.57-7.653z" />
    </svg>
);

const GuidedLearning: React.FC<GuidedLearningProps> = ({ 
  initialIndex, 
  learnedWordsIds, 
  onWordComplete, 
  onMistake,
  onExit 
}) => {
  const BATCH_SIZE = 10;
  
  // -- State for flow --
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  
  // Modes: 'LEARNING' (new word), 'BATCH_REVIEW' (quiz 10 words), 'MISTAKE_CORRECTION' (fixing errors)
  const [mode, setMode] = useState<'LEARNING' | 'BATCH_REVIEW' | 'MISTAKE_CORRECTION'>('LEARNING');
  
  // Data for current word lesson
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Data for Batch Review / Correction
  const [reviewQueue, setReviewQueue] = useState<LearningQuestion[]>([]);
  const [mistakesQueue, setMistakesQueue] = useState<Word[]>([]); // Words to retry
  
  // UI Interaction State
  const [step, setStep] = useState<'INTRO' | 'QUIZ'>('INTRO'); // Only for LEARNING mode
  const [questionIdx, setQuestionIdx] = useState(0); // For learning queue or review queue
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isChecked, setIsChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false); // Pop up when wrong in review

  // --- Logic 1: Load New Word ---
  // Accepts an indexOverride to handle the async state update issue in handleNext
  const loadNewWord = async (indexOverride?: number) => {
    setLoading(true);
    setMode('LEARNING');
    try {
      // Use override if provided, otherwise current state (initial load)
      const indexToLoad = indexOverride !== undefined ? indexOverride : currentIndex;
      
      const targetWord = allWords[indexToLoad];
      if (!targetWord) {
        alert("Course Complete!");
        onExit();
        return;
      }
      
      const content = await generateLessonContent(targetWord);
      setLesson(content);
      setStep('INTRO');
      setQuestionIdx(0);
      setSelectedOption(null);
      setIsChecked(false);
      
      // Auto-speak intro word
      speakText(targetWord.term);
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // --- Logic 2: Trigger Batch Review ---
  const startBatchReview = async (wordsToReview: Word[]) => {
      setLoading(true);
      setMode('BATCH_REVIEW');
      setMistakesQueue([]); // Clear previous mistakes for this new round
      
      try {
          // Generate 1 question for each word
          const questions: LearningQuestion[] = [];
          for (const w of wordsToReview) {
              const q = await generateReviewQuestion(w);
              questions.push(q);
          }
          setReviewQueue(questions);
          setQuestionIdx(0);
          setSelectedOption(null);
          setIsChecked(false);
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
    // Initial Load
    loadNewWord();
  }, []); // Run once on mount

  // --- Interaction Handlers ---

  const handleOptionClick = (optId: string) => {
    if (isChecked) return;
    setSelectedOption(optId);
  };

  const handleCheck = () => {
    if (!selectedOption) return;
    
    let currentQ: LearningQuestion;
    
    if (mode === 'LEARNING') {
        if (!lesson) return;
        currentQ = lesson.queue[questionIdx];
    } else {
        currentQ = reviewQueue[questionIdx];
    }
    
    const option = currentQ.options.find(o => o.id === selectedOption);
    const correct = !!option?.isCorrect;
    setIsCorrect(correct);
    
    if (correct) {
        playSuccessSound();
    } else {
        playErrorSound();
        if (mode === 'BATCH_REVIEW' || mode === 'MISTAKE_CORRECTION') {
             // Record mistake
             onMistake(currentQ.word.id);
             // Add to retry queue if not already there
             setMistakesQueue(prev => {
                 if (prev.find(w => w.id === currentQ.word.id)) return prev;
                 return [...prev, currentQ.word];
             });
             // Show Correction Modal
             setShowCorrectionModal(true);
        }
    }
    
    setIsChecked(true);
  };

  const handleNext = async () => {
    // 1. LEARNING MODE FLOW
    if (mode === 'LEARNING') {
        if (!lesson) return;
        
        // Still questions left in this word's lesson
        if (questionIdx < lesson.queue.length - 1) {
            setQuestionIdx(prev => prev + 1);
            setSelectedOption(null);
            setIsChecked(false);
            setIsCorrect(false);
            return;
        } 
        
        // Word Completed
        onWordComplete(lesson.targetWord.id);
        const nextIndex = currentIndex + 1;
        setCurrentIndex(nextIndex); // Update state for UI consistency

        // Check for Batch Review Trigger (Every 10 words)
        // e.g. Finished word 9 (index 9), next is 10. (10 % 10 === 0).
        if (nextIndex > 0 && nextIndex % BATCH_SIZE === 0) {
            // Get last 10 words (indexes start to nextIndex)
            const start = nextIndex - BATCH_SIZE;
            const wordsToReview = allWords.slice(start, nextIndex);
            await startBatchReview(wordsToReview);
        } else {
            // Normal Next Word - Pass nextIndex explicitly to avoid stale closure state
            await loadNewWord(nextIndex); 
        }
        return;
    }

    // 2. BATCH REVIEW / MISTAKE MODE FLOW
    // If modal is open, user must close it (implemented in modal button)
    if (showCorrectionModal) {
        setShowCorrectionModal(false);
    }

    if (questionIdx < reviewQueue.length - 1) {
        setQuestionIdx(prev => prev + 1);
        setSelectedOption(null);
        setIsChecked(false);
        setIsCorrect(false);
        return;
    }

    // End of Review Queue
    if (mistakesQueue.length === 0) {
        // SUCCESS: No mistakes left!
        alert("Batch mastered! Moving to next set.");
        // We already incremented currentIndex before entering review, so we use currentIndex
        // However, currentIndex state might be stale in this closure if it wasn't updated in a fresh render cycle.
        // It's safer to use a ref or just rely on the fact that we updated it before entering review.
        await loadNewWord(currentIndex);
    } else {
        // FAIL: Has mistakes. Must retry.
        alert(`You missed ${mistakesQueue.length} words. Starting correction round.`);
        setMode('MISTAKE_CORRECTION');
        // Generate new review queue only for mistakes
        await startBatchReview(mistakesQueue);
    }
  };


  // --- Render Helpers ---

  const renderCorrectionModal = () => {
      const currentQ = reviewQueue[questionIdx];
      return (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fadeIn">
              <div className="bg-white p-8 max-w-md w-full rounded-lg text-center">
                  <span className="text-red-600 font-bold uppercase tracking-widest text-xs mb-2 block">Incorrect</span>
                  <h2 className="text-3xl font-serif font-bold mb-4">{currentQ.word.term}</h2>
                  <p className="text-lg text-zinc-600 mb-6">{currentQ.word.meaning}</p>
                  <Button fullWidth onClick={() => setShowCorrectionModal(false)}>
                      I understand, let me continue
                  </Button>
              </div>
          </div>
      );
  };

  if (loading) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] animate-pulse">
              <div className="w-12 h-12 border-4 border-zinc-200 border-t-black rounded-full animate-spin mb-6"></div>
              <h2 className="text-xl font-serif font-bold">
                  {mode === 'LEARNING' ? 'Preparing Lesson...' : 'Generating Review...'}
              </h2>
          </div>
      );
  }

  // --- RENDER: INTRO (Only for Learning Mode) ---
  if (mode === 'LEARNING' && step === 'INTRO' && lesson) {
      return (
          <div className="max-w-xl mx-auto py-8 animate-fadeIn">
              <div className="flex justify-between items-center mb-12">
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Word {currentIndex + 1}</span>
                  <button onClick={onExit} className="text-sm underline hover:text-black">Exit</button>
              </div>

              <div className="text-center mb-12 space-y-6">
                  <span className="bg-zinc-100 text-zinc-600 px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full">New Word</span>
                  <div className="flex items-center justify-center gap-4">
                    <h1 className="text-6xl font-serif font-black tracking-tight">{lesson.targetWord.term}</h1>
                    <button 
                        onClick={(e) => { e.stopPropagation(); speakText(lesson.targetWord.term); }}
                        className="p-2 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-black transition-colors"
                    >
                        <SpeakerIcon large />
                    </button>
                  </div>
                  <p className="text-2xl text-zinc-600 font-light max-w-md mx-auto">{lesson.intro.definition}</p>
              </div>

              <div className="bg-zinc-50 border border-zinc-200 p-8 mb-12 relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-black"></div>
                  <div className="flex justify-between items-start gap-4">
                      <p 
                        className="text-xl italic text-zinc-800 font-serif leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: `"${lesson.intro.exampleSentence}"` }}
                      />
                      <button 
                         onClick={(e) => { e.stopPropagation(); speakText(lesson.intro.exampleSentence); }}
                         className="text-zinc-300 hover:text-black transition-colors"
                      >
                          <SpeakerIcon />
                      </button>
                  </div>
              </div>

              <Button fullWidth onClick={() => setStep('QUIZ')} className="h-14 text-lg shadow-xl">
                  Start Practice
              </Button>
          </div>
      );
  }

  // --- RENDER: QUIZ (Learning, Review, or Correction) ---
  const queue = mode === 'LEARNING' ? lesson?.queue : reviewQueue;
  const currentQ = queue ? queue[questionIdx] : null;

  if (!currentQ) return null;

  return (
      <div className="max-w-xl mx-auto py-8 animate-fadeIn relative">
          {showCorrectionModal && renderCorrectionModal()}

          {/* Header */}
          <div className="flex justify-between items-center mb-6">
               <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                   {mode === 'LEARNING' ? 'Practice' : mode === 'BATCH_REVIEW' ? 'Batch Revision' : 'Correction Round'}
               </span>
               <div className="text-xs font-bold bg-black text-white px-2 py-1">
                   {questionIdx + 1} / {queue?.length}
               </div>
          </div>

          <div className="mb-10 min-h-[160px]">
               <h2 className="text-xl font-medium mb-6">{currentQ.questionText}</h2>
               
               <div className="bg-zinc-50 border border-zinc-200 p-6 rounded-lg flex justify-between items-start gap-4">
                   <p 
                        className="text-2xl font-serif leading-relaxed text-zinc-900"
                        dangerouslySetInnerHTML={{ __html: currentQ.sentence }}
                   />
                   <button 
                        onClick={(e) => { e.stopPropagation(); speakText(currentQ.sentence); }}
                        className="text-zinc-300 hover:text-black transition-colors p-1"
                   >
                       <SpeakerIcon />
                   </button>
               </div>
          </div>

          <div className="space-y-3 mb-8">
              {currentQ.options.map((opt) => {
                  let statusClass = "border-zinc-200 hover:border-zinc-400 bg-white";
                  
                  if (isChecked) {
                      if (opt.isCorrect) {
                          statusClass = "border-green-600 bg-green-50 text-green-900";
                      } else if (opt.id === selectedOption) {
                          statusClass = "border-red-500 bg-red-50 text-red-900";
                      } else {
                          statusClass = "border-zinc-100 opacity-50";
                      }
                  } else if (selectedOption === opt.id) {
                      statusClass = "border-black bg-zinc-50 ring-1 ring-black";
                  }

                  return (
                      <button
                        key={opt.id}
                        onClick={() => handleOptionClick(opt.id)}
                        disabled={isChecked}
                        className={`w-full p-4 border rounded-lg text-left transition-all duration-200 flex justify-between items-center ${statusClass}`}
                      >
                          <span className="text-lg">{opt.text}</span>
                          {isChecked && opt.isCorrect && (
                              <span className="text-green-600 font-bold">✓</span>
                          )}
                          {isChecked && !opt.isCorrect && opt.id === selectedOption && (
                              <span className="text-red-500 font-bold">✗</span>
                          )}
                      </button>
                  );
              })}
          </div>

          <div className="h-16">
              {!isChecked ? (
                  <Button 
                    fullWidth 
                    onClick={handleCheck} 
                    disabled={!selectedOption}
                    className="h-14 text-lg"
                  >
                      Check Answer
                  </Button>
              ) : (
                  <Button 
                    fullWidth 
                    onClick={handleNext}
                    variant={isCorrect ? 'primary' : 'secondary'}
                    className={`h-14 text-lg ${isCorrect ? 'bg-green-600 hover:bg-green-700 border-green-600' : 'bg-zinc-800 text-white'}`}
                  >
                      {mode !== 'LEARNING' && !isCorrect ? 'Review Meaning' : 'Continue'}
                  </Button>
              )}
          </div>
      </div>
  );
};

export default GuidedLearning;
