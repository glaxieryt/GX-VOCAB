
import React, { useState, useEffect } from 'react';
import { allWords } from '../data';
import { Word, SRSState, RichVocabularyCard, Exercise } from '../types';
import { generateRichVocabularyData, generateWordImage, speakText } from '../services/geminiService';
import { saveSRSState, getSRSState, getCurrentSession } from '../services/authService';
import { playSuccessSound, playErrorSound } from '../services/audioService';
import Button from './Button';

// --- Phases ---
type Phase = 'DASHBOARD' | 'LOADING' | 'PHASE1_ENCODING' | 'PHASE2_EXERCISES' | 'PHASE3_CONFIDENCE' | 'SESSION_COMPLETE';

const BetaSRS: React.FC<{ onExit: () => void }> = ({ onExit }) => {
    // Session State
    const [phase, setPhase] = useState<Phase>('DASHBOARD');
    const [queue, setQueue] = useState<Word[]>([]);
    const [queueIndex, setQueueIndex] = useState(0);
    const [currentCard, setCurrentCard] = useState<RichVocabularyCard | null>(null);
    const [srsState, setSrsState] = useState<Record<string, SRSState>>({});
    const [user, setUser] = useState<string | null>(null);
    
    // Visual State
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [loadingImage, setLoadingImage] = useState(false);

    // Exercise State
    const [currentExerciseIdx, setCurrentExerciseIdx] = useState(0);
    const [feedback, setFeedback] = useState<'IDLE' | 'CORRECT' | 'WRONG'>('IDLE');
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [inputVal, setInputVal] = useState('');
    const [hintsUsed, setHintsUsed] = useState(0);
    const [timeLeft, setTimeLeft] = useState(45); // Encoding timer

    // Stats
    const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 });

    // Load Data on Mount
    useEffect(() => {
        const init = async () => {
            const u = await getCurrentSession();
            setUser(u?.username || null);
            
            let loadedSRS = {};
            if (u) loadedSRS = await getSRSState(u.username);
            else {
                const local = localStorage.getItem('gx_beta_srs');
                if (local) loadedSRS = JSON.parse(local);
            }
            setSrsState(loadedSRS);
        };
        init();
    }, []);

    const startSession = () => {
        // Build Queue: Due Reviews + 5 New Words
        const now = Date.now();
        const due = allWords.filter(w => {
            const s = (srsState as any)[w.id];
            return s && s.nextReview <= now;
        });
        const newWords = allWords.filter(w => !(srsState as any)[w.id]).slice(0, 5); // Start small
        
        const newQueue = [...due, ...newWords];
        if (newQueue.length === 0) {
            alert("No words due for review and no new words available!");
            return;
        }
        
        setQueue(newQueue);
        setQueueIndex(0);
        loadWordData(newQueue[0]);
    };

    const loadWordData = async (word: Word) => {
        setPhase('LOADING');
        setImageUrl(null);
        setLoadingImage(false);
        try {
            // Check cache or generate text content
            const data = await generateRichVocabularyData(word);
            setCurrentCard(data);
            setPhase('PHASE1_ENCODING');
            setTimeLeft(45); // Reset timer
            speakText(data.word);
            
            // Trigger Image Gen
            if (data.memoryHooks.visual) {
                setLoadingImage(true);
                generateWordImage(data.memoryHooks.visual).then(url => {
                    if (url) setImageUrl(url);
                    setLoadingImage(false);
                });
            }
        } catch (e) {
            alert("Failed to generate content. Please try again.");
            setPhase('DASHBOARD');
        }
    };

    // --- PHASE 1: ENCODING ---
    useEffect(() => {
        if (phase === 'PHASE1_ENCODING' && timeLeft > 0) {
            const t = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
            return () => clearTimeout(t);
        }
    }, [phase, timeLeft]);

    const startExercises = () => {
        setCurrentExerciseIdx(0);
        setPhase('PHASE2_EXERCISES');
        resetExerciseState();
    };

    // --- PHASE 2: EXERCISES ---
    const resetExerciseState = () => {
        setFeedback('IDLE');
        setSelectedOption(null);
        setInputVal('');
        setHintsUsed(0);
    };

    const handleCheck = () => {
        if (!currentCard) return;
        const exercise = currentCard.exercises[currentExerciseIdx];
        let correct = false;

        if (exercise.options) {
             // Multiple Choice
             if (selectedOption !== null && exercise.options[selectedOption].correct) correct = true;
        } else if (exercise.type === 'reverse_definition') {
             if (inputVal.toLowerCase().trim() === currentCard.word.toLowerCase()) correct = true;
        } else if (exercise.type === 'sentence_creation') {
             if (inputVal.length > 5 && inputVal.toLowerCase().includes(currentCard.word.toLowerCase())) correct = true;
        }

        if (correct) {
            setFeedback('CORRECT');
            playSuccessSound();
            setSessionStats(prev => ({ ...prev, correct: prev.correct + 1, total: prev.total + 1 }));
        } else {
            setFeedback('WRONG');
            playErrorSound();
            setSessionStats(prev => ({ ...prev, total: prev.total + 1 }));
        }
    };

    const nextExercise = () => {
        if (!currentCard) return;
        if (currentExerciseIdx < currentCard.exercises.length - 1) {
            setCurrentExerciseIdx(prev => prev + 1);
            resetExerciseState();
        } else {
            setPhase('PHASE3_CONFIDENCE');
        }
    };

    // --- PHASE 3: SM-2 ALGORITHM ---
    const handleConfidence = (rating: number) => {
        const wordId = queue[queueIndex].id;
        const currentSRS = (srsState as any)[wordId] || { interval: 0, nextReview: 0, easeFactor: 2.5, streak: 0 };
        
        let newInterval = 0;
        let newEase = currentSRS.easeFactor;
        let newStreak = currentSRS.streak;

        if (rating >= 3) {
            // Success
            if (newStreak === 0) newInterval = 1;
            else if (newStreak === 1) newInterval = 3;
            else newInterval = Math.ceil(currentSRS.interval * newEase);
            
            newStreak++;
            newEase = newEase + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02));
            if (newEase < 1.3) newEase = 1.3;
        } else {
            // Fail
            newStreak = 0;
            newInterval = 1; // Reset to 1 day
        }

        const nextReviewDate = Date.now() + (newInterval * 24 * 60 * 60 * 1000);
        const newState = { ...srsState, [wordId]: { interval: newInterval, nextReview: nextReviewDate, easeFactor: newEase, streak: newStreak } };
        
        setSrsState(newState);
        if (user) saveSRSState(user, newState);
        else localStorage.setItem('gx_beta_srs', JSON.stringify(newState));

        // Next Word
        if (queueIndex < queue.length - 1) {
            setQueueIndex(prev => prev + 1);
            loadWordData(queue[queueIndex + 1]);
        } else {
            setPhase('SESSION_COMPLETE');
        }
    };

    // --- RENDERERS ---

    if (phase === 'DASHBOARD') {
        const mastered = Object.values(srsState).filter((s: any) => s.interval > 21).length;
        const due = allWords.filter(w => {
            const s = (srsState as any)[w.id];
            return s && s.nextReview <= Date.now();
        }).length;

        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6 flex flex-col items-center">
                <div className="w-full max-w-4xl">
                    <div className="flex justify-between items-center mb-12">
                         <h1 className="text-3xl font-black font-serif dark:text-white">Advanced Learning System</h1>
                         <button onClick={onExit} className="text-sm underline text-zinc-500">Exit Beta</button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 text-center">
                            <span className="text-4xl block mb-2">🧠</span>
                            <span className="text-2xl font-bold block dark:text-white">{mastered}</span>
                            <span className="text-xs uppercase tracking-widest text-zinc-500">Mastered</span>
                        </div>
                        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 text-center">
                            <span className="text-4xl block mb-2">🔄</span>
                            <span className="text-2xl font-bold block dark:text-white">{due}</span>
                            <span className="text-xs uppercase tracking-widest text-zinc-500">Reviews Due</span>
                        </div>
                        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 text-center">
                            <span className="text-4xl block mb-2">📚</span>
                            <span className="text-2xl font-bold block dark:text-white">{1500 - Object.keys(srsState).length}</span>
                            <span className="text-xs uppercase tracking-widest text-zinc-500">To Learn</span>
                        </div>
                    </div>

                    <div className="text-center">
                        <button 
                            onClick={startSession}
                            className="bg-black dark:bg-white text-white dark:text-black text-xl font-bold py-4 px-12 rounded-full hover:scale-105 transition-transform shadow-xl"
                        >
                            Start Session
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (phase === 'LOADING') {
        return (
            <div className="min-h-screen flex items-center justify-center flex-col bg-zinc-50 dark:bg-zinc-950">
                <div className="w-16 h-16 border-4 border-t-blue-500 border-zinc-200 rounded-full animate-spin mb-6"></div>
                <h2 className="text-xl font-serif font-bold text-zinc-800 dark:text-zinc-200">Generating Rich Content...</h2>
                <p className="text-sm text-zinc-500 mt-2">Consulting cognitive science engine</p>
            </div>
        );
    }

    if (phase === 'SESSION_COMPLETE') {
         return (
             <div className="min-h-screen flex items-center justify-center flex-col bg-zinc-50 dark:bg-zinc-950 p-4 text-center">
                 <h1 className="text-6xl mb-6">🎉</h1>
                 <h2 className="text-4xl font-serif font-bold text-black dark:text-white mb-4">Session Complete</h2>
                 <p className="text-zinc-600 dark:text-zinc-400 mb-8">Accuracy: {Math.round((sessionStats.correct/sessionStats.total)*100)}%</p>
                 <button onClick={onExit} className="bg-black dark:bg-white text-white dark:text-black py-3 px-8 rounded-full font-bold">Return Home</button>
             </div>
         );
    }

    if (!currentCard) return null;

    // --- PHASE 1 RENDER ---
    if (phase === 'PHASE1_ENCODING') {
        return (
            <div className="min-h-screen bg-[#F7F9FC] dark:bg-zinc-950 p-6 flex flex-col">
                <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                         <span className="text-xs font-bold bg-blue-100 text-blue-800 px-3 py-1 rounded-full">INITIAL ENCODING</span>
                         <span className="text-sm font-mono text-zinc-400">Timer: {timeLeft}s</span>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-xl border border-zinc-200 dark:border-zinc-800 flex-1 overflow-y-auto">
                        {/* Word Header */}
                        <div className="text-center mb-10 pb-8 border-b border-zinc-100 dark:border-zinc-800">
                            <h1 className="text-6xl font-black text-black dark:text-white mb-4 tracking-tight">{currentCard.word}</h1>
                            <div className="flex items-center justify-center gap-4 text-zinc-500">
                                <span className="font-mono text-lg">{currentCard.pronunciation.ipa}</span>
                                <button onClick={() => speakText(currentCard.word)} className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded-full hover:bg-zinc-200">🔊</button>
                            </div>
                            <div className="mt-4 flex gap-2 justify-center">
                                <span className="text-xs uppercase font-bold tracking-widest text-zinc-400">{currentCard.metadata.partOfSpeech}</span>
                                <span className="text-xs uppercase font-bold tracking-widest text-zinc-400">• Level {currentCard.metadata.difficulty}/10</span>
                            </div>
                        </div>

                        {/* Definition */}
                        <div className="mb-10 text-center">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">Definition</h3>
                            <p className="text-2xl font-serif text-zinc-800 dark:text-zinc-200 leading-relaxed max-w-lg mx-auto">
                                {currentCard.definition.primary}
                            </p>
                        </div>

                        {/* Etymology & Visual */}
                        <div className="grid md:grid-cols-2 gap-6 mb-10">
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-blue-500 mb-2">Memory Hook</h3>
                                <p className="text-zinc-700 dark:text-blue-100 italic">"{currentCard.memoryHooks.mnemonic}"</p>
                            </div>
                            <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-2xl border border-amber-100 dark:border-amber-900/30 flex flex-col">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-2">Visual</h3>
                                {imageUrl ? (
                                    <div className="relative w-full h-48 rounded-lg overflow-hidden mt-2">
                                        <img src={imageUrl} alt="AI Visualization" className="w-full h-full object-cover animate-fadeIn" />
                                    </div>
                                ) : loadingImage ? (
                                    <div className="w-full h-48 rounded-lg bg-amber-100 dark:bg-amber-800/30 animate-pulse mt-2 flex items-center justify-center">
                                        <span className="text-amber-500 text-xs font-bold">Creating Image...</span>
                                    </div>
                                ) : (
                                    <p className="text-zinc-700 dark:text-amber-100">{currentCard.memoryHooks.visual}</p>
                                )}
                            </div>
                        </div>

                        {/* Examples */}
                        <div>
                             <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4 text-center">Context</h3>
                             <div className="space-y-4">
                                 {currentCard.examples.slice(0, 2).map((ex, i) => (
                                     <div key={i} className="pl-4 border-l-4 border-zinc-200 dark:border-zinc-700">
                                         <p className="text-lg italic text-zinc-600 dark:text-zinc-400">"{ex.sentence}"</p>
                                     </div>
                                 ))}
                             </div>
                        </div>
                    </div>

                    <div className="mt-6">
                        <Button fullWidth onClick={startExercises} disabled={timeLeft > 0 && false} className={timeLeft > 0 ? "opacity-50" : ""}>
                            {timeLeft > 0 ? `Wait ${timeLeft}s to Digest` : "Start Exercises →"}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // --- PHASE 2 RENDER ---
    const currentEx = currentCard.exercises[currentExerciseIdx];
    
    if (phase === 'PHASE2_EXERCISES' && currentEx) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6 flex flex-col items-center">
                 <div className="max-w-2xl w-full flex-1 flex flex-col">
                      {/* Progress Header */}
                      <div className="mb-8">
                          <div className="flex justify-between text-xs font-bold uppercase text-zinc-400 mb-2">
                              <span>Exercise {currentExerciseIdx + 1} / {currentCard.exercises.length}</span>
                              <span>{currentEx.type.replace('_', ' ')}</span>
                          </div>
                          <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
                              <div className="h-full bg-black dark:bg-white transition-all duration-500" style={{ width: `${((currentExerciseIdx)/currentCard.exercises.length)*100}%` }}></div>
                          </div>
                      </div>

                      {/* Question Card */}
                      <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-lg border border-zinc-200 dark:border-zinc-800 flex-1 flex flex-col justify-center">
                           <h2 className="text-2xl font-serif font-bold text-center mb-8 dark:text-white">
                               {currentEx.question || currentEx.definition || currentEx.instruction}
                           </h2>

                           {currentEx.options ? (
                               <div className="space-y-3">
                                   {currentEx.options.map((opt, i) => {
                                       let style = "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-black dark:hover:border-white";
                                       if (feedback !== 'IDLE') {
                                           if (opt.correct) style = "bg-green-100 border-green-500 text-green-800";
                                           else if (i === selectedOption) style = "bg-red-100 border-red-500 text-red-800";
                                           else style = "opacity-50";
                                       } else if (selectedOption === i) {
                                           style = "border-black dark:border-white ring-1 ring-black";
                                       }

                                       return (
                                           <button 
                                              key={i}
                                              onClick={() => setSelectedOption(i)}
                                              disabled={feedback !== 'IDLE'}
                                              className={`w-full p-5 text-lg font-medium border-2 rounded-xl transition-all ${style} text-left`}
                                           >
                                               {opt.text}
                                           </button>
                                       )
                                   })}
                               </div>
                           ) : (
                               <div className="space-y-4">
                                   {currentEx.hints && (
                                       <div className="text-sm text-zinc-500 text-center mb-4 italic">
                                           Hint: {currentEx.hints[0].hint}
                                       </div>
                                   )}
                                   <input 
                                      value={inputVal}
                                      onChange={(e) => setInputVal(e.target.value)}
                                      disabled={feedback !== 'IDLE'}
                                      className="w-full text-2xl p-4 border-b-2 border-zinc-300 dark:border-zinc-700 bg-transparent text-center outline-none focus:border-black dark:focus:border-white dark:text-white font-serif"
                                      placeholder="Type your answer..."
                                   />
                               </div>
                           )}

                           {/* Feedback Area */}
                           {feedback !== 'IDLE' && (
                               <div className={`mt-8 p-4 rounded-xl text-center ${feedback === 'CORRECT' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                    <p className="font-bold mb-1">{feedback === 'CORRECT' ? currentEx.feedback?.correct || "Correct!" : currentEx.feedback?.incorrect || "Incorrect."}</p>
                               </div>
                           )}
                      </div>

                      <div className="mt-8">
                          {feedback === 'IDLE' ? (
                              <Button fullWidth onClick={handleCheck} disabled={(!selectedOption && selectedOption !== 0) && !inputVal}>
                                  Check Answer
                              </Button>
                          ) : (
                              <Button fullWidth onClick={nextExercise}>
                                  Continue
                              </Button>
                          )}
                      </div>
                 </div>
            </div>
        );
    }

    // --- PHASE 3: CONFIDENCE ---
    if (phase === 'PHASE3_CONFIDENCE') {
        return (
            <div className="min-h-screen bg-white dark:bg-zinc-950 p-6 flex flex-col items-center justify-center">
                 <div className="max-w-xl w-full text-center">
                      <h2 className="text-3xl font-serif font-bold mb-2 dark:text-white">Self Assessment</h2>
                      <p className="text-zinc-500 mb-10">How confident are you with "{queue[queueIndex].term}"?</p>

                      <div className="space-y-3">
                          {[
                              { lvl: 5, label: "Mastery", sub: "I could teach this", days: 30 },
                              { lvl: 4, label: "Confident", sub: "Can use in writing", days: 14 },
                              { lvl: 3, label: "Moderate", sub: "Understand when seen", days: 7 },
                              { lvl: 2, label: "Weak", sub: "Vaguely familiar", days: 3 },
                              { lvl: 1, label: "Unfamiliar", sub: "Don't know it", days: 1 },
                          ].map((opt) => (
                              <button
                                 key={opt.lvl}
                                 onClick={() => handleConfidence(opt.lvl)}
                                 className="w-full p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:border-black dark:hover:border-white hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all flex justify-between items-center group"
                              >
                                  <div className="text-left">
                                      <span className="font-bold block text-black dark:text-white group-hover:translate-x-1 transition-transform">{opt.label}</span>
                                      <span className="text-xs text-zinc-400">{opt.sub}</span>
                                  </div>
                                  <span className="text-xs font-bold bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-zinc-500">Next: {opt.days}d</span>
                              </button>
                          ))}
                      </div>
                 </div>
            </div>
        );
    }

    return null;
};

export default BetaSRS;
