
import React, { useState, useMemo, useEffect } from 'react';
import { WordGroup, AppView, UserProfile } from './types';
import { getGroupedData, allWords } from './data';
import { getCurrentSession, saveUserProgress, signOut, recordMistake } from './services/authService';
import Button from './components/Button';
import WordCard from './components/WordCard';
import Quiz from './components/Quiz';
import GuidedLearning from './components/GuidedLearning';
import Logo from './components/Logo';
import AuthScreen from './components/AuthScreen';
import ThemeToggle from './components/ThemeToggle';
import { getEasyMeaning } from './services/geminiService';

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [view, setView] = useState<AppView>(AppView.HOME);
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

  // Check for existing session on mount
  useEffect(() => {
    const initSession = async () => {
        const session = await getCurrentSession();
        if (session) {
            setUser(session);
            setLearningIndex(session.learningIndex);
            setLearnedWords(session.learnedWords);
        }
        setCheckingSession(false);
    };
    initSession();
  }, []);

  // Text Selection Listener
  useEffect(() => {
    const handleSelection = (e: Event) => {
        // Delay slightly to let the browser process the selection
        setTimeout(() => {
            const selection = window.getSelection();
            const text = selection?.toString().trim();
            
            // If clicking inside the popup, don't clear it
            if ((e.target as HTMLElement).closest('.ask-ai-popup')) {
                return;
            }

            if (text && text.length > 0 && text.length < 50) {
                const range = selection?.getRangeAt(0);
                const rect = range?.getBoundingClientRect();
                if (rect && rect.width > 0) {
                    // Position above the selection
                    setAiPopupPosition({
                        top: rect.top + window.scrollY - 60,
                        left: rect.left + window.scrollX + (rect.width / 2)
                    });
                    setSelectedText(text);
                    // Only reset meaning if it's a new text
                    if (selectedText !== text) {
                         setAiMeaning(null);
                         setLoadingAi(false);
                    }
                }
            } else {
                // Clicked away or empty selection
                setAiPopupPosition(null);
                setSelectedText(null);
            }
        }, 10);
    };

    // Listeners for mouse, touch, and keyboard selection
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
      setView(AppView.HOME);
      setLearningIndex(0);
      setLearnedWords([]);
  };

  const saveProgress = (index: number, learned: string[]) => {
     if (user) {
         saveUserProgress(user.username, index, learned);
     }
  };

  const handleWordComplete = (wordId: string) => {
      const newIndex = learningIndex + 1;
      const newLearned = [...(learnedWords || []), wordId];
      setLearningIndex(newIndex);
      setLearnedWords(newLearned);
      saveProgress(newIndex, newLearned);
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

  const handleResetProgress = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    if (window.confirm("Are you sure you want to reset your progress to zero? This cannot be undone.")) {
      setLearningIndex(0);
      setLearnedWords([]);
      saveProgress(0, []);
    }
  };

  const handleAskAI = async (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent clearing selection
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

  const handleGroupSelect = (group: WordGroup) => {
    setSelectedGroup(group);
    if (view === AppView.GROUP_SELECT_LEARN) {
      setView(AppView.LEARN_MODE);
    } else {
      setView(AppView.QUIZ_MODE);
    }
  };

  const goHome = () => {
    setView(AppView.HOME);
    setSelectedGroup(null);
    setQuizResult(null);
  };

  const handleQuizFinish = (score: number, total: number) => {
    setQuizResult({ score, total });
  };

  // --- Render Functions ---

  const renderHeader = () => (
    <header className="border-b border-zinc-200 dark:border-zinc-800 py-5 mb-8 flex justify-between items-center bg-white dark:bg-zinc-950 sticky top-0 z-30 px-4 md:px-0 transition-colors">
      <div onClick={goHome} className="cursor-pointer hover:opacity-80 transition-opacity">
        <Logo />
      </div>
      <div className="flex items-center gap-4">
          <ThemeToggle />
          <span className="hidden md:block text-xs font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
             {user?.username}
          </span>
          {view !== AppView.HOME && (
            <button 
              onClick={goHome}
              className="text-xs font-bold uppercase tracking-widest hover:underline text-black dark:text-white"
            >
              Home
            </button>
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
  
  const renderMistakes = () => {
      const mistakeIds = Object.keys(user?.mistakes || {});
      const mistakeList = mistakeIds
        .map(id => {
            const word = allWords.find(w => w.id === id);
            return word ? { ...word, count: user?.mistakes[id] || 0 } : null;
        })
        .filter(w => w !== null)
        .sort((a,b) => (b?.count || 0) - (a?.count || 0));

      return (
          <div className="animate-slideUp pb-20">
              <div className="mb-8">
                <h2 className="text-4xl font-serif font-bold mb-2">My Mistakes</h2>
                <p className="text-zinc-500 dark:text-zinc-400">Words you have struggled with.</p>
              </div>
              
              {mistakeList.length === 0 ? (
                  <div className="text-center py-20 bg-zinc-50 dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg">
                      <p className="text-xl text-zinc-400 font-serif">You haven't made any mistakes yet.</p>
                      <p className="text-sm text-zinc-400 mt-2">Keep learning!</p>
                  </div>
              ) : (
                  <div className="space-y-4">
                      {mistakeList.map((item) => (
                          <div key={item!.id} className="border border-red-100 dark:border-red-900/50 bg-red-50/30 dark:bg-red-900/10 p-4 flex justify-between items-center rounded-lg transition-transform hover:scale-[1.01]">
                              <div>
                                  <div className="flex items-center gap-2">
                                      <h3 className="text-lg font-bold font-serif dark:text-red-50">{item!.term}</h3>
                                      <span className="text-[10px] bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-2 py-0.5 rounded-full font-bold">
                                          Missed {item!.count}x
                                      </span>
                                  </div>
                                  <p className="text-zinc-600 dark:text-zinc-300 mt-1">{item!.meaning}</p>
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      );
  };

  const renderHome = () => {
    const totalWords = allWords?.length || 1500;
    const progressPercent = Math.min(((learningIndex || 0) / totalWords) * 100, 100);
    const wordsLearnedCount = learnedWords?.length || 0;

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-12 animate-fadeIn pb-12">
        <div className="text-center space-y-4 px-4">
          <h2 className="text-5xl md:text-8xl font-serif font-medium tracking-tight text-black dark:text-white animate-slideUp">Master English</h2>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-md mx-auto text-lg font-light animate-slideUp" style={{ animationDelay: '0.1s' }}>
            Your personalized journey to 1500 advanced vocabulary words.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl animate-slideUp" style={{ animationDelay: '0.2s' }}>
            {/* Daily Lesson Card */}
            <div className="border border-black dark:border-zinc-700 p-6 bg-zinc-50 dark:bg-zinc-900 shadow-lg relative overflow-hidden group cursor-pointer transition-all hover:-translate-y-1 rounded-sm flex flex-col justify-between h-64 hover:shadow-2xl" onClick={handleStartGuided}>
                <div>
                    <div className="absolute top-0 right-0 bg-black dark:bg-white text-white dark:text-black px-3 py-1 text-[10px] font-bold uppercase tracking-widest">
                        Guided Path
                    </div>
                    <h3 className="text-2xl font-bold font-serif mb-2 text-black dark:text-white">
                        {learningIndex > 0 ? "Continue Lesson" : "Start Lesson"}
                    </h3>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm">Progressive difficulty with spaced repetition.</p>
                </div>
                
                <div>
                    <div className="flex justify-between text-xs font-bold uppercase tracking-widest mb-2 text-zinc-400 dark:text-zinc-500">
                        <span>Progress</span>
                        <span>{learningIndex} / {totalWords}</span>
                    </div>
                    <div className="h-2 bg-zinc-200 dark:bg-zinc-800 w-full rounded-full overflow-hidden mb-4">
                        <div 
                            className="h-full bg-black dark:bg-white transition-all duration-1000 ease-out" 
                            style={{ width: `${progressPercent}%` }} 
                        />
                    </div>
                    
                    <div className="flex justify-between items-end">
                        {learningIndex > 0 ? (
                            <button 
                            onClick={handleResetProgress}
                            className="text-[10px] text-zinc-400 hover:text-red-600 dark:hover:text-red-400 font-bold uppercase tracking-widest z-10 transition-colors"
                            >
                            Reset
                            </button>
                        ) : <span></span>}
                        <span className="text-sm font-bold border-b-2 border-black dark:border-white pb-0.5 group-hover:bg-black dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-black transition-colors duration-200 px-1 text-black dark:text-white">
                        {learningIndex > 0 ? "Resume →" : "Start →"}
                        </span>
                    </div>
                </div>
            </div>

            {/* Revision Card */}
            <div 
                className={`border border-zinc-200 dark:border-zinc-800 p-6 bg-white dark:bg-zinc-950 shadow-md relative overflow-hidden group transition-all rounded-sm flex flex-col justify-between h-64 ${wordsLearnedCount > 0 ? 'cursor-pointer hover:-translate-y-1 hover:border-black dark:hover:border-white hover:shadow-xl' : 'opacity-60 cursor-not-allowed'}`} 
                onClick={wordsLearnedCount > 0 ? handleStartRevision : undefined}
            >
                <div>
                    <div className="absolute top-0 right-0 bg-zinc-200 dark:bg-zinc-800 text-black dark:text-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest">
                        Revision
                    </div>
                    <h3 className="text-2xl font-bold font-serif mb-2 text-black dark:text-white">
                        Full Review
                    </h3>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                        Test yourself on all {wordsLearnedCount} words you have learned so far.
                    </p>
                </div>
                
                <div>
                    <div className="flex items-center gap-3 mb-4">
                         <div className="text-4xl font-serif font-black text-black dark:text-white">
                             {wordsLearnedCount}
                         </div>
                         <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 leading-tight">
                             Words<br/>Learned
                         </div>
                    </div>

                    <div className="flex justify-end items-end">
                        <span className="text-sm font-bold border-b-2 border-zinc-300 dark:border-zinc-700 pb-0.5 group-hover:bg-black dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-black transition-colors duration-200 px-1 text-zinc-600 dark:text-zinc-300">
                        {wordsLearnedCount > 0 ? "Start Revision →" : "Learn words first"}
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 w-full max-w-md animate-slideUp" style={{ animationDelay: '0.3s' }}>
          <Button onClick={() => setView(AppView.MISTAKES)} variant="secondary" fullWidth className="h-14 text-lg">
             My Mistakes ({Object.keys(user?.mistakes || {}).length})
          </Button>
        </div>

        <div className="flex flex-col md:flex-row gap-4 w-full max-w-md opacity-70 hover:opacity-100 transition-opacity animate-slideUp" style={{ animationDelay: '0.4s' }}>
          <Button onClick={handleStartLearn} fullWidth variant="outline">
            Browse Groups
          </Button>
          <Button onClick={handleStartTest} variant="outline" fullWidth>
            Quick Test
          </Button>
        </div>
      </div>
    );
  };

  const renderGroupSelection = (mode: 'learn' | 'quiz') => (
    <div className="animate-fadeIn">
      <div className="mb-8">
        <h2 className="text-3xl md:text-4xl font-serif font-bold mb-2">
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

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-black dark:text-white px-4 md:px-8 font-sans selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black transition-colors duration-300 relative">
      <div className="max-w-5xl mx-auto">
        {renderHeader()}
        
        <main className="pb-10">
          {view === AppView.HOME && renderHome()}
          {view === AppView.GROUP_SELECT_LEARN && renderGroupSelection('learn')}
          {view === AppView.GROUP_SELECT_QUIZ && renderGroupSelection('quiz')}
          {view === AppView.LEARN_MODE && renderLearnMode()}
          {view === AppView.QUIZ_MODE && renderQuizMode()}
          {view === AppView.MISTAKES && renderMistakes()}
          {view === AppView.GUIDED_LEARNING && (
             <GuidedLearning 
                initialIndex={learningIndex} 
                learnedWordsIds={learnedWords}
                onWordComplete={handleWordComplete}
                onMistake={handleMistake}
                onExit={goHome}
             />
          )}
        </main>
      </div>

      {/* Ask AI Context Menu */}
      {aiPopupPosition && selectedText && (
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
              
              {/* Arrow */}
              <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-black dark:bg-white rotate-45"></div>
          </div>
      )}
    </div>
  );
};

export default App;
