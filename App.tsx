import React, { useState, useMemo, useEffect } from 'react';
import { WordGroup, AppView } from './types';
import { getGroupedData, allWords } from './data';
import Button from './components/Button';
import WordCard from './components/WordCard';
import Quiz from './components/Quiz';
import GuidedLearning from './components/GuidedLearning';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.HOME);
  const [selectedGroup, setSelectedGroup] = useState<WordGroup | null>(null);
  const [quizResult, setQuizResult] = useState<{score: number, total: number} | null>(null);

  // Learning Progress State
  const [learningIndex, setLearningIndex] = useState(0);
  const [learnedWords, setLearnedWords] = useState<string[]>([]);
  
  // New: Loading state to prevent "White Screen" during hydration
  const [isHydrated, setIsHydrated] = useState(false);

  // Load progress from local storage on mount safely
  useEffect(() => {
    try {
      const savedIndex = localStorage?.getItem('gx_learning_index');
      const savedLearned = localStorage?.getItem('gx_learned_words');
      
      if (savedIndex) {
        setLearningIndex(parseInt(savedIndex, 10) || 0);
      }
      
      if (savedLearned) {
        setLearnedWords(JSON.parse(savedLearned) || []);
      }
    } catch (error) {
      console.error("Failed to load progress:", error);
      // Fallback to default state if storage is corrupt
      setLearningIndex(0);
      setLearnedWords([]);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  const saveProgress = (index: number, learned: string[]) => {
     try {
       localStorage?.setItem('gx_learning_index', index.toString());
       localStorage?.setItem('gx_learned_words', JSON.stringify(learned));
     } catch (e) {
       console.error("Save failed", e);
     }
  };

  const handleWordComplete = (wordId: string) => {
      const newIndex = learningIndex + 1;
      const newLearned = [...(learnedWords || []), wordId];
      setLearningIndex(newIndex);
      setLearnedWords(newLearned);
      saveProgress(newIndex, newLearned);
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
    <header className="border-b border-black py-6 mb-8 flex justify-between items-center bg-white sticky top-0 z-30 px-4 md:px-0">
      <h1 
        className="text-2xl font-serif font-black tracking-tighter cursor-pointer"
        onClick={goHome}
      >
        GX VOCAB
      </h1>
      {view !== AppView.HOME && (
        <button 
          onClick={goHome}
          className="text-xs font-bold uppercase tracking-widest hover:underline"
        >
          Home
        </button>
      )}
    </header>
  );

  const renderHome = () => {
    // Calculate progress percentage safely
    const totalWords = allWords?.length || 1500;
    const progressPercent = Math.min(((learningIndex || 0) / totalWords) * 100, 100);

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-12 animate-fadeIn">
        <div className="text-center space-y-4">
          <h2 className="text-6xl md:text-8xl font-serif font-medium tracking-tight">Master Words</h2>
          <p className="text-zinc-500 max-w-md mx-auto text-lg font-light">
            Expand your vocabulary with grouped learning and AI-assisted mnemonics.
          </p>
        </div>
        
        {/* Daily Lesson Card */}
        <div className="w-full max-w-md border border-black p-6 bg-zinc-50 shadow-lg relative overflow-hidden group cursor-pointer" onClick={handleStartGuided}>
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
                    className="h-full bg-black" 
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

        <div className="flex flex-col md:flex-row gap-6 w-full max-w-md">
          <Button onClick={handleStartLearn} fullWidth className="h-16 text-lg" variant="secondary">
            Browse Groups
          </Button>
          <Button onClick={handleStartTest} variant="outline" fullWidth className="h-16 text-lg">
            Take a Test
          </Button>
        </div>
      </div>
    );
  };

  const renderGroupSelection = (mode: 'learn' | 'quiz') => (
    <div className="animate-fadeIn">
      <div className="mb-8">
        <h2 className="text-4xl font-serif font-bold mb-2">
          {mode === 'learn' ? 'Select a Group to Learn' : 'Select a Group to Test'}
        </h2>
        <p className="text-zinc-500">
          Vocabulary is divided into manageable sets of 30 words.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {groups?.map((group) => (
          <button
            key={group.id}
            onClick={() => handleGroupSelect(group)}
            className="group border border-zinc-200 p-8 text-left hover:border-black hover:bg-zinc-50 transition-all duration-300"
          >
            <span className="text-xs font-bold uppercase text-zinc-400 mb-2 block tracking-widest">
              Set {group.id.toString().padStart(2, '0')}
            </span>
            <h3 className="text-xl font-semibold group-hover:translate-x-1 transition-transform">
              {group.label}
            </h3>
            <p className="text-zinc-400 mt-2 text-sm">{group.words?.length || 0} words</p>
          </button>
        ))}
      </div>
    </div>
  );

  const renderLearnMode = () => (
    <div className="max-w-2xl mx-auto animate-fadeIn pb-20">
      <div className="mb-10 border-b border-black pb-4">
        <button 
          onClick={() => setView(AppView.GROUP_SELECT_LEARN)}
          className="text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-black mb-2 block"
        >
          ← Back to Groups
        </button>
        <h2 className="text-4xl font-serif font-bold">{selectedGroup?.label}</h2>
        <p className="text-zinc-500 mt-2">Click a word to reveal its meaning.</p>
      </div>

      <div className="space-y-2">
        {selectedGroup?.words?.map((word) => (
          <WordCard key={word.id} word={word} />
        ))}
      </div>
      
      <div className="fixed bottom-6 right-6 z-20">
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
          <div className="flex gap-4">
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

  // Prevent rendering until local storage is checked to avoid flashes or crashes
  if (!isHydrated) {
      return (
          <div className="min-h-screen bg-white flex items-center justify-center">
               <div className="w-8 h-8 border-4 border-zinc-200 border-t-black rounded-full animate-spin"></div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-white text-black px-4 md:px-8 font-sans selection:bg-black selection:text-white">
      <div className="max-w-5xl mx-auto">
        {renderHeader()}
        
        <main>
          {view === AppView.HOME && renderHome()}
          {view === AppView.GROUP_SELECT_LEARN && renderGroupSelection('learn')}
          {view === AppView.GROUP_SELECT_QUIZ && renderGroupSelection('quiz')}
          {view === AppView.LEARN_MODE && renderLearnMode()}
          {view === AppView.QUIZ_MODE && renderQuizMode()}
          {view === AppView.GUIDED_LEARNING && (
             <GuidedLearning 
                initialIndex={learningIndex} 
                learnedWordsIds={learnedWords}
                onWordComplete={handleWordComplete}
                onExit={goHome}
             />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;