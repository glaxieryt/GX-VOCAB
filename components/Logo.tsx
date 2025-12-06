import React from 'react';

const Logo: React.FC<{ className?: string }> = ({ className = "" }) => {
  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      <div className="relative w-8 h-8 bg-black flex items-center justify-center overflow-hidden rounded-sm">
        <span className="text-white font-serif font-black italic text-lg leading-none translate-y-[1px] translate-x-[1px]">G</span>
        <span className="text-white font-sans font-black text-lg leading-none absolute top-0.5 right-0.5 opacity-50">x</span>
      </div>
      <span className="text-xl font-serif font-black tracking-tighter">
        GX VOCAB
      </span>
    </div>
  );
};

export default Logo;