
import React, { useState } from 'react';
import Button from './Button';

const SequenceSeries: React.FC<{ onExit: () => void }> = ({ onExit }) => {
    const [tab, setTab] = useState<'AP' | 'GP' | 'MEANS' | 'TRICKS'>('AP');
    
    // Calculator States
    const [dCalc, setDCalc] = useState({ farVal: '', farPos: '', closeVal: '', closePos: '', result: '' });
    const [recDecimal, setRecDecimal] = useState({ input: '', result: '' });
    const [infSum, setInfSum] = useState({ a: '', r: '', result: '' });

    // Drill State
    const [drillQuestion, setDrillQuestion] = useState<{ q: string, a: string } | null>(null);
    const [userAnswer, setUserAnswer] = useState('');
    const [drillFeedback, setDrillFeedback] = useState('');

    // --- LOGIC: CHEAT CODES ---

    const calculateD = () => {
        const d = (Number(dCalc.farVal) - Number(dCalc.closeVal)) / (Number(dCalc.farPos) - Number(dCalc.closePos));
        setDCalc(prev => ({ ...prev, result: isNaN(d) ? "Invalid Input" : `d = ${d}` }));
    };

    const parseRecurring = () => {
        // Input format: 1.4(23) or 1.423...
        // Simplified Logic for 1.4(23) where () denotes repeating
        try {
            const input = recDecimal.input;
            if (!input.includes('(') || !input.includes(')')) {
                setRecDecimal(prev => ({ ...prev, result: "Use format: 1.4(23)" }));
                return;
            }

            const [integerPart, decimalPart] = input.split('.');
            const [nonRepeating, repeating] = decimalPart.split('(');
            const repeatingClean = repeating.replace(')', '');

            const numeratorFull = parseInt(integerPart + nonRepeating + repeatingClean);
            const numeratorSub = parseInt(integerPart + nonRepeating);
            const numerator = numeratorFull - numeratorSub;

            const nines = '9'.repeat(repeatingClean.length);
            const zeros = '0'.repeat(nonRepeating.length);
            const denominator = parseInt(nines + zeros);

            setRecDecimal(prev => ({ ...prev, result: `${numerator} / ${denominator}` }));
        } catch (e) {
            setRecDecimal(prev => ({ ...prev, result: "Error parsing" }));
        }
    };

    const checkInfiniteSum = () => {
        const a = Number(infSum.a);
        const r = Number(infSum.r);
        
        if (Math.abs(r) >= 1) {
            setInfSum(prev => ({ ...prev, result: "DIVERGENT - NO SUM (|r| ≥ 1)" }));
        } else {
            const sum = a / (1 - r);
            setInfSum(prev => ({ ...prev, result: `Sum = ${sum.toFixed(4)}` }));
        }
    };

    // --- LOGIC: DRILL GENERATOR ---

    const generateDrill = () => {
        const type = Math.floor(Math.random() * 5); // 0-4
        let q = "", a = "";

        if (type === 0) { // AP Drill
            const d = Math.floor(Math.random() * 5) + 2;
            const start = Math.floor(Math.random() * 10) + 1;
            const t3 = start + 2*d;
            const t8 = start + 7*d;
            const t20 = start + 19*d;
            q = `AP: If T3 = ${t3} and T8 = ${t8}, find T20.`;
            a = t20.toString();
        } else if (type === 1) { // Sum Drill (Divisibility)
            const div = Math.floor(Math.random() * 5) + 3; // 3 to 7
            const rangeStart = Math.floor(Math.random() * 100) + 100;
            const rangeEnd = rangeStart + Math.floor(Math.random() * 500) + 100;
            
            // Calc logic for answer
            let first = rangeStart;
            while (first % div !== 0) first++;
            let last = rangeEnd;
            while (last % div !== 0) last--;
            
            const count = Math.floor((last - first) / div) + 1;
            q = `How many numbers between ${rangeStart} and ${rangeEnd} are divisible by ${div}?`;
            a = count.toString();
        } else if (type === 2) { // Trap Drill
            q = `Find sum of GP: a=5, r=1, n=10.`;
            a = "50"; // AP formula n*a
        } else if (type === 3) { // Decimal Drill
            const num = Math.floor(Math.random() * 9);
            const rep = Math.floor(Math.random() * 9);
            q = `Convert 0.${num}(${rep}) to fraction (e.g. 12/90).`;
            // 0.xy... -> xy - x / 90
            const top = parseInt(`${num}${rep}`) - num;
            const bot = 90;
            a = `${top}/${bot}`;
        } else { // Relation Drill
            // G^2 = AH
            const A = [4, 9, 16][Math.floor(Math.random() * 3)];
            const H = [1, 4, 9][Math.floor(Math.random() * 3)];
            const G = Math.sqrt(A * H);
            q = `If A (AM) = ${A} and H (HM) = ${H}, find G (GM).`;
            a = G.toString();
        }

        setDrillQuestion({ q, a });
        setUserAnswer('');
        setDrillFeedback('');
    };

    const checkDrill = () => {
        if (!drillQuestion) return;
        if (userAnswer.trim() === drillQuestion.a) {
            setDrillFeedback("✅ CORRECT! Shortcut Mastery +1");
        } else {
            setDrillFeedback(`❌ Incorrect. Ans: ${drillQuestion.a}`);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 font-sans p-6 overflow-y-auto pb-20">
            {/* Header */}
            <div className="max-w-6xl mx-auto flex justify-between items-center mb-8 border-b border-red-900/50 pb-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-red-600">MATHFLIX</h1>
                    <p className="text-gray-400 text-sm tracking-widest uppercase">Sequence & Series Master</p>
                </div>
                <Button variant="outline" className="border-red-600 text-red-500 hover:bg-red-900/20" onClick={onExit}>Exit Station</Button>
            </div>

            {/* Theory Tabs */}
            <div className="max-w-6xl mx-auto flex gap-2 mb-8 overflow-x-auto pb-2">
                {['AP', 'GP', 'MEANS', 'TRICKS'].map(t => (
                    <button 
                        key={t}
                        onClick={() => setTab(t as any)}
                        className={`px-6 py-2 rounded-sm font-bold tracking-wider transition-all ${tab === t ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                    >
                        {t}
                    </button>
                ))}
            </div>

            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* LEFT: Knowledge Base (Dynamic based on Tab) */}
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 shadow-2xl">
                    <h2 className="text-2xl font-bold text-white mb-6 border-l-4 border-red-600 pl-4">{tab} PROTOCOLS</h2>
                    
                    <div className="space-y-6 text-gray-300">
                        {tab === 'AP' && (
                            <>
                                <div className="p-4 bg-gray-900 rounded">
                                    <strong className="text-red-400 block mb-2">General Term (Tn)</strong>
                                    <p className="font-mono text-lg">Tn = a + (n-1)d</p>
                                </div>
                                <div className="p-4 bg-gray-900 rounded">
                                    <strong className="text-emerald-400 block mb-2">CHEAT CODE #1: The Two-Term Trick</strong>
                                    <p className="text-sm mb-2">Find 'd' instantly given any two terms:</p>
                                    <p className="font-mono text-yellow-400 bg-black/50 p-2 rounded">d = (Val_Far - Val_Close) / (Pos_Far - Pos_Close)</p>
                                </div>
                                <div className="p-4 bg-gray-900 rounded">
                                    <strong className="text-red-400 block mb-2">Sum (Sn)</strong>
                                    <p className="font-mono">Sn = n/2 * [2a + (n-1)d]</p>
                                    <p className="text-sm mt-2 text-gray-500">Shortcut: If n is odd, Sn = n * Middle_Term</p>
                                </div>
                            </>
                        )}

                        {tab === 'GP' && (
                            <>
                                <div className="p-4 bg-gray-900 rounded">
                                    <strong className="text-red-400 block mb-2">General Term (Tn)</strong>
                                    <p className="font-mono text-lg">Tn = a * r^(n-1)</p>
                                </div>
                                <div className="p-4 bg-gray-900 rounded">
                                    <strong className="text-emerald-400 block mb-2">CHEAT CODE #5: Ratio Root</strong>
                                    <p className="font-mono text-yellow-400 bg-black/50 p-2 rounded">r = (Val_Far / Val_Close) ^ (1 / Diff_in_Pos)</p>
                                </div>
                                <div className="p-4 bg-gray-900 rounded border border-red-900/50">
                                    <strong className="text-red-500 block mb-2">CRITICAL TRAP</strong>
                                    <p>If r = 1, it is NOT a GP formula.</p>
                                    <p className="font-mono">Sum = n * a</p>
                                </div>
                            </>
                        )}

                        {tab === 'MEANS' && (
                            <>
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="p-2 bg-gray-900 rounded"><div className="text-red-400 font-bold">AM</div>(a+b)/2</div>
                                    <div className="p-2 bg-gray-900 rounded"><div className="text-blue-400 font-bold">GM</div>√ab</div>
                                    <div className="p-2 bg-gray-900 rounded"><div className="text-yellow-400 font-bold">HM</div>2ab/(a+b)</div>
                                </div>
                                <div className="p-4 bg-gray-900 rounded mt-4">
                                    <strong className="text-white block mb-2">The Golden Relation</strong>
                                    <p className="font-mono text-xl text-center">G² = A × H</p>
                                </div>
                                <div className="p-4 bg-gray-900 rounded">
                                    <strong className="text-white block mb-2">Inequality</strong>
                                    <p className="font-mono text-center">AM ≥ GM ≥ HM</p>
                                </div>
                            </>
                        )}

                        {tab === 'TRICKS' && (
                            <>
                                <div className="p-4 bg-gray-900 rounded">
                                    <strong className="text-emerald-400 block mb-2">Recurr. Decimal to Fraction</strong>
                                    <p className="text-sm">1. Numerator: FullNum - NonRepeatingPart</p>
                                    <p className="text-sm">2. Denom: 9s for repeating, 0s for non-repeating</p>
                                    <p className="font-mono mt-2 text-gray-500">Ex: 0.4(3) -> (43-4)/90 = 39/90</p>
                                </div>
                                <div className="p-4 bg-gray-900 rounded">
                                    <strong className="text-emerald-400 block mb-2">Ratio of Sums -> Ratio of Terms</strong>
                                    <p className="text-sm">Given ratio of Sn, find ratio of Tn?</p>
                                    <p className="font-mono text-yellow-400 bg-black/50 p-2 rounded mt-2">Replace 'n' with '2n - 1'</p>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* RIGHT: Tools & Practice */}
                <div className="space-y-8">
                    
                    {/* Feature 1: Cheat Calculator */}
                    <div className="bg-black p-6 rounded-lg border border-gray-800">
                        <h3 className="text-xl font-bold text-red-500 mb-4 uppercase">Cheat Code Tools</h3>
                        
                        <div className="grid grid-cols-1 gap-4">
                            {/* Tool A */}
                            <div className="bg-gray-900 p-3 rounded border border-gray-800">
                                <label className="text-xs text-gray-500 font-bold uppercase mb-2 block">Find 'd' Fast (AP)</label>
                                <div className="flex gap-2 mb-2">
                                    <input placeholder="T_Far Val" className="bg-black border border-gray-700 p-1 w-1/4 text-white text-xs" onChange={e => setDCalc({...dCalc, farVal: e.target.value})} />
                                    <input placeholder="Pos" className="bg-black border border-gray-700 p-1 w-1/4 text-white text-xs" onChange={e => setDCalc({...dCalc, farPos: e.target.value})} />
                                    <span className="text-gray-600">-</span>
                                    <input placeholder="T_Close Val" className="bg-black border border-gray-700 p-1 w-1/4 text-white text-xs" onChange={e => setDCalc({...dCalc, closeVal: e.target.value})} />
                                    <input placeholder="Pos" className="bg-black border border-gray-700 p-1 w-1/4 text-white text-xs" onChange={e => setDCalc({...dCalc, closePos: e.target.value})} />
                                </div>
                                <div className="flex justify-between items-center">
                                    <button onClick={calculateD} className="bg-gray-800 text-xs px-2 py-1 hover:text-white text-gray-400 rounded">Calc</button>
                                    <span className="text-emerald-400 font-mono font-bold">{dCalc.result}</span>
                                </div>
                            </div>

                            {/* Tool B */}
                            <div className="bg-gray-900 p-3 rounded border border-gray-800">
                                <label className="text-xs text-gray-500 font-bold uppercase mb-2 block">Recurring to Fraction</label>
                                <div className="flex gap-2 items-center">
                                    <input placeholder="e.g. 1.4(23)" className="bg-black border border-gray-700 p-1 flex-1 text-white text-xs" onChange={e => setRecDecimal({...recDecimal, input: e.target.value})} />
                                    <button onClick={parseRecurring} className="bg-gray-800 text-xs px-2 py-1 hover:text-white text-gray-400 rounded">Convert</button>
                                </div>
                                <div className="text-right mt-1 text-emerald-400 font-mono font-bold">{recDecimal.result}</div>
                            </div>
                        </div>
                    </div>

                    {/* Feature 2: Infinite Practice */}
                    <div className="bg-red-900/10 p-6 rounded-lg border border-red-900/30">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-white uppercase">Drill Station</h3>
                            <button onClick={generateDrill} className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1 rounded transition-colors shadow-lg shadow-red-900/20">
                                NEW PROBLEM
                            </button>
                        </div>

                        {drillQuestion ? (
                            <div className="space-y-4 animate-fadeIn">
                                <p className="text-lg font-mono text-gray-200 bg-black/40 p-4 rounded border-l-2 border-red-500">
                                    {drillQuestion.q}
                                </p>
                                <div className="flex gap-2">
                                    <input 
                                        value={userAnswer}
                                        onChange={e => setUserAnswer(e.target.value)}
                                        placeholder="Enter answer..."
                                        className="bg-gray-900 border border-gray-700 text-white p-3 rounded flex-1 outline-none focus:border-red-500 transition-colors"
                                        onKeyDown={e => e.key === 'Enter' && checkDrill()}
                                    />
                                    <button onClick={checkDrill} className="bg-white text-black font-bold px-6 rounded hover:bg-gray-200">
                                        CHECK
                                    </button>
                                </div>
                                {drillFeedback && (
                                    <div className={`p-2 rounded text-center font-bold ${drillFeedback.includes('✅') ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>
                                        {drillFeedback}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center text-gray-600 py-8">
                                Press "NEW PROBLEM" to start drilling.
                            </div>
                        )}
                    </div>

                </div>
            </div>
            
            <div className="text-center mt-12 text-gray-600 text-xs uppercase tracking-widest">
                Based on Chapter 1 Handwritten Notes
            </div>
        </div>
    );
};

export default SequenceSeries;
