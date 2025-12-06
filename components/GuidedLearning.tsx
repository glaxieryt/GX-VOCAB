
import React, { useState, useEffect, useRef } from 'react';
import { Word, Lesson, LearningQuestion, LearningOption } from '../types';
import { generateLessonContent, generateReviewQuestion, pronounceWord } from '../services/geminiService';
import { allWords } from '../data';
import Button from './Button';

interface GuidedLearningProps {
  initialIndex: number;
  learnedWordsIds: string[];
  onWordComplete: (wordId: string) => void;
  onExit: () => void;
}

const SpeakerIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
      <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318 0-2.402.084C2.022 7.667 2 7.787 2 7.917v8.166c0 .13.022.25.106.333.084.084 1.261.084 2.402.084h1.932l4.5 4.5c.945.945 2.56.276 2.56-1.06V4.06zM18.53 12a4.48 4.48 0 00-1.782-3.582c-.39-.292-.936-.217-1.228.172-.292.39-.217.936.172 1.228a2.482 2.482 0 01.988 1.982c0 .822-.39 1.562-.988 2.182-.389.292-.464.838-.172 1.228.292.39.838.464 1.228.172A4.48 4.48 0 0018.53 12z" />
      <path d="M20.94 12c0-3.308-1.838-6.184-4.57-7.653-.408-.22-.916-.07-1.135.337-.22.407-.07.915.337 1.135 2.162 1.162 3.618 3.44 3.618 6.181 0 2.74-1.456 5.02-3.618 6.181-.407.22-.557.728-.337 1.135.22.407.727.557 1.135.337 2.732-1.469 4.57-4.345 4.57-7.653z" />
    </svg>
);

