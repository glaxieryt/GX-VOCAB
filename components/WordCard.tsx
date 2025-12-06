
import React, { useState } from 'react';
import { Word } from '../types';
import { getEasyMeaning, getSentence } from '../services/geminiService';
import Button from './Button';

interface WordCardProps {
  word: Word;
}

const WordCard: React.FC<WordCardProps> = ({ word }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [easyMeaning, setEasyMeaning] = useState<string | null>(null);
  const [generatedSentence, setGeneratedSentence] = useState<string | null>(null);
  const [loadingMnemonic, setLoadingMnemonic] = useState(false);
  const [loadingSentence, setLoadingSentence] = useState(false);

  const handleFetchEasyMeaning = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (easyMeaning) return;
    setLoadingMnemonic(true);
    const result = await getEasyMeaning(word.term, word.meaning);
    setEasyMeaning(result);
    setLoadingMnemonic(false);
  };

  const handleFetchSentence = async () => {
      if (word.sentence || generatedSentence) return;
      setLoadingSentence(true);
      const res = await getSentence(word.term, word.meaning);
      setGeneratedSentence(res);
      setLoadingSentence(false);
  }

  // Auto fetch sentence on open if missing? Maybe better to let user click or just fetch.
  // Let's adding a "Show Sentence" button if missing, or fetch automatically if desired.
  // User asked for "add a simple sentence... under each word".
  // To make it feel seamless, we can try to fetch on open if we have an API key.
  React.useEffect(() => {
      if (isOpen && !word.sentence && !generatedSentence && !loadingSentence) {
          handleFetchSentence();
      }
  }, [isOpen]);

  const displaySentence = word.sentence || generatedSentence;

  return (
    <div 
      className={`border-b border-zinc-200 py-4 transition-all duration-300 ${isOpen ? 'bg-zinc-50 -mx-4 px-4' : ''}`}
    >
      <div 
        className="flex justify-between items-center cursor-pointer group" 
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex flex-col">
            <h3 className="text-xl font-bold font-serif tracking-tight group-hover:underline decoration-1 underline-offset-4">
            {word.term}
            </h3>
            {/* Show category tag if open */}
            {isOpen && word.category && (
                <span className="text-[10px] uppercase font-bold text-zinc-400 mt-1 tracking-wider">{word.category}</span>
            )}
        </div>
        <span className={`text-2xl font-light text-zinc-400 transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`}>
          +
        </span>
      </div>

      {isOpen && (
        <div className="mt-4 text-zinc-800 space-y-6 animate-fadeIn">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Definition</span>
            <p className="text-lg leading-relaxed">{word.meaning}</p>
          </div>

          <div>
             <span className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Usage</span>
             {displaySentence ? (
                 <p className="text-md italic text-zinc-600 border-l-2 border-zinc-300 pl-4">"{displaySentence}"</p>
             ) : (
                 <div className="text-zinc-400 text-sm italic">
                     {loadingSentence ? "Generating example..." : "No example available."}
                 </div>
             )}
          </div>

          <div className="pt-2">
            {!easyMeaning ? (
              <Button 
                variant="outline" 
                onClick={handleFetchEasyMeaning} 
                disabled={loadingMnemonic}
                className="text-xs py-2 px-4"
              >
                {loadingMnemonic ? "Asking AI..." : "Get AI Mnemonic"}
              </Button>
            ) : (
              <div className="bg-white border border-zinc-200 p-4 relative mt-2">
                <span className="absolute -top-2 left-3 bg-white px-1 text-xs font-bold uppercase tracking-widest text-zinc-500">
                  Easy To Remember
                </span>
                <p className="text-zinc-700 font-medium">{easyMeaning}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WordCard;
