import React from 'react';

const Logo: React.FC<{ className?: string }> = ({ className = "" }) => {
  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <div className="relative text-black dark:text-white">
        {/* Modern Open Book / Abstract Icon */}
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-black dark:bg-white rounded-full border-2 border-white dark:border-zinc-950"></div>
      </div>
      <div className="flex flex-col justify-center h-8">
          <span className="text-xl font-serif font-black tracking-tighter leading-none">
            GX VOCAB
          </span>
      </div>
    </div>
  );
};

export default Logo;