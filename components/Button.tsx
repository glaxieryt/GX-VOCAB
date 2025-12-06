import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  className = '', 
  ...props 
}) => {
  const baseStyles = "py-3 px-6 text-sm font-semibold tracking-wide transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-sm";
  
  // Updated variants for Dark Mode support
  const variants = {
    primary: "bg-black text-white hover:bg-zinc-800 border border-black dark:bg-white dark:text-black dark:hover:bg-zinc-200 dark:border-white",
    secondary: "bg-zinc-100 text-black hover:bg-zinc-200 border border-zinc-200 dark:bg-zinc-800 dark:text-white dark:border-zinc-700 dark:hover:bg-zinc-700",
    outline: "bg-transparent text-black border border-black hover:bg-black hover:text-white dark:text-white dark:border-white dark:hover:bg-white dark:hover:text-black"
  };

  const width = fullWidth ? "w-full" : "";

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${width} ${className}`} 
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;