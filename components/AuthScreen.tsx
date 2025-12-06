
import React, { useState, useEffect } from 'react';
import { signIn, signUp, getConnectionStatus } from '../services/authService';
import { UserProfile } from '../types';
import Logo from './Logo';
import Button from './Button';
import ThemeToggle from './ThemeToggle';

interface AuthScreenProps {
    onAuthSuccess: (user: UserProfile) => void;
}

const EyeIcon = ({ visible }: { visible: boolean }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-zinc-400">
        {visible ? (
            <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
        ) : (
            <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" /> 
        )}
        {visible ? (
            <path fillRule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 010-1.113zM17.25 12a5.25 5.25 0 11-10.5 0 5.25 5.25 0 0110.5 0z" clipRule="evenodd" />
        ) : (
            <path d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06l-18-18zM22.676 12.553a11.249 11.249 0 01-2.631 4.31l-3.099-3.099a5.25 5.25 0 00-6.71-6.71L7.759 4.577a11.217 11.217 0 014.242-.827c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113z" />
        )}
        {!visible && (
             <path d="M4.478 7.658A11.242 11.242 0 001.323 11.447c.12.362.12.752 0 1.113 1.258 3.784 4.542 6.55 8.52 7.502l-5.365-5.365a5.242 5.242 0 010-7.037z" />
        )}
    </svg>
);

const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isOnline, setIsOnline] = useState(false);

    useEffect(() => {
        setIsOnline(getConnectionStatus());
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        
        if (isSignUp) {
            if (password !== confirmPassword) {
                setError("Passwords do not match.");
                return;
            }
            if (password.length < 4) {
                setError("Password must be at least 4 characters.");
                return;
            }
        }

        setLoading(true);

        try {
            let user;
            if (isSignUp) {
                user = await signUp(username, password);
            } else {
                user = await signIn(username, password);
            }
            onAuthSuccess(user);
        } catch (err: any) {
            setError(err?.toString() || "Authentication failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-zinc-950 px-4 animate-fadeIn transition-colors relative">
            
            <div className="absolute top-4 right-4">
                <ThemeToggle />
            </div>

            <div className="mb-10 scale-125">
                <Logo className="dark:text-white" />
            </div>

            <div className="w-full max-w-sm border border-black dark:border-zinc-700 p-8 shadow-2xl bg-white dark:bg-zinc-900 rounded-sm relative">
                <div className="flex mb-8 border-b border-zinc-100 dark:border-zinc-800">
                    <button 
                        className={`flex-1 pb-4 text-sm font-bold uppercase tracking-widest transition-colors ${!isSignUp ? 'border-b-2 border-black dark:border-white text-black dark:text-white' : 'text-zinc-400 dark:text-zinc-500'}`}
                        onClick={() => { setIsSignUp(false); setError(''); setPassword(''); setConfirmPassword(''); }}
                    >
                        Sign In
                    </button>
                    <button 
                        className={`flex-1 pb-4 text-sm font-bold uppercase tracking-widest transition-colors ${isSignUp ? 'border-b-2 border-black dark:border-white text-black dark:text-white' : 'text-zinc-400 dark:text-zinc-500'}`}
                        onClick={() => { setIsSignUp(true); setError(''); setPassword(''); }}
                    >
                        Sign Up
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">
                            Username
                        </label>
                        <input 
                            type="text" 
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-black dark:text-white p-3 outline-none focus:border-black dark:focus:border-white transition-colors"
                            placeholder="Enter username"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">
                            Password
                        </label>
                        <div className="relative">
                            <input 
                                type={showPassword ? "text" : "password"}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-black dark:text-white p-3 outline-none focus:border-black dark:focus:border-white transition-colors pr-10"
                                placeholder="Enter password"
                            />
                            <button 
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70"
                                tabIndex={-1}
                            >
                                <EyeIcon visible={showPassword} />
                            </button>
                        </div>
                    </div>

                    {isSignUp && (
                        <div className="animate-fadeIn">
                            <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">
                                Confirm Password
                            </label>
                            <div className="relative">
                                <input 
                                    type={showPassword ? "text" : "password"} 
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-black dark:text-white p-3 outline-none focus:border-black dark:focus:border-white transition-colors pr-10"
                                    placeholder="Re-enter password"
                                />
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="text-red-600 dark:text-red-400 text-xs font-medium p-2 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30">
                            {error}
                        </div>
                    )}

                    <Button fullWidth disabled={loading} type="submit" className="h-12 mt-4">
                        {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
                    </Button>
                </form>
            </div>
            
            <div className="mt-8 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}></div>
                <span className="text-xs text-zinc-400 font-medium">
                    {isOnline ? 'Cloud Sync Active' : 'Offline Mode (Local Storage)'}
                </span>
            </div>
        </div>
    );
};

export default AuthScreen;
