
import React, { useState } from 'react';
import { MathView, MathTopic, DifficultyLevel, MathProblem } from '../types';
import { generateProblem } from '../services/mathService';

// --- PROFESSIONAL UI COMPONENTS ---

const PButton: React.FC<{
    children: React.ReactNode;
    onClick?: () => void;
    variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
    className?: string;
    fullWidth?: boolean;
    disabled?: boolean;
}> = ({ children, onClick, variant = 'primary', className = '', fullWidth, disabled }) => {
    const base = "font-medium transition-all duration-200 rounded-md shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed";
    const variants = {
        primary: "bg-indigo-600 text-white hover:bg-indigo-700",
        secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
        success: "bg-emerald-500 text-white hover:bg-emerald-600",
        danger: "bg-rose-500 text-white hover:bg-rose-600",
        ghost: "bg-transparent text-slate-600 hover:bg-slate-100 shadow-none border-none"
    };
    
    const size = "px-4 py-2 text-sm"; // Standard size

    return (
        <button 
            onClick={onClick}
            disabled={disabled}
            className={`${base} ${variants[variant]} ${size} ${fullWidth ? 'w-full' : ''} ${className}`}
        >
            {children}
        </button>
    );
};

const PCard: React.FC<{
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    hover?: boolean;
}> = ({ children, className = '', onClick, hover }) => {
    return (
        <div 
            onClick={onClick}
            className={`bg-white rounded-xl border border-slate-200 shadow-sm p-6 ${hover ? 'hover:shadow-md hover:border-indigo-200 cursor-pointer transition-all duration-300' : ''} ${className}`}
        >
            {children}
        </div>
    );
};

const ProgressBar: React.FC<{ progress: number; color?: string }> = ({ progress, color = 'bg-indigo-600' }) => (
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div 
            className={`h-full ${color} transition-all duration-500`} 
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} 
        />
    </div>
);

// --- VIEWS ---

const MathDashboard: React.FC<{ onSelectTopic: (topic: MathTopic) => void; onExit: () => void }> = ({ onSelectTopic, onExit }) => {
    return (
        <div className="max-w-6xl mx-auto p-6 animate-fadeIn pt-20">
            {/* Hero */}
            <div className="mb-10 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Math Learning Platform</h1>
                    <p className="text-slate-500">Master mathematics through structured practice.</p>
                </div>
                <PButton variant="secondary" onClick={onExit}>Exit to Home</PButton>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <PCard>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xl">🔥</div>
                        <div>
                            <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Current Streak</p>
                            <p className="text-2xl font-bold text-slate-900">0 Days</p>
                        </div>
                    </div>
                </PCard>
                <PCard>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold text-xl">✓</div>
                        <div>
                            <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Problems Solved</p>
                            <p className="text-2xl font-bold text-slate-900">0</p>
                        </div>
                    </div>
                </PCard>
                <PCard>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 font-bold text-xl">★</div>
                        <div>
                            <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Mastery Level</p>
                            <p className="text-2xl font-bold text-slate-900">Novice</p>
                        </div>
                    </div>
                </PCard>
            </div>

            {/* Learning Paths */}
            <h2 className="text-xl font-bold text-slate-800 mb-6">Learning Paths</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Multiplication */}
                <PCard hover onClick={() => onSelectTopic(MathTopic.MULTIPLICATION)} className="relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="text-9xl font-black text-indigo-900">×</span>
                    </div>
                    <div className="relative z-10">
                        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Multiplication Mastery</h3>
                        <p className="text-slate-500 text-sm mb-6 h-10">Build a solid foundation with times tables 1-20.</p>
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs font-semibold text-slate-500">
                                <span>Progress</span>
                                <span>0%</span>
                            </div>
                            <ProgressBar progress={0} />
                        </div>
                        <div className="mt-6 flex justify-end">
                            <span className="text-sm font-semibold text-indigo-600 group-hover:translate-x-1 transition-transform">Continue Learning →</span>
                        </div>
                    </div>
                </PCard>

                {/* Powers */}
                <PCard hover onClick={() => onSelectTopic(MathTopic.POWERS)} className="relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="text-9xl font-black text-emerald-900">n²</span>
                    </div>
                    <div className="relative z-10">
                        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 mb-4">
                            <span className="font-bold text-lg">x²</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Powers & Exponents</h3>
                        <p className="text-slate-500 text-sm mb-6 h-10">Understand squares, cubes, and exponential growth.</p>
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs font-semibold text-slate-500">
                                <span>Progress</span>
                                <span>0%</span>
                            </div>
                            <ProgressBar progress={0} color="bg-emerald-500" />
                        </div>
                        <div className="mt-6 flex justify-end">
                            <span className="text-sm font-semibold text-emerald-600 group-hover:translate-x-1 transition-transform">Start Learning →</span>
                        </div>
                    </div>
                </PCard>

                {/* Roots */}
                <PCard hover onClick={() => onSelectTopic(MathTopic.ROOTS)} className="relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="text-9xl font-black text-amber-900">√</span>
                    </div>
                    <div className="relative z-10">
                        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600 mb-4">
                            <span className="font-bold text-lg">√</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Roots & Radicals</h3>
                        <p className="text-slate-500 text-sm mb-6 h-10">Master square roots and cube roots calculation.</p>
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs font-semibold text-slate-500">
                                <span>Progress</span>
                                <span>0%</span>
                            </div>
                            <ProgressBar progress={0} color="bg-amber-500" />
                        </div>
                        <div className="mt-6 flex justify-end">
                            <span className="text-sm font-semibold text-amber-600 group-hover:translate-x-1 transition-transform">Start Learning →</span>
                        </div>
                    </div>
                </PCard>
            </div>
        </div>
    );
};

