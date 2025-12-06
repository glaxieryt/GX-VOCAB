
import React, { useState } from 'react';
import { signIn, signUp } from '../services/authService';
import { UserProfile } from '../types';
import Logo from './Logo';
import Button from './Button';

interface AuthScreenProps {
    onAuthSuccess: (user: UserProfile) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        
        // Validation
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
        <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4 animate-fadeIn">
            <div className="mb-10 scale-125">
                <Logo />
            </div>

            <div className="w-full max-w-sm border border-black p-8 shadow-2xl bg-white">
                <div className="flex mb-8 border-b border-zinc-100">
                    <button 
                        className={`flex-1 pb-4 text-sm font-bold uppercase tracking-widest transition-colors ${!isSignUp ? 'border-b-2 border-black text-black' : 'text-zinc-400'}`}
                        onClick={() => { setIsSignUp(false); setError(''); setPassword(''); setConfirmPassword(''); }}
                    >
                        Sign In
                    </button>
                    <button 
                        className={`flex-1 pb-4 text-sm font-bold uppercase tracking-widest transition-colors ${isSignUp ? 'border-b-2 border-black text-black' : 'text-zinc-400'}`}
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
                            className="w-full border border-zinc-200 p-3 outline-none focus:border-black transition-colors"
                            placeholder="Enter username"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">
                            Password
                        </label>
                        <input 
                            type="password" 
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full border border-zinc-200 p-3 outline-none focus:border-black transition-colors"
                            placeholder="Enter password"
                        />
                    </div>

                    {isSignUp && (
                        <div className="animate-fadeIn">
                            <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">
                                Confirm Password
                            </label>
                            <input 
                                type="password" 
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full border border-zinc-200 p-3 outline-none focus:border-black transition-colors"
                                placeholder="Re-enter password"
                            />
                        </div>
                    )}

                    {error && (
                        <div className="text-red-600 text-xs font-medium p-2 bg-red-50 border border-red-100">
                            {error}
                        </div>
                    )}

                    <Button fullWidth disabled={loading} type="submit" className="h-12 mt-4">
                        {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
                    </Button>
                </form>
            </div>
            
            <p className="mt-8 text-zinc-400 text-xs text-center max-w-xs leading-relaxed">
                {isSignUp 
                    ? "Your progress is saved securely. Remember your password!" 
                    : "Welcome back. Log in to continue your mastery."}
            </p>
        </div>
    );
};

export default AuthScreen;
