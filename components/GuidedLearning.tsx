
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
  
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [mode, setMode] = useState<'LEARNING' | 'BATCH_REVIEW' | 'MISTAKE_CORRECTION'>('LEARNING');
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(false);
  const [reviewQueue, setReviewQueue] = useState<LearningQuestion[]>([]);
  const [mistakesQueue, setMistakesQueue] = useState<Word[]>([]);
  const [step, setStep] = useState<'INTRO' | 'QUIZ'>('INTRO');
  const [questionIdx, setQuestionIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isChecked, setIsChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);

  const loadNewWord = async (indexOverride?: number) => {
    setLoading(true);
    setMode('LEARNING');
    try {
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
      speakText(targetWord.term);
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const startBatchReview = async (wordsToReview: Word[]) => {
      setLoading(true);
      setMode('BATCH_REVIEW');
      setMistakesQueue([]);
      try {
          const questions: LearningQuestion[] = [];
          for (const w of wordsToReview) {
              const q = await generateReviewQuestion(w);
              questions.push(q);
          }
          setReviewQueue(questions);
          setQuestionIdx(0);
          setSelectedOption(null);
          setIsChecked(false);
      } catch (e) { console.error(e); } 
      finally { setLoading(false); }
  };

  useEffect(() => { loadNewWord(); }, []);

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
             onMistake(currentQ.word.id);
             setMistakesQueue(prev => {
                 if (prev.find(w => w.id === currentQ.word.id)) return prev;
                 return [...prev, currentQ.word];
             });
             setShowCorrectionModal(true);
        }
    }
    setIsChecked(true);
  };

  const handleNext = async () => {
    if (mode === 'LEARNING') {
        if (!lesson) return;
        if (questionIdx < lesson.queue.length - 1) {
            setQuestionIdx(prev => prev + 1);
            setSelectedOption(null);
            setIsChecked(false);
            setIsCorrect(false);
            return;
        } 
        
        onWordComplete(lesson.targetWord.id);
        const nextIndex = currentIndex + 1;
        setCurrentIndex(nextIndex);

        if (nextIndex > 0 && nextIndex % BATCH_SIZE === 0) {
            const start = nextIndex - BATCH_SIZE;
            const wordsToReview = allWords.slice(start, nextIndex);
            await startBatchReview(wordsToReview);
        } else {
            await loadNewWord(nextIndex); 
        }
        return;
    }

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

    if (mistakesQueue.length === 0) {
        alert("Batch mastered! Moving to next set.");
        await loadNewWord(currentIndex);
    } else {
        alert(`You missed ${mistakesQueue.length} words. Starting correction round.`);
        setMode('MISTAKE_CORRECTION');
        await startBatchReview(mistakesQueue);
    }
  };

  const renderCorrectionModal = () => {
      const currentQ = reviewQueue[questionIdx];
      return (
          <div className="fixed inset-0 bg-black/80 dark:bg-black/90 z-50 flex items-center justify-center p-4 animate-fadeIn">
              <div className="bg-white dark:bg-zinc-900 p-8 max-w-md w-full rounded-lg text-center border border-zinc-200 dark:border-zinc-800">
                  <span className="text-red-600 font-bold uppercase tracking-widest text-xs mb-2 block">Incorrect</span>
                  <h2 className="text-3xl font-serif font-bold mb-4 text-black dark:text-white">{currentQ.word.term}</h2>
                  <p className="text-lg text-zinc-600 dark:text-zinc-300 mb-6">{currentQ.word.meaning}</p>
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
              <div className="w-12 h-12 border-4 border-zinc-200 dark:border-zinc-800 border-t-black dark:border-t-white rounded-full animate-spin mb-6"></div>
              <h2 className="text-xl font-serif font-bold dark:text-white">
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
                  <button onClick={onExit} className="text-sm underline hover:text-black dark:hover:text-white dark:text-zinc-400">Exit</button>
              </div>

              <div className="text-center mb-12 space-y-6">
                  <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full">New Word</span>
                  <div className="flex items-center justify-center gap-4">
                    <h1 className="text-6xl font-serif font-black tracking-tight text-black dark:text-white">{lesson.targetWord.term}</h1>
                    <button 
                        onClick={(e) => { e.stopPropagation(); speakText(lesson.targetWord.term); }}
                        className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
                    >
                        <SpeakerIcon large />
                    </button>
                  </div>
                  <p className="text-2xl text-zinc-600 dark:text-zinc-300 font-light max-w-md mx-auto">{lesson.intro.definition}</p>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 mb-12 relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-black dark:bg-white"></div>
                  <div className="flex justify-between items-start gap-4">
                      <p 
                        className="text-xl italic text-zinc-800 dark:text-zinc-200 font-serif leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: `"${lesson.intro.exampleSentence}"` }}
                      />
                      <button 
                         onClick={(e) => { e.stopPropagation(); speakText(lesson.intro.exampleSentence); }}
                         className="text-zinc-300 dark:text-zinc-600 hover:text-black dark:hover:text-white transition-colors"
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

  const queue = mode === 'LEARNING' ? lesson?.queue : reviewQueue;
  const currentQ = queue ? queue[questionIdx] : null;

  if (!currentQ) return null;

  return (
      <div className="max-w-xl mx-auto py-8 animate-fadeIn relative">
          {showCorrectionModal && renderCorrectionModal()}

          <div className="flex justify-between items-center mb-6">
               <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                   {mode === 'LEARNING' ? 'Practice' : mode === 'BATCH_REVIEW' ? 'Batch Revision' : 'Correction Round'}
               </span>
               <div className="text-xs font-bold bg-black text-white dark:bg-white dark:text-black px-2 py-1">
                   {questionIdx + 1} / {queue?.length}
               </div>
          </div>

          <div className="mb-10 min-h-[160px]">
               <h2 className="text-xl font-medium mb-6 dark:text-white">{currentQ.questionText}</h2>
               
               <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-lg flex justify-between items-start gap-4">
                   <p 
                        className="text-2xl font-serif leading-relaxed text-zinc-900 dark:text-zinc-100"
                        dangerouslySetInnerHTML={{ __html: currentQ.sentence }}
                   />
                   <button 
                        onClick={(e) => { e.stopPropagation(); speakText(currentQ.sentence); }}
                        className="text-zinc-300 dark:text-zinc-600 hover:text-black dark:hover:text-white transition-colors p-1"
                   >
                       <SpeakerIcon />
                   </button>
               </div>
          </div>

          <div className="space-y-3 mb-8">
              {currentQ.options.map((opt) => {
                  let statusClass = "border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 bg-white dark:bg-zinc-950 text-black dark:text-white";
                  
                  if (isChecked) {
                      if (opt.isCorrect) {
                          statusClass = "border-green-600 bg-green-50 dark:bg-green-900/20 text-green-900 dark:text-green-300";
                      } else if (opt.id === selectedOption) {
                          statusClass = "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-300";
                      } else {
                          statusClass = "border-zinc-100 dark:border-zinc-900 opacity-50";
                      }
                  } else if (selectedOption === opt.id) {
                      statusClass = "border-black dark:border-white bg-zinc-50 dark:bg-zinc-900 ring-1 ring-black dark:ring-white";
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
                              <span className="text-green-600 dark:text-green-400 font-bold">✓</span>
                          )}
                          {isChecked && !opt.isCorrect && opt.id === selectedOption && (
                              <span className="text-red-500 dark:text-red-400 font-bold">✗</span>
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
                    className={`h-14 text-lg ${isCorrect ? 'bg-green-600 hover:bg-green-700 border-green-600 text-white' : 'bg-zinc-800 dark:bg-zinc-700 text-white'}`}
                  >
                      {mode !== 'LEARNING' && !isCorrect ? 'Review Meaning' : 'Continue'}
                  </Button>
              )}
          </div>
      </div>
  );
};

export default GuidedLearning;