// --- PRACTICE MODE ---

const PracticeSession: React.FC<{ topic: MathTopic; onFinish: () => void; onEarnXP: (amount: number) => void }> = ({ topic, onFinish, onEarnXP }) => {
    const [difficulty, setDifficulty] = useState<DifficultyLevel>(DifficultyLevel.BEGINNER);
    const [questionIdx, setQuestionIdx] = useState(0);
    const [currentProblem, setCurrentProblem] = useState<MathProblem>(generateProblem(topic, DifficultyLevel.BEGINNER));
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [score, setScore] = useState(0);
    const [showHint, setShowHint] = useState(false);

    const handleNext = () => {
        if (questionIdx >= 9) { // 10 questions total
            onFinish();
            return;
        }
        
        // Adaptive Difficulty Logic
        let nextDiff = difficulty;
        if (isCorrect && !showHint && difficulty !== DifficultyLevel.EXPERT) {
             // Simple adaptive: Correct without hint -> potentially harder
             if (Math.random() > 0.5) {
                 if (difficulty === DifficultyLevel.BEGINNER) nextDiff = DifficultyLevel.INTERMEDIATE;
                 else if (difficulty === DifficultyLevel.INTERMEDIATE) nextDiff = DifficultyLevel.ADVANCED;
             }
        }

        setDifficulty(nextDiff);
        setCurrentProblem(generateProblem(topic, nextDiff));
        setQuestionIdx(prev => prev + 1);
        setSelectedOption(null);
        setIsAnswered(false);
        setShowHint(false);
    };

    const handleCheck = () => {
        if (selectedOption === null) return;
        const correct = selectedOption === currentProblem.correctAnswer;
        setIsCorrect(correct);
        if (correct) {
            setScore(prev => prev + 1);
            // Award 10 XP for correct answer
            onEarnXP(10);
        }
        setIsAnswered(true);
    };

    return (
        <div className="max-w-3xl mx-auto p-6 animate-fadeIn min-h-screen flex flex-col pt-24">
            <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                    <PButton onClick={onFinish} variant="ghost" className="text-slate-500 hover:text-slate-800">
                        ← Go Back
                    </PButton>
                    <div className="bg-slate-100 px-3 py-1 rounded-full text-xs font-bold text-slate-500 uppercase tracking-wide">
                        {topic} • {difficulty}
                    </div>
                </div>
                <div className="text-sm font-semibold text-slate-600">
                    {questionIdx + 1} / 10
                </div>
            </div>

            <div className="flex-1 flex flex-col justify-center">
                {/* Problem Card */}
                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 md:p-12 mb-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
                    
                    <h2 className="text-6xl font-mono font-bold text-slate-900 mb-8 tracking-tight">
                        {currentProblem.question}
                    </h2>

                    <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto">
                        {currentProblem.options.map((opt, idx) => {
                            let style = "border-2 border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50";
                            
                            if (isAnswered) {
                                if (opt === currentProblem.correctAnswer) style = "border-emerald-500 bg-emerald-50 text-emerald-700";
                                else if (opt === selectedOption) style = "border-rose-500 bg-rose-50 text-rose-700 opacity-50";
                                else style = "border-slate-100 text-slate-300";
                            } else if (selectedOption === opt) {
                                style = "border-indigo-600 bg-indigo-50 text-indigo-900 shadow-md transform scale-[1.02]";
                            }

                            return (
                                <button
                                    key={idx}
                                    onClick={() => !isAnswered && setSelectedOption(opt)}
                                    disabled={isAnswered}
                                    className={`p-6 rounded-xl text-2xl font-bold transition-all duration-200 ${style}`}
                                >
                                    {opt}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Feedback & Actions */}
                <div className="h-32">
                    {isAnswered ? (
                        <div className="animate-slideUp">
                            <div className={`p-4 rounded-lg mb-4 flex items-start gap-3 ${isCorrect ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
                                <div className="text-xl">{isCorrect ? '🎉' : '💡'}</div>
                                <div>
                                    <p className="font-bold">{isCorrect ? 'Excellent!' : 'Not quite.'}</p>
                                    <p className="text-sm opacity-90 mt-1">{currentProblem.explanation}</p>
                                </div>
                            </div>
                            <PButton fullWidth variant={isCorrect ? 'success' : 'primary'} onClick={handleNext}>
                                {questionIdx === 9 ? 'Finish Session' : 'Next Problem →'}
                            </PButton>
                        </div>
                    ) : (
                        <div className="flex gap-4">
                            <PButton 
                                variant="ghost" 
                                onClick={() => setShowHint(true)} 
                                disabled={showHint}
                                className="flex-1"
                            >
                                {showHint ? currentProblem.hint : "Need a Hint?"}
                            </PButton>
                            <PButton 
                                fullWidth 
                                onClick={handleCheck} 
                                disabled={selectedOption === null}
                                className="flex-[2]"
                            >
                                Check Answer
                            </PButton>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- MAIN CONTROLLER ---

const MathModule: React.FC<{ onExit: () => void; onEarnXP: (amount: number) => void }> = ({ onExit, onEarnXP }) => {
    const [view, setView] = useState<MathView>(MathView.DASHBOARD);
    const [topic, setTopic] = useState<MathTopic | null>(null);

    const handleSelectTopic = (t: MathTopic) => {
        setTopic(t);
        setView(MathView.PRACTICE);
    };

    if (view === MathView.PRACTICE && topic) {
        return <PracticeSession topic={topic} onFinish={() => setView(MathView.DASHBOARD)} onEarnXP={onEarnXP} />;
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
            <MathDashboard onSelectTopic={handleSelectTopic} onExit={onExit} />
        </div>
    );
};

export default MathModule;