const GuidedLearning: React.FC<GuidedLearningProps> = ({ 
  initialIndex, 
  learnedWordsIds, 
  onWordComplete, 
  onExit 
}) => {
  // State
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  
  // Interaction State
  const [step, setStep] = useState<'INTRO' | 'QUIZ'>('INTRO');
  const [questionIdx, setQuestionIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isChecked, setIsChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  // Load Lesson Logic
  const loadNextLesson = async () => {
    setLoading(true);
    setError(false);
    
    try {
        const targetWord = allWords[currentIndex];
        
        if (!targetWord) {
            // End of words
            alert("Congratulations! You have completed all words.");
            onExit();
            return;
        }

        // 1. Generate Main Lesson
        const mainLesson = await generateLessonContent(targetWord);
        
        // 2. Inject Review Questions (Spaced Repetition)
        // If we have learned enough words, inject a review every few lessons
        const shouldReview = learnedWordsIds.length > 3 && currentIndex % 3 === 0;
        
        if (shouldReview) {
            // Pick a random previously learned word
            const reviewId = learnedWordsIds[Math.floor(Math.random() * learnedWordsIds.length)];
            // Find word object (requires looking up by ID or matching term if ID is index based)
            // Assuming learnedWordsIds stores the 'id' string from data.ts
            const reviewWord = allWords.find(w => w.id === reviewId);
            
            if (reviewWord) {
                const reviewQ = await generateReviewQuestion(reviewWord);
                // Insert review question at random spot after comprehension (index 1 or 2)
                const insertAt = 1 + Math.floor(Math.random() * (mainLesson.queue.length - 1));
                mainLesson.queue.splice(insertAt, 0, reviewQ);
            }
        }

        setLesson(mainLesson);
        setStep('INTRO');
        setQuestionIdx(0);
        setSelectedOption(null);
        setIsChecked(false);
    } catch (e) {
        console.error("Failed to load lesson", e);
        setError(true);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    loadNextLesson();
  }, [currentIndex]);

  const handleOptionClick = (optId: string) => {
    if (isChecked) return;
    setSelectedOption(optId);
  };

  const handleCheck = () => {
    if (!selectedOption || !lesson) return;
    
    const currentQ = lesson.queue[questionIdx];
    const option = currentQ.options.find(o => o.id === selectedOption);
    
    if (option?.isCorrect) {
        setIsCorrect(true);
        // Play success sound logic here if desired
    } else {
        setIsCorrect(false);
    }
    
    setIsChecked(true);
  };

  const handleNext = () => {
    if (!lesson) return;

    // Move to next question
    if (questionIdx < lesson.queue.length - 1) {
        setQuestionIdx(prev => prev + 1);
        setSelectedOption(null);
        setIsChecked(false);
        setIsCorrect(false);
    } else {
        // Lesson Complete
        onWordComplete(lesson.targetWord.id);
        setCurrentIndex(prev => prev + 1);
        // Effect will trigger next lesson load
    }
  };

  const handlePronounce = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lesson?.targetWord) {
        pronounceWord(lesson.targetWord.term);
    }
  };

  if (loading) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] animate-pulse">
              <div className="w-12 h-12 border-4 border-zinc-200 border-t-black rounded-full animate-spin mb-6"></div>
              <h2 className="text-xl font-serif font-bold">Preparing your lesson...</h2>
              <p className="text-zinc-500 text-sm mt-2">AI is crafting sentences</p>
          </div>
      );
  }

  if (error || !lesson) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
              <p className="text-red-600 mb-4">Something went wrong loading the lesson.</p>
              <div className="flex gap-4">
                  <Button onClick={() => loadNextLesson()}>Retry</Button>
                  <Button variant="outline" onClick={onExit}>Exit</Button>
              </div>
          </div>
      );
  }

  // --- VIEW: INTRO ---
  if (step === 'INTRO') {
      return (
          <div className="max-w-xl mx-auto py-8 animate-fadeIn">
              <div className="flex justify-between items-center mb-12">
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Word {currentIndex + 1} of {allWords.length}</span>
                  <button onClick={onExit} className="text-sm underline hover:text-black">Exit</button>
              </div>

              <div className="text-center mb-12 space-y-6">
                  <span className="bg-zinc-100 text-zinc-600 px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full">New Word</span>
                  <div className="flex items-center justify-center gap-4">
                    <h1 className="text-6xl font-serif font-black tracking-tight">{lesson.targetWord.term}</h1>
                    <button 
                        onClick={handlePronounce}
                        className="p-2 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-black transition-colors"
                    >
                        <SpeakerIcon />
                    </button>
                  </div>
                  <p className="text-2xl text-zinc-600 font-light max-w-md mx-auto">{lesson.intro.definition}</p>
              </div>

              <div className="bg-zinc-50 border border-zinc-200 p-8 mb-12 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-black"></div>
                  <p 
                    className="text-xl italic text-zinc-800 font-serif leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: `"${lesson.intro.exampleSentence}"` }}
                  />
              </div>

              <Button fullWidth onClick={() => setStep('QUIZ')} className="h-14 text-lg shadow-xl">
                  Start Practice
              </Button>
          </div>
      );
  }

  // --- VIEW: QUIZ STEPS ---
  const currentQ = lesson.queue[questionIdx];
  const isReview = currentQ.type === 'REVIEW';

  return (
      <div className="max-w-xl mx-auto py-8 animate-fadeIn">
          {/* Progress Bar */}
          <div className="w-full bg-zinc-100 h-1.5 mb-8 rounded-full overflow-hidden">
              <div 
                  className="bg-black h-full transition-all duration-500 ease-out"
                  style={{ width: `${((questionIdx) / lesson.queue.length) * 100}%` }}
              ></div>
          </div>

          <div className="mb-10 min-h-[160px]">
               {isReview && (
                   <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-2 block">Spaced Repetition Review</span>
               )}
               <h2 className="text-xl font-medium mb-6">{currentQ.questionText}</h2>
               
               <div className="bg-zinc-50 border border-zinc-200 p-6 rounded-lg">
                   <p 
                        className="text-2xl font-serif leading-relaxed text-zinc-900"
                        dangerouslySetInnerHTML={{ __html: currentQ.sentence }}
                   />
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
                      {isCorrect ? 'Continue' : 'Got it'}
                  </Button>
              )}
          </div>
      </div>
  );
};

export default GuidedLearning;
