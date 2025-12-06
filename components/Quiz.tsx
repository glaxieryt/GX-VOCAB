
import React, { useState, useEffect } from 'react';
import { WordGroup, QuizQuestion, QuizQuestionType } from '../types';
import { generateQuiz } from '../services/quizService';
import { generateContextQuizQuestion } from '../services/geminiService';
import Button from './Button';

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

  if (questions.length === 0) {
    return <div className="p-8 text-center text-zinc-500 animate-pulse">Generating Quiz...</div>;
  }

  const currentQ = questions[currentIndex];

  const handleOptionClick = (index: number) => {
    if (isAnswered || loadingQuestion) return;
    setSelectedOption(index);
    setIsAnswered(true);
    if (index === currentQ.correctOptionIndex) {
      setScore(s => s + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      onFinish(score, questions.length);
    }
  };

  return (
    <div className="max-w-xl mx-auto pt-8">
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
                    <div className="space-y-4 animate-fadeIn">
                        <span className="bg-black text-white dark:bg-white dark:text-black text-[10px] font-bold px-2 py-1 uppercase tracking-widest">Context</span>
                        <p 
                            className="text-2xl font-serif leading-relaxed text-black dark:text-white"
                            dangerouslySetInnerHTML={{ __html: currentQ.questionText }} 
                        />
                        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-2 border-t border-zinc-100 dark:border-zinc-800 pt-2">What does the underlined word mean?</p>
                    </div>
                ) : (
                    <div className="space-y-4 animate-fadeIn">
                        <span className="border border-black text-black dark:border-white dark:text-white text-[10px] font-bold px-2 py-1 uppercase tracking-widest">Definition</span>
                        <h2 className="text-4xl font-serif font-bold text-black dark:text-white">"{currentQ.word.term}"</h2>
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
               btnStyle = "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"; // Correct
             } else if (idx === selectedOption) {
               btnStyle = "bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 line-through"; // Wrong
             } else {
               btnStyle = "bg-white dark:bg-zinc-950 text-zinc-300 dark:text-zinc-600 border-zinc-100 dark:border-zinc-900"; // Fade
             }
          }

          return (
            <button
              key={idx}
              onClick={() => handleOptionClick(idx)}
              disabled={isAnswered || loadingQuestion}
              className={`w-full text-left p-4 border transition-all duration-200 rounded-lg ${btnStyle} ${loadingQuestion ? 'opacity-50' : ''}`}
            >
              <div className="flex items-start">
                <span className="mr-4 font-mono text-xs mt-1 text-zinc-400 dark:text-zinc-500">{String.fromCharCode(65 + idx)}.</span>
                <span className="text-sm md:text-base">{option}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-8 h-12">
        {isAnswered && (
          <Button fullWidth onClick={handleNext}>
            {currentIndex === questions.length - 1 ? "Finish Quiz" : "Next Question"}
          </Button>
        )}
      </div>
    </div>
  );
};

export default Quiz;
