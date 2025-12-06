
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

  // Check for existing session on mount
  useEffect(() => {
    const session = getCurrentSession();
    if (session) {
        setUser(session);
        setLearningIndex(session.learningIndex);
        setLearnedWords(session.learnedWords);
    }
    setCheckingSession(false);
  }, []);

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
          // Update local state to reflect new mistake count immediately if in Mistakes view
          setUser(prev => {
              if(!prev) return null;
              const newMistakes = { ...prev.mistakes };
              newMistakes[wordId] = (newMistakes[wordId] || 0) + 1;
              return { ...prev, mistakes: newMistakes };
          });
      }
  };

  const handleResetProgress = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the card click
    if (window.confirm("Are you sure you want to reset your progress to zero? This cannot be undone.")) {
      setLearningIndex(0);
      setLearnedWords([]);
      saveProgress(0, []);
    }
  };

  // Memoize grouped data
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
    <header className="border-b border-black py-5 mb-8 flex justify-between items-center bg-white sticky top-0 z-30 px-4 md:px-0">
      <div onClick={goHome} className="cursor-pointer hover:opacity-80 transition-opacity">
        <Logo />
      </div>
      <div className="flex items-center gap-4">
          <span className="hidden md:block text-xs font-bold uppercase tracking-widest text-zinc-400">
             {user?.username}
          </span>
          {view !== AppView.HOME && (
            <button 
              onClick={goHome}
              className="text-xs font-bold uppercase tracking-widest hover:underline"
            >
              Home
            </button>
          )}
          <button 
             onClick={handleSignOut}
             className="text-xs font-bold uppercase tracking-widest text-red-600 hover:text-red-800"
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
          <div className="animate-fadeIn pb-20">
              <div className="mb-8">
                <h2 className="text-4xl font-serif font-bold mb-2">My Mistakes</h2>
                <p className="text-zinc-500">Words you have struggled with.</p>
              </div>
              
              {mistakeList.length === 0 ? (
                  <div className="text-center py-20 bg-zinc-50 border border-dashed border-zinc-300">
                      <p className="text-xl text-zinc-400 font-serif">You haven't made any mistakes yet.</p>
                      <p className="text-sm text-zinc-400 mt-2">Keep learning!</p>
                  </div>
              ) : (
                  <div className="space-y-4">
                      {mistakeList.map((item) => (
                          <div key={item!.id} className="border border-red-100 bg-red-50/30 p-4 flex justify-between items-center">
                              <div>
                                  <div className="flex items-center gap-2">
                                      <h3 className="text-lg font-bold font-serif">{item!.term}</h3>
                                      <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold">
                                          Missed {item!.count}x
                                      </span>
                                  </div>
                                  <p className="text-zinc-600 mt-1">{item!.meaning}</p>
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      );
  };

  const renderHome = () => {
    // Calculate progress percentage safely
    const totalWords = allWords?.length || 1500;
    const progressPercent = Math.min(((learningIndex || 0) / totalWords) * 100, 100);

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-12 animate-fadeIn pb-12">
        <div className="text-center space-y-4 px-4">
          <h2 className="text-5xl md:text-8xl font-serif font-medium tracking-tight">Master Words</h2>
          <p className="text-zinc-500 max-w-md mx-auto text-lg font-light">
            Expand your vocabulary with grouped learning and AI-assisted mnemonics.
          </p>
        </div>
        
        {/* Daily Lesson Card */}
        <div className="w-full max-w-md border border-black p-6 bg-zinc-50 shadow-lg relative overflow-hidden group cursor-pointer transition-transform hover:-translate-y-1" onClick={handleStartGuided}>
            <div className="absolute top-0 right-0 bg-black text-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest">
                Guided Path
            </div>
            <h3 className="text-2xl font-bold font-serif mb-2">
                {learningIndex > 0 ? "Continue Learning" : "Start Daily Lesson"}
            </h3>
            <p className="text-zinc-500 mb-6 text-sm">Progressive difficulty with spaced repetition.</p>
            
            <div className="flex justify-between text-xs font-bold uppercase tracking-widest mb-2 text-zinc-400">
                <span>Progress</span>
                <span>{learningIndex} / {totalWords}</span>
            </div>
            <div className="h-2 bg-zinc-200 w-full rounded-full overflow-hidden">
                <div 
                    className="h-full bg-black transition-all duration-1000 ease-out" 
                    style={{ width: `${progressPercent}%` }} 
                />
            </div>
            <div className="mt-6 flex justify-between items-end">
                {learningIndex > 0 ? (
                    <button 
                      onClick={handleResetProgress}
                      className="text-xs text-zinc-400 hover:text-red-600 font-bold uppercase tracking-widest z-10 transition-colors"
                    >
                      Reset Progress
                    </button>
                ) : (
                    <div></div> // Spacer
                )}
                
                <span className="text-sm font-bold border-b-2 border-black pb-0.5 group-hover:bg-black group-hover:text-white transition-colors duration-200 px-1 ml-auto">
                   {learningIndex > 0 ? "Continue Lesson →" : "Start Learning →"}
                </span>
            </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 w-full max-w-md">
          <Button onClick={() => setView(AppView.MISTAKES)} variant="secondary" fullWidth className="h-14 text-lg">
             My Mistakes ({Object.keys(user?.mistakes || {}).length})
          </Button>
        </div>

        <div className="flex flex-col md:flex-row gap-4 w-full max-w-md opacity-70 hover:opacity-100 transition-opacity">
          <Button onClick={handleStartLearn} fullWidth variant="outline">
            Browse Groups
          </Button>
          <Button onClick={handleStartTest} variant="outline" fullWidth>
            Take a Test
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
        <p className="text-zinc-500">
          Vocabulary is divided into manageable sets of 30 words.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
        {groups?.map((group) => (
          <button
            key={group.id}
            onClick={() => handleGroupSelect(group)}
            className="group border border-zinc-200 p-6 text-left hover:border-black hover:bg-zinc-50 transition-all duration-300"
          >
            <span className="text-xs font-bold uppercase text-zinc-400 mb-2 block tracking-widest">
              Set {group.id.toString().padStart(2, '0')}
            </span>
            <h3 className="text-lg font-semibold group-hover:translate-x-1 transition-transform">
              {group.label}
            </h3>
            <p className="text-zinc-400 mt-2 text-sm">{group.words?.length || 0} words</p>
          </button>
        ))}
      </div>
    </div>
  );

  const renderLearnMode = () => (
    <div className="max-w-2xl mx-auto animate-fadeIn pb-24">
      <div className="mb-10 border-b border-black pb-4 sticky top-20 bg-white z-20 pt-4">
        <button 
          onClick={() => setView(AppView.GROUP_SELECT_LEARN)}
          className="text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-black mb-2 block"
        >
          ← Back to Groups
        </button>
        <h2 className="text-3xl font-serif font-bold">{selectedGroup?.label}</h2>
        <p className="text-zinc-500 mt-2 text-sm">Click a word to reveal its meaning.</p>
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
        <div className="flex flex-col items-center justify-center min-h-[50vh] animate-fadeIn text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Results</span>
          <h2 className="text-8xl font-serif font-bold mb-4">{percentage}%</h2>
          <p className="text-2xl mb-8">
            You got {quizResult.score} out of {quizResult.total} correct.
          </p>
          <div className="flex gap-4 flex-col md:flex-row">
            <Button onClick={() => setView(AppView.GROUP_SELECT_QUIZ)} variant="outline">
              Choose Another Group
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
        onExit={() => setView(AppView.GROUP_SELECT_QUIZ)}
      />
    );
  };

  // 1. Checking Session State
  if (checkingSession) {
      return (
          <div className="min-h-screen bg-white flex items-center justify-center">
               <div className="w-8 h-8 border-4 border-zinc-200 border-t-black rounded-full animate-spin"></div>
          </div>
      );
  }

  // 2. Auth State (Not Logged In)
  if (!user) {
      return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  // 3. Main App (Logged In)
  return (
    <div className="min-h-screen bg-white text-black px-4 md:px-8 font-sans selection:bg-black selection:text-white">
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
    </div>
  );
};

export default App;
