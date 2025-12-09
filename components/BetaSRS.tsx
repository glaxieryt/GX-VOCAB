import React, { useState, useEffect } from 'react';
import { allWords } from '../data';
import { Word, SRSState, RichVocabularyCard } from '../types';
import { generateRichVocabularyData, generateWordImage, speakText } from '../services/geminiService';
import { saveSRSState, getSRSState, getCurrentSession, saveWordProgress } from '../services/authService';
import { playSuccessSound, playErrorSound } from '../services/audioService';
import Button from './Button';

// --- Phases ---
type Phase = 'DASHBOARD' | 'LOADING' | 'PHASE1_ENCODING' | 'PHASE2_EXERCISES' | 'PHASE3_CONFIDENCE' | 'PHASE4_SUMMARY' | 'SESSION_COMPLETE';

interface BetaSRSProps {
    onExit: () => void;
    onEarnXP: (amount: number) => void;
}

const BetaSRS: React.FC<BetaSRSProps> = ({ onExit, onEarnXP }) => {
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
    const [timeLeft, setTimeLeft] = useState(45); // Encoding timer

    // Stats
    const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 });

    const loadInitialState = async () => {
        const session = await getCurrentSession();
        if (session) {
            setUser(session.username);
            // This is the most important part: load the saved state.
            setSrsState(session.srs_state || {});
        } else {
            const localData = localStorage.getItem('gx_beta_srs');
            setSrsState(localData ? JSON.parse(localData) : {});
        }
    };

    useEffect(() => {
        loadInitialState();
    }, []);

    const startSession = () => {
        const now = Date.now();
        const dueReviews = allWords.filter(w => {
            const state = srsState[w.id];
            return state && state.nextReview <= now;
        }).sort((a,b) => (srsState[a.id].interval || 0) - (srsState[b.id].interval || 0)); // Prioritize older reviews

        const newWords = allWords.filter(w => !srsState[w.id]).slice(0, 5);
        
        const sessionQueue = [...dueReviews, ...newWords];
        if (sessionQueue.length === 0) {
            alert("Congratulations! No new words or reviews for today.");
            return;
        }
        
        setQueue(sessionQueue);
        setQueueIndex(0);
        loadWordData(sessionQueue[0]);
    };

    const loadWordData = async (word: Word) => {
        setPhase('LOADING');
        setImageUrl(null);
        setLoadingImage(false);
        try {
            const data = await generateRichVocabularyData(word);
            setCurrentCard(data);
            setPhase('PHASE1_ENCODING');
            setTimeLeft(45);
            speakText(data.word);
            if (data.memoryHooks.visual) {
                setLoadingImage(true);
                generateWordImage(data.memoryHooks.visual).then(url => {
                    if (url) setImageUrl(url);
                    setLoadingImage(false);
                });
            }
        } catch (e) {
            alert("AI content generation failed. Please check your connection or API key and try again.");
            setPhase('DASHBOARD');
        }
    };

    useEffect(() => {
        if (phase === 'PHASE1_ENCODING' && timeLeft > 0) {
            const timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [phase, timeLeft]);

    const startExercises = () => {
        setCurrentExerciseIdx(0);
        setPhase('PHASE2_EXERCISES');
        resetExerciseState();
    };

    const resetExerciseState = () => {
        setFeedback('IDLE');
        setSelectedOption(null);
        setInputVal('');
    };

    const handleCheck = () => {
        if (!currentCard) return;
        const exercise = currentCard.exercises[currentExerciseIdx];
        let isCorrect = false;
        if (exercise.options) {
             isCorrect = selectedOption !== null && exercise.options[selectedOption].correct;
        } else {
             isCorrect = inputVal.toLowerCase().trim() === currentCard.word.toLowerCase();
        }

        setFeedback(isCorrect ? 'CORRECT' : 'WRONG');
        isCorrect ? playSuccessSound() : playErrorSound();
        setSessionStats(prev => ({ correct: prev.correct + (isCorrect ? 1 : 0), total: prev.total + 1 }));
        if (isCorrect) onEarnXP(10);
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

    const handleConfidence = async (rating: number) => {
        const wordId = queue[queueIndex].id;
        const currentSRS = srsState[wordId] || { interval: 0, nextReview: 0, easeFactor: 2.5, streak: 0 };
        
        let { interval, easeFactor, streak } = currentSRS;
        if (rating >= 3) {
            if (streak === 0) interval = 1;
            else if (streak === 1) interval = 3;
            else interval = Math.ceil(interval * easeFactor);
            streak++;
            easeFactor += (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02));
            if (easeFactor < 1.3) easeFactor = 1.3;
        } else {
            streak = 0;
            interval = 1;
        }
        
        const nextReviewDate = Date.now() + (interval * 24 * 60 * 60 * 1000);
        const newSrsData: SRSState = { interval, nextReview: nextReviewDate, easeFactor, streak };
        const newSrsState = { ...srsState, [wordId]: newSrsData };
        
        setSrsState(newSrsState); // Optimistic UI update

        const statusMap: Record<number, string> = { 5: 'mastery', 4: 'confident', 3: 'moderate', 2: 'weak', 1: 'unfamiliar' };
        
        if (user) {
            try {
                // Fire and forget, UI has already updated.
                await Promise.all([
                    saveSRSState(user, newSrsState, 50),
                    saveWordProgress(user, wordId, statusMap[rating], rating, nextReviewDate, streak)
                ]);
                onEarnXP(50);
            } catch (e) {
                console.error("Failed to save progress to Supabase:", e);
                // Optionally, show a "Save failed" toast message
            }
        } else {
            localStorage.setItem('gx_beta_srs', JSON.stringify(newSrsState));
        }

        setPhase('PHASE4_SUMMARY');
    };

    const handleContinue = () => {
        if (queueIndex < queue.length - 1) {
            setQueueIndex(prev => prev + 1);
            loadWordData(queue[queueIndex + 1]);
        } else {
            setPhase('SESSION_COMPLETE');
        }
    };

    const handleExitLesson = async () => {
        setPhase('DASHBOARD');
        await loadInitialState(); // Re-fetch from DB to update dashboard stats
    };

    // ... All JSX renderers remain the same ...
    const SessionHeader = () => (
        <div className="flex justify-between items-center mb-6 px-1">
            <Button variant="secondary" onClick={handleExitLesson} className="px-3 py-1.5 h-auto text-xs flex items-center gap-1">
                <span>←</span> Exit Lesson
            </Button>
            <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Session Progress</span>
                <span className="text-xs font-bold text-black dark:text-white">{queueIndex + 1} / {queue.length}</span>
            </div>
        </div>
    );

    if (phase === 'DASHBOARD') {
        // FIX: Explicitly type `s` as SRSState to fix `s.interval` access error.
        const mastered = Object.values(srsState).filter((s: SRSState) => s.interval > 21).length;
        const due = allWords.filter(w => srsState[w.id] && srsState[w.id].nextReview <= Date.now()).length;
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6 flex flex-col items-center">
                <div className="w-full max-w-4xl">
                    <div className="flex justify-between items-center mb-12">
                         <h1 className="text-3xl font-black font-serif dark:text-white">Advanced Learning System</h1>
                         <button onClick={onExit} className="text-sm underline text-zinc-500 hover:text-black dark:hover:text-white transition-colors">Exit Beta</button>
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
                        <button onClick={startSession} className="bg-black dark:bg-white text-white dark:text-black text-xl font-bold py-4 px-12 rounded-full hover:scale-105 transition-transform shadow-xl">Start Session</button>
                    </div>
                </div>
            </div>
        );
    }

    if (phase === 'LOADING') {
        return (
            <div className="min-h-screen flex items-center justify-center flex-col bg-zinc-50 dark:bg-zinc-950">
                <div className="w-16 h-16 border-4 border-t-blue-500 border-zinc-200 dark:border-zinc-800 rounded-full animate-spin mb-6"></div>
                <h2 className="text-xl font-serif font-bold text-zinc-800 dark:text-zinc-200">Generating Rich Content...</h2>
                <p className="text-sm text-zinc-500 mt-2">Consulting cognitive science engine</p>
                <button onClick={handleExitLesson} className="mt-8 text-xs underline text-zinc-400">Cancel</button>
            </div>
        );
    }

    if (phase === 'SESSION_COMPLETE') {
         return (
             <div className="min-h-screen flex items-center justify-center flex-col bg-zinc-50 dark:bg-zinc-950 p-4 text-center">
                 <h1 className="text-6xl mb-6">🎉</h1>
                 <h2 className="text-4xl font-serif font-bold text-black dark:text-white mb-4">Session Complete</h2>
                 <p className="text-zinc-600 dark:text-zinc-400 mb-8">Accuracy: {sessionStats.total > 0 ? Math.round((sessionStats.correct/sessionStats.total)*100) : 0}%</p>
                 <button onClick={handleExitLesson} className="bg-black dark:bg-white text-white dark:text-black py-3 px-8 rounded-full font-bold">Return to Dashboard</button>
             </div>
         );
    }
    
    if (!currentCard) return null; // Should not happen after loading

    if (phase === 'PHASE1_ENCODING') {
        return (
            <div className="min-h-screen bg-[#F7F9FC] dark:bg-zinc-950 p-4 md:p-6 flex flex-col">
                <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col">
                    <SessionHeader />
                    <div className="flex justify-between items-center mb-6">
                         <span className="text-xs font-bold bg-blue-100 text-blue-800 px-3 py-1 rounded-full">INITIAL ENCODING</span>
                         <span className="text-sm font-mono text-zinc-400">Timer: {timeLeft}s</span>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-3xl shadow-xl border border-zinc-200 dark:border-zinc-800 flex-1 overflow-y-auto">
                        <div className="text-center mb-10 pb-8 border-b border-zinc-100 dark:border-zinc-800">
                            <h1 className="text-5xl md:text-6xl font-black text-black dark:text-white mb-4 tracking-tight">{currentCard.word}</h1>
                            <div className="flex items-center justify-center gap-4 text-zinc-500">
                                <span className="font-mono text-lg">{currentCard.pronunciation.ipa}</span>
                                <button onClick={() => speakText(currentCard.word)} className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded-full hover:bg-zinc-200 transition-colors">🔊</button>
                            </div>
                            <div className="mt-4 flex gap-2 justify-center">
                                <span className="text-xs uppercase font-bold tracking-widest text-zinc-400">{currentCard.metadata.partOfSpeech}</span>
                                <span className="text-xs uppercase font-bold tracking-widest text-zinc-400">• Level {currentCard.metadata.difficulty}/10</span>
                            </div>
                        </div>
                        <div className="mb-10 text-center">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">Definition</h3>
                            <p className="text-2xl font-serif text-zinc-800 dark:text-zinc-200 leading-relaxed max-w-lg mx-auto">{currentCard.definition.primary}</p>
                        </div>
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
                        <Button fullWidth onClick={startExercises} disabled={timeLeft > 0}>
                            {timeLeft > 0 ? `Wait ${timeLeft}s to Digest` : "Start Exercises →"}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }
    
    const currentEx = currentCard.exercises[currentExerciseIdx];
    if (phase === 'PHASE2_EXERCISES' && currentEx) {
         return (
            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4 md:p-6 flex flex-col items-center">
                 <div className="max-w-2xl w-full flex-1 flex flex-col">
                      <SessionHeader />
                      <div className="mb-8">
                          <div className="flex justify-between text-xs font-bold uppercase text-zinc-400 mb-2">
                              <span>Exercise {currentExerciseIdx + 1} / {currentCard.exercises.length}</span>
                              <span>{currentEx.type.replace('_', ' ')}</span>
                          </div>
                          <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <div className="h-full bg-black dark:bg-white transition-all duration-500" style={{ width: `${((currentExerciseIdx)/currentCard.exercises.length)*100}%` }}></div>
                          </div>
                      </div>
                      <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-lg border border-zinc-200 dark:border-zinc-800 flex-1 flex flex-col justify-center">
                           <h2 className="text-2xl font-serif font-bold text-center mb-8 dark:text-white leading-tight">
                               {currentEx.question || currentEx.definition || currentEx.instruction}
                           </h2>
                           {currentEx.options ? (
                               <div className="space-y-3">
                                   {currentEx.options.map((opt, i) => {
                                       let style = "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-black dark:hover:border-white text-black dark:text-white";
                                       if (feedback !== 'IDLE') {
                                           if (opt.correct) style = "border-green-500 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100";
                                           else if (i === selectedOption) style = "border-red-500 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100";
                                           else style = "opacity-50 text-zinc-500";
                                       } else if (selectedOption === i) {
                                           style = "border-black dark:border-white ring-2 ring-black dark:ring-white";
                                       }
                                       return ( <button key={i} onClick={() => setSelectedOption(i)} disabled={feedback !== 'IDLE'} className={`w-full p-5 text-lg font-medium border-2 rounded-xl transition-all ${style} text-left`}>{opt.text}</button> )
                                   })}
                               </div>
                           ) : (
                               <input value={inputVal} onChange={(e) => setInputVal(e.target.value)} disabled={feedback !== 'IDLE'} className="w-full text-2xl p-4 border-b-2 border-zinc-300 dark:border-zinc-700 bg-transparent text-center outline-none focus:border-black dark:focus:border-white dark:text-white font-serif" placeholder="Type your answer..." />
                           )}
                           {feedback !== 'IDLE' && ( <div className={`mt-8 p-4 rounded-xl text-center ${feedback === 'CORRECT' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}><p className="font-bold mb-1">{feedback === 'CORRECT' ? (currentEx.feedback?.correct || "Correct!") : (currentEx.feedback?.incorrect || "Incorrect.")}</p></div> )}
                      </div>
                      <div className="mt-8">
                          {feedback === 'IDLE' ? (
                              <Button fullWidth onClick={handleCheck} disabled={(!selectedOption && selectedOption !== 0) && !inputVal}>Check Answer</Button>
                          ) : (
                              <Button fullWidth onClick={nextExercise}>Continue</Button>
                          )}
                      </div>
                 </div>
            </div>
        );
    }
    
    if (phase === 'PHASE3_CONFIDENCE') {
        return (
            <div className="min-h-screen bg-white dark:bg-zinc-950 p-6 flex flex-col items-center justify-center">
                 <div className="max-w-xl w-full text-center flex-1 flex flex-col justify-center">
                      <SessionHeader />
                      <div className="flex-1 flex flex-col justify-center">
                        <h2 className="text-3xl font-serif font-bold mb-2 dark:text-white">Self Assessment</h2>
                        <p className="text-zinc-500 mb-10">How confident are you with "{currentCard.word}"?</p>
                        <div className="space-y-3">
                            {[
                                { lvl: 5, label: "Mastery", sub: "I could teach this", days: 30 },
                                { lvl: 4, label: "Confident", sub: "Can use in writing", days: 14 },
                                { lvl: 3, label: "Moderate", sub: "Understand when seen", days: 7 },
                                { lvl: 2, label: "Weak", sub: "Vaguely familiar", days: 3 },
                                { lvl: 1, label: "Unfamiliar", sub: "Don't know it", days: 1 },
                            ].map((opt) => (
                                <button key={opt.lvl} onClick={() => handleConfidence(opt.lvl)} className="w-full p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:border-black dark:hover:border-white hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all flex justify-between items-center group bg-white dark:bg-zinc-950">
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
            </div>
        );
    }

    if (phase === 'PHASE4_SUMMARY') {
        return (
            <div className="min-h-screen bg-green-50 dark:bg-zinc-950 p-6 flex flex-col items-center justify-center">
                <div className="max-w-md w-full bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-xl border border-green-100 dark:border-zinc-800 text-center animate-popIn">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-3xl mx-auto mb-6">✅</div>
                    <h2 className="text-3xl font-serif font-bold text-black dark:text-white mb-2">Word Saved!</h2>
                    <p className="text-zinc-500 dark:text-zinc-400 mb-8">You've completed <strong>{currentCard.word}</strong>.</p>
                    <div className="space-y-4">
                        <Button fullWidth onClick={handleContinue} className="h-14 text-lg">Continue to Next Word →</Button>
                        <Button fullWidth variant="secondary" onClick={handleExitLesson} className="h-14">Exit to Dashboard</Button>
                    </div>
                </div>
            </div>
        );
    }
    
    return null;
};

export default BetaSRS;