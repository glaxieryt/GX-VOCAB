
// ... existing imports ...
import React, { useState, useMemo, useEffect } from 'react';
import { WordGroup, AppView, UserProfile } from './types';
import { getGroupedData, allWords } from './data';
import { getCurrentSession, saveUserProgress, signOut, recordMistake, getLeaderboard } from './services/authService';
import Button from './components/Button';
import WordCard from './components/WordCard';
import Quiz from './components/Quiz';
import GuidedLearning from './components/GuidedLearning';
import Logo from './components/Logo';
import AuthScreen from './components/AuthScreen';
import ThemeToggle from './components/ThemeToggle';
import { getEasyMeaning } from './services/geminiService';
import BetaSRS from './components/BetaSRS';
import MathModule from './components/MathModule';

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [view, setView] = useState<AppView>(AppView.SUBJECT_SELECTION);
  const [selectedGroup, setSelectedGroup] = useState<WordGroup | null>(null);
  const [quizResult, setQuizResult] = useState<{score: number, total: number} | null>(null);

  // Learning Progress State
  const [learningIndex, setLearningIndex] = useState(0);
  const [learnedWords, setLearnedWords] = useState<string[]>([]);
  
  // Loading state
  const [checkingSession, setCheckingSession] = useState(true);

  // Ask AI Popup State
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [aiPopupPosition, setAiPopupPosition] = useState<{top: number, left: number} | null>(null);
  const [aiMeaning, setAiMeaning] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // Leaderboard State
  const [leaderboard, setLeaderboard] = useState<{username: string, score: number}[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // Function to sync user data from the source of truth (DB or localStorage)
  const syncUserSession = async () => {
    const session = await getCurrentSession();
    if (session) {
        setUser(session);
        setLearningIndex(session.learningIndex);
        setLearnedWords(session.learnedWords);
    }
  };

  useEffect(() => {
    const initSession = async () => {
        await syncUserSession();
        setCheckingSession(false);
    };
    initSession();
  }, []);

  // Text Selection Listener
  useEffect(() => {
    const handleSelection = (e: Event) => {
        setTimeout(() => {
            const selection = window.getSelection();
            const text = selection?.toString().trim();
            
            if ((e.target as HTMLElement).closest('.ask-ai-popup')) return;

            if (text && text.length > 0 && text.length < 50) {
                const range = selection?.getRangeAt(0);
                const rect = range?.getBoundingClientRect();
                if (rect && rect.width > 0) {
                    setAiPopupPosition({
                        top: rect.top + window.scrollY - 60,
                        left: rect.left + window.scrollX + (rect.width / 2)
                    });
                    setSelectedText(text);
                    if (selectedText !== text) {
                         setAiMeaning(null);
                         setLoadingAi(false);
                    }
                }
            } else {
                setAiPopupPosition(null);
                setSelectedText(null);
            }
        }, 10);
    };

    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('touchend', handleSelection); 
    document.addEventListener('keyup', handleSelection);

    return () => {
        document.removeEventListener('mouseup', handleSelection);
        document.removeEventListener('touchend', handleSelection);
        document.removeEventListener('keyup', handleSelection);
    };
  }, [selectedText]);

  const handleAuthSuccess = (loggedInUser: UserProfile) => {
      setUser(loggedInUser);
      setLearningIndex(loggedInUser.learningIndex);
      setLearnedWords(loggedInUser.learnedWords);
  };

  const handleSignOut = () => {
      signOut();
      setUser(null);
      setView(AppView.SUBJECT_SELECTION);
      setLearningIndex(0);
      setLearnedWords([]);
  };

  const saveProgress = (index: number, learned: string[], addedXp: number = 0) => {
     if (user) {
         // Calculate new total safely
         const currentXp = user.xp || 0;
         const newTotalXp = currentXp + addedXp;
         
         // Update Local State immediately
         setUser(prev => prev ? ({ ...prev, xp: newTotalXp }) : null);
         
         // Persist to Database
         saveUserProgress(user.username, index, learned, newTotalXp);
     }
  };

  const handleWordComplete = (wordId: string) => {
      const newIndex = learningIndex + 1;
      const newLearned = [...(learnedWords || []), wordId];
      setLearningIndex(newIndex);
      setLearnedWords(newLearned);
      // Award 10 XP for learning a new word in Guided mode
      saveProgress(newIndex, newLearned, 10); 
  };
  
  const handleMistake = (wordId: string) => {
      if (user) {
          recordMistake(user.username, wordId);
          setUser(prev => {
              if(!prev) return null;
              const newMistakes = { ...prev.mistakes };
              newMistakes[wordId] = (newMistakes[wordId] || 0) + 1;
              return { ...prev, mistakes: newMistakes };
          });
      }
  };

  const handleEarnXP = (amount: number) => {
      if (user) {
          saveProgress(learningIndex, learnedWords, amount);
      }
  };

  const handleResetProgress = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    if (window.confirm("Reset all progress? This clears learned words and resets index to 0. XP will remain.")) {
      setLearningIndex(0);
      setLearnedWords([]);
      saveProgress(0, [], 0);
    }
  };

  const handleAskAI = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!selectedText) return;
      setLoadingAi(true);
      const meaning = await getEasyMeaning(selectedText, "General Vocabulary");
      setAiMeaning(meaning);
      setLoadingAi(false);
  };

  const groups = useMemo(() => getGroupedData(30), []);

  const handleStartLearn = () => {
    setView(AppView.GROUP_SELECT_LEARN);
    setSelectedGroup(null);
  };

  const handleStartTest = () => {
    setView(AppView.GROUP_SELECT_QUIZ);
    setSelectedGroup(null);
    setQuizResult(null);
  };

  const handleStartGuided = () => {
      setView(AppView.GUIDED_LEARNING);
  };

  const handleStartRevision = () => {
      if (!user || !user.learnedWords || user.learnedWords.length === 0) {
          alert("You haven't learned any words yet! Complete some daily lessons first.");
          return;
      }
      const learnedObjects = allWords.filter(w => user.learnedWords.includes(w.id));
      const shuffled = [...learnedObjects].sort(() => Math.random() - 0.5);
      const revisionGroup: WordGroup = {
          id: 'full_revision',
          label: 'Comprehensive Revision',
          words: shuffled
      };
      setSelectedGroup(revisionGroup);
      setView(AppView.QUIZ_MODE);
  };

  const handleShowLeaderboard = async () => {
      setView(AppView.LEADERBOARD);
      setLoadingLeaderboard(true);
      const data = await getLeaderboard();
      setLeaderboard(data);
      setLoadingLeaderboard(false);
  };

  const handleGroupSelect = (group: WordGroup) => {
    setSelectedGroup(group);
    if (view === AppView.GROUP_SELECT_LEARN) {
      setView(AppView.LEARN_MODE);
    } else {
      setView(AppView.QUIZ_MODE);
    }
  };

  const goHome = async () => {
    await syncUserSession(); // Re-sync data when returning to home, e.g., from ALS
    setView(AppView.HOME);
    setSelectedGroup(null);
    setQuizResult(null);
  };
  
  const goSubjectSelection = async () => {
      await syncUserSession(); // Also sync here for consistency when exiting modules
      setView(AppView.SUBJECT_SELECTION);
      setSelectedGroup(null);
      setQuizResult(null);
  };

  const handleQuizFinish = (score: number, total: number) => {
    setQuizResult({ score, total });
    // Award 1 XP per correct answer in revision to prevent XP farming, but still reward effort
    if (score > 0) {
        saveProgress(learningIndex, learnedWords, score); 
    }
  };

  // --- Render Functions ---

  const renderHeader = () => (
    <header className="border-b border-zinc-200 dark:border-zinc-800 py-5 mb-8 flex justify-between items-center bg-white dark:bg-zinc-950 sticky top-0 z-30 px-4 md:px-0 transition-colors">
      <div onClick={goSubjectSelection} className="cursor-pointer hover:opacity-80 transition-opacity">
        <Logo />
      </div>
      <div className="flex items-center gap-4">
          <ThemeToggle />
          {view !== AppView.SUBJECT_SELECTION && (
              <span className="hidden md:block text-xs font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
                  {user?.username}
              </span>
          )}
          <button 
             onClick={handleSignOut}
             className="text-xs font-bold uppercase tracking-widest text-red-600 hover:text-red-500"
          >
             Sign Out
          </button>
      </div>
    </header>
  );

  const FloatingXPBar = () => {
      if (!user) return null;
      return (
          <div className="fixed top-4 right-4 z-[60] flex items-center gap-2 animate-fadeIn pointer-events-none">
              <div className="bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-400 px-4 py-2 rounded-full text-sm font-black uppercase tracking-widest border-2 border-yellow-300 dark:border-yellow-700 shadow-xl flex items-center gap-2 transform transition-all duration-300 hover:scale-105">
                  <span className="text-lg">⚡</span>
                  {user.xp || 0} XP
              </div>
          </div>
      );
  };
  
  const renderSubjectSelection = () => (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-12 animate-fadeIn pb-12">
          <div className="text-center space-y-4 px-4 mb-4">
              <h2 className="text-5xl md:text-7xl font-serif font-medium tracking-tight text-black dark:text-white animate-slideUp">Choose Your Path</h2>
              <p className="text-zinc-500 dark:text-zinc-400 max-w-md mx-auto text-lg font-light animate-slideUp" style={{ animationDelay: '0.1s' }}>
                  What would you like to master today?
              </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl px-4 animate-slideUp" style={{ animationDelay: '0.2s' }}>
              {/* ENGLISH CARD */}
              <div 
                  onClick={() => setView(AppView.HOME)}
                  className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-8 shadow-lg hover:shadow-2xl transition-all hover:-translate-y-2 cursor-pointer flex flex-col items-center text-center h-80 justify-center relative overflow-hidden"
              >
                  <div className="flex-1 flex flex-col items-center justify-center">
                      <span className="text-6xl mb-6 group-hover:scale-110 transition-transform duration-300 block">📚</span>
                      <h3 className="text-4xl font-serif font-bold mb-3 text-black dark:text-white">English</h3>
                      <p className="text-zinc-500 dark:text-zinc-400 max-w-xs">
                          Master 1500+ advanced vocabulary words with AI-powered guided learning.
                      </p>
                  </div>
                  <div className="w-full mt-4">
                      <Button fullWidth>Enter Class</Button>
                  </div>
              </div>

              {/* MATHS CARD */}
              <div 
                  onClick={() => setView(AppView.MATH_MODE)}
                  className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-8 shadow-lg hover:shadow-2xl transition-all hover:-translate-y-2 cursor-pointer flex flex-col items-center text-center h-80 justify-center relative overflow-hidden"
              >
                  <div className="flex-1 flex flex-col items-center justify-center">
                      <span className="text-6xl mb-6 group-hover:rotate-12 transition-transform duration-300 block">🧮</span>
                      <h3 className="text-4xl font-serif font-bold mb-3 text-black dark:text-white">Maths</h3>
                      <p className="text-zinc-500 dark:text-zinc-400 max-w-xs">
                          Professional platform for mastering multiplication, powers, and roots.
                      </p>
                  </div>
                  <div className="w-full mt-4">
                      <Button fullWidth>Enter Dojo</Button>
                  </div>
              </div>
          </div>

          {/* Leaderboard Button - Moved Here */}
          <div className="w-full max-w-md animate-slideUp" style={{ animationDelay: '0.3s' }}>
             <Button onClick={handleShowLeaderboard} variant="outline" fullWidth className="h-16 text-xl border-yellow-600/50 text-yellow-700 dark:text-yellow-500 hover:border-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/10 flex items-center justify-center gap-2">
                <span>🏆</span> View Global Leaderboard
             </Button>
          </div>
      </div>
  );
  
  const renderLeaderboard = () => (
      <div className="max-w-2xl mx-auto animate-fadeIn pb-20 mt-12 border-t border-zinc-200 dark:border-zinc-800 pt-12">
          <div className="flex items-center justify-between mb-8">
              <Button onClick={goSubjectSelection} variant="secondary" className="px-3 py-1.5 h-auto text-xs">← Back</Button>
              <div className="text-center">
                <h2 className="text-3xl font-serif font-bold mb-1 text-black dark:text-white">Global Leaderboard</h2>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm">Ranked by total Experience Points (XP)</p>
              </div>
              <div className="w-10"></div>
          </div>

          {loadingLeaderboard ? (
              <div className="flex justify-center py-20">
                  <div className="w-8 h-8 border-4 border-zinc-200 border-t-black dark:border-zinc-800 dark:border-t-white rounded-full animate-spin"></div>
              </div>
          ) : leaderboard.length === 0 ? (
               <div className="text-center py-20 bg-zinc-50 dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg">
                  <p className="text-zinc-400">No data available yet.</p>
               </div>
          ) : (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-xl">
                  {leaderboard.map((entry, idx) => {
                      const isCurrentUser = entry.username === user?.username;
                      const rank = idx + 1;
                      let rankStyle = "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400";
                      if (rank === 1) rankStyle = "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-500";
                      if (rank === 2) rankStyle = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
                      if (rank === 3) rankStyle = "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-500";

                      return (
                          <div 
                             key={entry.username} 
                             className={`flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${isCurrentUser ? 'bg-zinc-50 dark:bg-zinc-800/30' : ''}`}
                          >
                              <div className="flex items-center gap-4">
                                  <div className={`w-10 h-10 flex items-center justify-center rounded-full font-bold text-sm ${rankStyle}`}>
                                      #{rank}
                                  </div>
                                  <div className="flex flex-col">
                                      <span className={`font-medium text-lg ${isCurrentUser ? 'font-bold text-black dark:text-white' : 'text-zinc-700 dark:text-zinc-300'}`}>
                                          {entry.username} {isCurrentUser && "(You)"}
                                      </span>
                                  </div>
                              </div>
                              <div className="text-right">
                                  <span className="block text-xl font-bold font-serif text-black dark:text-white">{entry.score}</span>
                                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-widest">XP</span>
                              </div>
                          </div>
                      );
                  })}
              </div>
          )}
      </div>
  );

  const renderHome = () => {
    const totalWords = allWords?.length || 1500;
    const progressPercent = Math.min(((learningIndex || 0) / totalWords) * 100, 100);
    const wordsLearnedCount = learnedWords?.length || 0;
    
    // Calculate ALS Mastery
    const alsMasteredCount = user?.srs_state 
        ? Object.values(user.srs_state).filter((s: any) => s.interval > 21).length 
        : 0;
    const alsProgressPercent = Math.min((alsMasteredCount / 1500) * 100, 100);

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-fadeIn pb-12">
        <div className="text-center space-y-4 px-4 mb-4">
          <h2 className="text-5xl md:text-8xl font-serif font-medium tracking-tight text-black dark:text-white animate-slideUp">Master English</h2>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-md mx-auto text-lg font-light animate-slideUp" style={{ animationDelay: '0.1s' }}>
            Choose your learning method.
          </p>
        </div>
        
        {/* ALS BUTTON */}
        <div className="w-full max-w-3xl animate-slideUp" style={{ animationDelay: '0.15s' }}>
             <Button 
                onClick={() => setView(AppView.BETA_SRS)} 
                variant="outline"
                className="w-full h-32 border-2 border-blue-500 bg-blue-50 text-blue-900 hover:bg-blue-100 hover:text-blue-950 dark:bg-blue-900/30 dark:text-blue-100 dark:border-blue-500/50 dark:hover:bg-blue-900/50 relative overflow-hidden flex flex-col items-center justify-center gap-3 shadow-lg hover:shadow-xl transition-all"
             >
                <div className="z-10 flex items-center gap-2 font-bold text-3xl">
                    🚀 ALS
                </div>
                <div className="text-sm font-normal opacity-80 z-10">Advanced Learning System (Recommended)</div>
                
                <div className="w-full max-w-sm flex items-center gap-3 z-10 mt-2">
                    <div className="flex-1 h-3 bg-blue-200 dark:bg-blue-950/50 rounded-full overflow-hidden border border-blue-300 dark:border-blue-800">
                        <div 
                            className="h-full bg-blue-600 dark:bg-blue-400 transition-all duration-1000 ease-out" 
                            style={{ width: `${alsProgressPercent}%` }} 
                        />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest whitespace-nowrap min-w-[100px] text-right">
                        {alsMasteredCount} / 1500
                    </span>
                </div>
             </Button>
        </div>

        {/* NLS CONTAINER */}
        <div className="w-full max-w-3xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 p-6 rounded-lg animate-slideUp" style={{ animationDelay: '0.2s' }}>
            <h3 className="text-center font-bold uppercase tracking-widest text-zinc-400 mb-6">NLS (Normal Learning System)</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Daily Lesson Card */}
                <div className="border border-black dark:border-zinc-700 p-6 bg-zinc-50 dark:bg-zinc-900 shadow-md relative overflow-hidden group cursor-pointer transition-all hover:-translate-y-1 rounded-sm flex flex-col justify-between h-56 hover:shadow-lg" onClick={handleStartGuided}>
                    <div>
                        <h3 className="text-xl font-bold font-serif mb-1 text-black dark:text-white">
                            {learningIndex > 0 ? "Continue Lesson" : "Start Lesson"}
                        </h3>
                        <p className="text-zinc-500 dark:text-zinc-400 text-xs">Standard linear progression.</p>
                    </div>
                    
                    <div>
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-1 text-zinc-400 dark:text-zinc-500">
                            <span>Progress</span>
                            <span>{learningIndex} / {totalWords}</span>
                        </div>
                        <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 w-full rounded-full overflow-hidden mb-3">
                            <div 
                                className="h-full bg-black dark:bg-white transition-all duration-1000 ease-out" 
                                style={{ width: `${progressPercent}%` }} 
                            />
                        </div>
                        
                        <div className="flex justify-between items-end">
                            {learningIndex > 0 ? (
                                <button 
                                onClick={handleResetProgress}
                                className="text-[9px] text-zinc-400 hover:text-red-600 dark:hover:text-red-400 font-bold uppercase tracking-widest z-10 transition-colors"
                                >
                                Reset
                                </button>
                            ) : <span></span>}
                            <span className="text-xs font-bold border-b border-black dark:border-white pb-0.5 px-1 text-black dark:text-white">
                            {learningIndex > 0 ? "Resume →" : "Start →"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Revision Card */}
                <div 
                    className={`border border-zinc-200 dark:border-zinc-800 p-6 bg-white dark:bg-zinc-950 shadow-sm relative overflow-hidden group transition-all rounded-sm flex flex-col justify-between h-56 ${wordsLearnedCount > 0 ? 'cursor-pointer hover:-translate-y-1 hover:border-black dark:hover:border-white hover:shadow-lg' : 'opacity-60 cursor-not-allowed'}`} 
                    onClick={wordsLearnedCount > 0 ? handleStartRevision : undefined}
                >
                    <div>
                        <h3 className="text-xl font-bold font-serif mb-1 text-black dark:text-white">
                            Full Review
                        </h3>
                        <p className="text-zinc-500 dark:text-zinc-400 text-xs">
                            Test all {wordsLearnedCount} learned words.
                        </p>
                    </div>
                    
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                             <div className="text-3xl font-serif font-black text-black dark:text-white">
                                 {wordsLearnedCount}
                             </div>
                        </div>
                        <div className="flex justify-end items-end">
                            <span className="text-xs font-bold border-b border-zinc-300 dark:border-zinc-700 pb-0.5 px-1 text-zinc-600 dark:text-zinc-300">
                            Start →
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-6 flex flex-col md:flex-row gap-4">
               <Button onClick={() => setView(AppView.MISTAKES)} variant="secondary" fullWidth className="h-12 text-sm">
                  My Mistakes ({Object.keys(user?.mistakes || {}).length})
               </Button>
               <Button onClick={handleStartLearn} fullWidth variant="outline" className="h-12 text-sm">
                  Browse Groups
               </Button>
            </div>
        </div>
      </div>
    );
  };

  const renderGroupSelection = (mode: 'learn' | 'quiz') => (
    <div className="animate-fadeIn">
      <div className="mb-8">
        <h2 className="text-3xl md:text-4xl font-serif font-bold mb-2 text-black dark:text-white">
          {mode === 'learn' ? 'Select a Group to Learn' : 'Select a Group to Test'}
        </h2>
        <p className="text-zinc-500 dark:text-zinc-400">
          Vocabulary is divided into manageable sets of 30 words.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
        {groups?.map((group) => (
          <button
            key={group.id}
            onClick={() => handleGroupSelect(group)}
            className="group border border-zinc-200 dark:border-zinc-800 p-6 text-left hover:border-black dark:hover:border-white hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all duration-300 bg-white dark:bg-zinc-950 rounded-sm"
          >
            <span className="text-xs font-bold uppercase text-zinc-400 dark:text-zinc-500 mb-2 block tracking-widest">
              Set {group.id.toString().padStart(2, '0')}
            </span>
            <h3 className="text-lg font-semibold group-hover:translate-x-1 transition-transform text-black dark:text-white">
              {group.label}
            </h3>
            <p className="text-zinc-400 dark:text-zinc-500 mt-2 text-sm">{group.words?.length || 0} words</p>
          </button>
        ))}
      </div>
    </div>
  );

  const renderLearnMode = () => (
    <div className="max-w-2xl mx-auto animate-fadeIn pb-24">
      <div className="mb-10 border-b border-black dark:border-white pb-4 sticky top-20 bg-white dark:bg-zinc-950 z-20 pt-4">
        <button 
          onClick={() => setView(AppView.GROUP_SELECT_LEARN)}
          className="text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-black dark:hover:text-white mb-2 block"
        >
          ← Back to Groups
        </button>
        <h2 className="text-3xl font-serif font-bold text-black dark:text-white">{selectedGroup?.label}</h2>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-sm">Click a word to reveal its meaning.</p>
      </div>

      <div className="space-y-2">
        {selectedGroup?.words?.map((word) => (
          <WordCard key={word.id} word={word} />
        ))}
      </div>
      
      <div className="fixed bottom-6 right-6 z-30">
        <Button onClick={() => setView(AppView.QUIZ_MODE)} className="shadow-2xl">
          Take Quiz for this Group →
        </Button>
      </div>
    </div>
  );

  const renderQuizMode = () => {
    if (quizResult) {
      const percentage = quizResult.total > 0 ? Math.round((quizResult.score / quizResult.total) * 100) : 0;
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] animate-popIn text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Results</span>
          <h2 className="text-8xl font-serif font-bold mb-4 text-black dark:text-white">{percentage}%</h2>
          <p className="text-2xl mb-8 text-black dark:text-white">
            You got {quizResult.score} out of {quizResult.total} correct.
          </p>
          <div className="flex gap-4 flex-col md:flex-row">
            <Button onClick={() => setView(AppView.HOME)} variant="outline">
              Return Home
            </Button>
            <Button onClick={() => {
              setQuizResult(null); 
            }}>
              Retry
            </Button>
          </div>
        </div>
      );
    }

    return (
      <Quiz 
        key={selectedGroup?.id} 
        group={selectedGroup!} 
        onFinish={handleQuizFinish}
        onExit={() => setView(AppView.HOME)}
      />
    );
  };

  if (checkingSession) {
      return (
          <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
               <div className="w-8 h-8 border-4 border-zinc-200 border-t-black dark:border-zinc-800 dark:border-t-white rounded-full animate-spin"></div>
          </div>
      );
  }

  if (!user) {
      return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  // --- GLOBAL RENDER ---
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-black dark:text-white px-4 md:px-8 font-sans selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black transition-colors duration-300 relative">
      
      {/* Floating XP Bar - Always visible */}
      <FloatingXPBar />

      <div className="max-w-5xl mx-auto">
        {/* Header - Always visible now */}
        {renderHeader()}
        
        <main className="pb-10">
          {view === AppView.SUBJECT_SELECTION && renderSubjectSelection()}
          {view === AppView.HOME && renderHome()}
          {view === AppView.GROUP_SELECT_LEARN && renderGroupSelection('learn')}
          {view === AppView.GROUP_SELECT_QUIZ && renderGroupSelection('quiz')}
          {view === AppView.LEARN_MODE && renderLearnMode()}
          {view === AppView.QUIZ_MODE && renderQuizMode()}
          {view === AppView.MISTAKES && <div></div>}
          {view === AppView.LEADERBOARD && renderLeaderboard()}
          {view === AppView.GUIDED_LEARNING && (
             <GuidedLearning 
                initialIndex={learningIndex} 
                learnedWordsIds={learnedWords}
                onWordComplete={handleWordComplete}
                onMistake={handleMistake}
                onExit={goHome}
             />
          )}
          
          {/* SPECIAL FULL-SCREEN MODES */}
          {/* Note: In a real app, we might use React Portal or proper routing */}
        </main>
      </div>

      {/* Beta & Math Modules take over the screen but we still render them here to share context */}
      {view === AppView.BETA_SRS && (
          <div className="fixed inset-0 z-40 overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
              <BetaSRS onExit={goHome} onEarnXP={handleEarnXP} />
          </div>
      )}

      {view === AppView.MATH_MODE && (
          <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-50">
              <MathModule onExit={goSubjectSelection} onEarnXP={handleEarnXP} />
          </div>
      )}

      {/* Ask AI Context Menu */}
      {view !== AppView.SUBJECT_SELECTION && view !== AppView.MATH_MODE && view !== AppView.BETA_SRS && aiPopupPosition && selectedText && (
          <div 
             className="fixed bg-black dark:bg-white text-white dark:text-black rounded-lg shadow-2xl p-4 w-72 animate-popIn ask-ai-popup"
             style={{ 
                 top: aiPopupPosition.top, 
                 left: aiPopupPosition.left, 
                 transform: 'translateX(-50%) translateY(-100%)',
                 zIndex: 9999 
             }}
             onMouseDown={(e) => e.stopPropagation()} 
          >
              <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold uppercase tracking-widest opacity-70">Ask AI</span>
              </div>
              
              <div className="text-lg font-serif italic mb-3 border-l-2 border-white/30 dark:border-black/30 pl-3 line-clamp-3">"{selectedText}"</div>
              
              {loadingAi ? (
                  <div className="flex items-center gap-2 text-xs opacity-70">
                      <div className="w-2 h-2 bg-white dark:bg-black rounded-full animate-bounce"></div>
                      Thinking...
                  </div>
              ) : aiMeaning ? (
                  <div className="text-sm leading-relaxed animate-fadeIn bg-white/10 dark:bg-black/5 p-2 rounded">
                      {aiMeaning}
                  </div>
              ) : (
                  <button 
                     onClick={handleAskAI}
                     className="bg-white/20 hover:bg-white/30 dark:bg-black/10 dark:hover:bg-black/20 w-full py-2 text-xs font-bold uppercase rounded transition-colors"
                  >
                      Get Simple Meaning
                  </button>
              )}
              
              <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-black dark:bg-white rotate-45"></div>
          </div>
      )}
    </div>
  );
};

export default App;
