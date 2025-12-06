
import React, { useState } from 'react';
import { Word } from '../types';
import { getEasyMeaning, getSentence, speakText } from '../services/geminiService';
import Button from './Button';

interface WordCardProps {
  word: Word;
}

const SpeakerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318 0-2.402.084C2.022 7.667 2 7.787 2 7.917v8.166c0 .13.022.25.106.333.084.084 1.261.084 2.402.084h1.932l4.5 4.5c.945.945 2.56.276 2.56-1.06V4.06zM18.53 12a4.48 4.48 0 00-1.782-3.582c-.39-.292-.936-.217-1.228.172-.292.39-.217.936.172 1.228a2.482 2.482 0 01.988 1.982c0 .822-.39 1.562-.988 2.182-.389.292-.464.838-.172 1.228.292.39.838.464 1.228.172A4.48 4.48 0 0018.53 12z" />
    <path d="M20.94 12c0-3.308-1.838-6.184-4.57-7.653-.408-.22-.916-.07-1.135.337-.22.407-.07.915.337 1.135 2.162 1.162 3.618 3.44 3.618 6.181 0 2.74-1.456 5.02-3.618 6.181-.407.22-.557.728-.337 1.135.22.407.727.557 1.135.337 2.732-1.469 4.57-4.345 4.57-7.653z" />
  </svg>
);

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

  const handlePronounce = (e: React.MouseEvent) => {
      e.stopPropagation();
      speakText(word.term);
  };

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
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-bold font-serif tracking-tight group-hover:underline decoration-1 underline-offset-4">
              {word.term}
              </h3>
              <button 
                onClick={handlePronounce}
                className="text-zinc-400 hover:text-black transition-colors p-1 rounded-full hover:bg-zinc-200"
                title="Pronounce"
              >
                 <SpeakerIcon />
              </button>
            </div>
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
