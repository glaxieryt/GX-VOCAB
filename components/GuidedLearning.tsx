
import React, { useState, useEffect, useRef } from 'react';
import { Word, Lesson, LearningQuestion, LearningOption } from '../types';
import { generateLessonContent, generateReviewQuestion } from '../services/geminiService';
import { allWords } from '../data';
import Button from './Button';

interface GuidedLearningProps {
  initialIndex: number;
  learnedWordsIds: string[];
  onWordComplete: (wordId: string) => void;
  onExit: () => void;
}

const GuidedLearning: React.FC<GuidedLearningProps> = ({ 
  initialIndex, 
  learnedWordsIds, 
  onWordComplete, 
  onExit 
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [step, setStep] = useState<'INTRO' | 'QUESTION'>('INTRO');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Question State
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isChecked, setIsChecked] = useState(false);
  
  const loadingRef = useRef(false);

  const loadNextLesson = async () => {
    if (loadingRef.current) return;
    
    // Check bounds
    if (currentIndex >= allWords.length) {
        onExit();
        return;
    }

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const targetWord = allWords[currentIndex];
      if (!targetWord) {
        throw new Error("Word not found in database.");
      }

      // Generate base lesson
      const lesson = await generateLessonContent(targetWord);
      
      // Inject Spaced Repetition (Every 3 words, inject 1-2 review questions)
      if (currentIndex > 0 && currentIndex % 3 === 0 && learnedWordsIds.length > 0) {
          const numReviews = 1;
          for (let i = 0; i < numReviews; i++) {
              const randomReviewId = learnedWordsIds[Math.floor(Math.random() * learnedWordsIds.length)];
              const reviewWord = allWords.find(w => w.id === randomReviewId);
              if (reviewWord) {
                  const revQ = await generateReviewQuestion(reviewWord);
                  // Insert at random position after first Q
                  const pos = Math.floor(Math.random() * (lesson.queue.length - 1)) + 1;
                  lesson.queue.splice(pos, 0, revQ);
              }
          }
      }

      setCurrentLesson(lesson);
      setStep('INTRO');
      setQuestionIndex(0);
      resetQuestionState();
    } catch (e: any) {
      console.error(e);
      setError("Failed to load lesson. Please check your connection.");
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  useEffect(() => {
    loadNextLesson();
  }, [currentIndex]);

  const resetQuestionState = () => {
    setSelectedOptionId(null);
    setIsChecked(false);
  };

  const handleStartPractice = () => {
    setStep('QUESTION');
  };

  const handleOptionSelect = (id: string) => {
    if (!isChecked) {
      setSelectedOptionId(id);
    }
  };

  const handleCheck = () => {
    if (!selectedOptionId) return;
    setIsChecked(true);
  };

  const handleNext = () => {
    if (!currentLesson) return;
    
    // Move to next question or next word
    if (questionIndex < currentLesson.queue.length - 1) {
      setQuestionIndex(prev => prev + 1);
      resetQuestionState();
    } else {
      // Word Complete
      onWordComplete(currentLesson.targetWord.id);
      setCurrentIndex(prev => prev + 1);
      // loadNextLesson will trigger via useEffect
    }
  };

  // --- Renders ---

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
         <div className="w-12 h-12 border-4 border-zinc-200 border-t-black rounded-full animate-spin"></div>
         <p className="text-zinc-500 animate-pulse">Preparing your personalized lesson...</p>
      </div>
    );
  }

  if (error || !currentLesson) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
              <p className="text-red-500">{error || "Something went wrong."}</p>
              <Button onClick={() => loadNextLesson()}>Retry</Button>
              <button onClick={onExit} className="text-sm underline">Exit</button>
          </div>
      );
  }

  const progressPercent = Math.round((currentIndex / allWords.length) * 100);

  // RENDER: INTRO STEP
  if (step === 'INTRO') {
    return (
       <div className="max-w-2xl mx-auto pt-8 px-4 animate-fadeIn">
          {/* Top Bar */}
          <div className="flex justify-between items-center mb-8 text-xs font-bold uppercase tracking-widest text-zinc-400">
             <button onClick={onExit} className="hover:text-black">Exit</button>
             <span>Word {currentIndex + 1} of {allWords.length}</span>
          </div>

          <div className="bg-white border border-zinc-200 p-8 md:p-12 shadow-sm text-center space-y-8">
             <div className="inline-block bg-zinc-100 text-zinc-500 px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full">
                New Word
             </div>
             
             <h1 className="text-5xl md:text-6xl font-serif font-bold text-black">{currentLesson.targetWord.term}</h1>
             
             <div className="space-y-2">
                 <p className="text-xl font-medium text-zinc-800">{currentLesson.intro.definition}</p>
             </div>

             <div className="border-t border-zinc-100 pt-8">
                 <p className="text-lg italic text-zinc-600 font-serif">"{currentLesson.intro.exampleSentence}"</p>
             </div>
          </div>

          <div className="mt-8">
             <Button fullWidth onClick={handleStartPractice} className="h-14 text-lg shadow-lg">
                Start Practice
             </Button>
          </div>
       </div>
    );
  }

  // RENDER: QUESTION STEP
  const currentQ = currentLesson.queue[questionIndex];
  const isCorrect = currentQ.options.find(o => o.id === selectedOptionId)?.isCorrect;

  return (
    <div className="max-w-xl mx-auto pt-6 px-4 pb-20 animate-fadeIn">
      {/* Progress Bar */}
      <div className="mb-8">
         <div className="flex justify-between text-xs font-bold text-zinc-400 mb-2 uppercase tracking-widest">
            <span className="cursor-pointer hover:text-black" onClick={onExit}>Quit</span>
            <span>{progressPercent}% Complete</span>
         </div>
         <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-black transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
         </div>
      </div>

      {/* Question Card */}
      <div className="mb-6">
         {currentQ.type === 'REVIEW' && (
             <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2 block">Spaced Repetition Review</span>
         )}
         <h2 className="text-xl font-bold mb-4">{currentQ.questionText}</h2>
         
         <div className="bg-zinc-50 border-l-4 border-black p-6 mb-6">
            <p className="text-xl font-serif leading-relaxed" dangerouslySetInnerHTML={{ __html: currentQ.sentence }} />
         </div>

         {/* Options */}
         <div className="space-y-3">
            {currentQ.options.map((opt) => {
               let stateStyles = "bg-white border-zinc-200 hover:bg-zinc-50 text-black"; // Default
               
               if (selectedOptionId === opt.id) {
                   stateStyles = "border-black bg-zinc-100 ring-1 ring-black"; // Selected
               }

               if (isChecked) {
                   if (opt.isCorrect) {
                       stateStyles = "bg-[#4CAF50] border-[#4CAF50] text-white"; // Correct Green
                   } else if (selectedOptionId === opt.id && !opt.isCorrect) {
                       stateStyles = "bg-[#F44336] border-[#F44336] text-white"; // Wrong Red
                   } else {
                       stateStyles = "opacity-50 bg-white border-zinc-100"; // Others dimmed
                   }
               }

               return (
                  <button
                    key={opt.id}
                    disabled={isChecked}
                    onClick={() => handleOptionSelect(opt.id)}
                    className={`w-full text-left p-4 border rounded-lg transition-all duration-200 flex items-center justify-between ${stateStyles}`}
                  >
                     <span className="font-medium text-sm md:text-base">{opt.text}</span>
                     {isChecked && opt.isCorrect && <span>✓</span>}
                     {isChecked && !opt.isCorrect && selectedOptionId === opt.id && <span>✗</span>}
                  </button>
               )
            })}
         </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 p-4 md:px-8 z-20">
         <div className="max-w-xl mx-auto">
            {!isChecked ? (
               <Button 
                 fullWidth 
                 disabled={!selectedOptionId} 
                 onClick={handleCheck}
                 className={!selectedOptionId ? "bg-zinc-300 border-zinc-300 text-zinc-500" : ""}
               >
                 Check Answer
               </Button>
            ) : (
               <div className="animate-slideUp">
                  <div className={`mb-4 font-bold ${isCorrect ? 'text-[#4CAF50]' : 'text-[#F44336]'}`}>
                     {isCorrect ? "Excellent!" : "Not quite right."}
                  </div>
                  <Button 
                     fullWidth 
                     onClick={handleNext}
                     className={isCorrect ? "bg-[#4CAF50] border-[#4CAF50]" : "bg-black border-black"}
                  >
                     Next
                  </Button>
               </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default GuidedLearning;
