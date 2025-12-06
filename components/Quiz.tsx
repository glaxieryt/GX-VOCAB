import React, { useState, useEffect } from 'react';
import { WordGroup, QuizQuestion, QuizQuestionType } from '../types';
import { generateQuiz } from '../services/quizService';
import { generateContextQuizQuestion, speakText } from '../services/geminiService';
import Button from './Button';
import { playSuccessSound, playErrorSound } from '../services/audioService';

interface QuizProps {
  group: WordGroup;
  onFinish: (score: number, total: number) => void;
  onExit: () => void;
}

const Quiz: React.FC<QuizProps> = ({ group, onFinish, onExit }) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [isAnswered, setIsAnswered] = useState(false);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  useEffect(() => {
    const q = generateQuiz(group.words);
    setQuestions(q);
  }, [group]);

  useEffect(() => {
      const loadDynamicQuestion = async () => {
          const currentQ = questions[currentIndex];
          if (!currentQ) return;
          if (currentQ.type === QuizQuestionType.CONTEXT && !currentQ.questionText) {
              setLoadingQuestion(true);
              try {
                  const distractors = currentQ.options.filter(o => o !== currentQ.word.meaning);
                  const newQ = await generateContextQuizQuestion(currentQ.word, distractors);
                  setQuestions(prev => {
                      const newQs = [...prev];
                      newQs[currentIndex] = { ...newQ, id: currentQ.id };
                      return newQs;
                  });
              } catch (error) {
                   setQuestions(prev => {
                      const newQs = [...prev];
                      newQs[currentIndex] = { 
                          ...currentQ, 
                          type: QuizQuestionType.DEFINITION, 
                          questionText: `The word "${currentQ.word.term}" means:` 
                      };
                      return newQs;
                  });
              } finally {
                  setLoadingQuestion(false);
              }
          }
      };

      loadDynamicQuestion();
  }, [currentIndex, questions]);

  useEffect(() => {
    // Read question aloud when it loads
    const currentQ = questions[currentIndex];
    if (currentQ && !loadingQuestion && !isAnswered) {
        // Optional: Auto-read question if desired, or just wait for user interaction
    }
  }, [currentIndex, loadingQuestion]);

  if (questions.length === 0) {
    return <div className="p-8 text-center text-zinc-500 animate-pulse">Generating Quiz...</div>;
  }

  const currentQ = questions[currentIndex];

  const handleOptionClick = (index: number) => {
    if (isAnswered || loadingQuestion) return;
    setSelectedOption(index);
  };
  
  const handleCheck = () => {
      if (selectedOption === null || isAnswered) return;
      
      const correct = selectedOption === currentQ.correctOptionIndex;
      setIsCorrect(correct);
      
      if (correct) {
          setScore(s => s + 1);
          playSuccessSound();
      } else {
          playErrorSound();
      }
      setIsAnswered(true);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
      setIsCorrect(false);
    } else {
      onFinish(score, questions.length);
    }
  };

  return (
    <div className="max-w-xl mx-auto pt-8 animate-fadeIn">
      <div className="flex justify-between items-center mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
          Question {currentIndex + 1} / {questions.length}
        </span>
        <button onClick={onExit} className="text-sm underline hover:text-zinc-600 dark:hover:text-zinc-300">Exit</button>
      </div>

      <div className="mb-10 min-h-[200px] flex flex-col justify-center relative">
        {loadingQuestion ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white dark:bg-zinc-950 z-10">
                <div className="w-8 h-8 border-4 border-zinc-200 dark:border-zinc-800 border-t-black dark:border-t-white rounded-full animate-spin mb-4"></div>
                <p className="text-zinc-500 text-sm">Generating context sentence...</p>
            </div>
        ) : (
            <>
                {currentQ.type === QuizQuestionType.CONTEXT ? (
                    <div className="space-y-4 animate-slideUp">
                        <span className="bg-black text-white dark:bg-white dark:text-black text-[10px] font-bold px-2 py-1 uppercase tracking-widest">Context</span>
                        <div className="flex items-start gap-4">
                            <p 
                                className="text-2xl font-serif leading-relaxed text-black dark:text-white"
                                dangerouslySetInnerHTML={{ __html: currentQ.questionText }} 
                            />
                             <button 
                                onClick={() => speakText(currentQ.questionText)}
                                className="mt-1 p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
                             >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                    <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318 0-2.402.084C2.022 7.667 2 7.787 2 7.917v8.166c0 .13.022.25.106.333.084.084 1.261.084 2.402.084h1.932l4.5 4.5c.945.945 2.56.276 2.56-1.06V4.06zM18.53 12a4.48 4.48 0 00-1.782-3.582c-.39-.292-.936-.217-1.228.172-.292.39-.217.936.172 1.228a2.482 2.482 0 01.988 1.982c0 .822-.39 1.562-.988 2.182-.389.292-.464.838-.172 1.228.292.39.838.464 1.228.172A4.48 4.48 0 0018.53 12z" />
                                </svg>
                             </button>
                        </div>
                        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-2 border-t border-zinc-100 dark:border-zinc-800 pt-2">What does the underlined word mean?</p>
                    </div>
                ) : (
                    <div className="space-y-4 animate-slideUp">
                        <span className="border border-black text-black dark:border-white dark:text-white text-[10px] font-bold px-2 py-1 uppercase tracking-widest">Definition</span>
                        <div className="flex items-center gap-4">
                            <h2 className="text-4xl font-serif font-bold text-black dark:text-white">"{currentQ.word.term}"</h2>
                            <button 
                                onClick={() => speakText(currentQ.word.term)}
                                className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                    <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318 0-2.402.084C2.022 7.667 2 7.787 2 7.917v8.166c0 .13.022.25.106.333.084.084 1.261.084 2.402.084h1.932l4.5 4.5c.945.945 2.56.276 2.56-1.06V4.06zM18.53 12a4.48 4.48 0 00-1.782-3.582c-.39-.292-.936-.217-1.228.172-.292.39-.217.936.172 1.228a2.482 2.482 0 01.988 1.982c0 .822-.39 1.562-.988 2.182-.389.292-.464.838-.172 1.228.292.39.838.464 1.228.172A4.48 4.48 0 0018.53 12z" />
                                </svg>
                            </button>
                        </div>
                        <p className="text-zinc-500 dark:text-zinc-400">Select the correct meaning.</p>
                    </div>
                )}
            </>
        )}
      </div>

      <div className="space-y-3">
        {currentQ.options.map((option, idx) => {
          let btnStyle = "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-black dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800"; // Default
          
          if (isAnswered) {
             if (idx === currentQ.correctOptionIndex) {
               btnStyle = "bg-green-600 border-green-600 text-white shadow-lg scale-[1.02]"; // Correct
             } else if (idx === selectedOption) {
               btnStyle = "bg-red-500 border-red-500 text-white opacity-90"; // Wrong
             } else {
               btnStyle = "opacity-40 border-zinc-100 dark:border-zinc-900 grayscale"; // Fade others
             }
          } else if (selectedOption === idx) {
               btnStyle = "border-black dark:border-white bg-zinc-50 dark:bg-zinc-800 ring-1 ring-black dark:ring-white scale-[1.01] shadow-md";
          }

          return (
            <button
              key={idx}
              onClick={() => handleOptionClick(idx)}
              disabled={isAnswered || loadingQuestion}
              className={`w-full text-left p-4 border transition-all duration-300 rounded-lg ${btnStyle} ${loadingQuestion ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-4">
                  <span className="font-mono text-xs mt-1 text-zinc-400 dark:text-zinc-500 opacity-60">{String.fromCharCode(65 + idx)}.</span>
                  <span className="text-sm md:text-base font-medium">{option}</span>
                </div>
                {isAnswered && idx === currentQ.correctOptionIndex && (
                     <span className="text-white font-bold">✓</span>
                )}
                {isAnswered && idx === selectedOption && idx !== currentQ.correctOptionIndex && (
                     <span className="text-white font-bold">✗</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-8 h-14">
        {!isAnswered ? (
             <Button fullWidth onClick={handleCheck} disabled={selectedOption === null} className="h-14 text-lg">
                 Check Answer
             </Button>
        ) : (
             <Button 
                fullWidth 
                onClick={handleNext}
                className={`h-14 text-lg transition-colors duration-300 ${isCorrect ? 'bg-black dark:bg-white text-white dark:text-black' : 'bg-zinc-800 text-white'}`}
             >
                {currentIndex === questions.length - 1 ? "Finish Quiz" : "Next Question →"}
             </Button>
        )}
      </div>
    </div>
  );
};

export default Quiz;