
import { UserProfile } from '../types';

const USERS_KEY = 'gx_users_db';
const SESSION_KEY = 'gx_current_session';

// --- SUPABASE CONFIG ---
// Robustly check for keys in various environments (Vite local, Vercel build, Runtime)
const getEnvVar = (key: string, viteKey: string) => {
    // Check standard Vite import.meta.env
    // Cast to any to avoid TS errors if vite types aren't explicitly loaded in this context
    if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[viteKey]) {
        return (import.meta as any).env[viteKey];
    }
    // Check process.env (injected by define in vite.config.ts)
    if (typeof process !== 'undefined' && process.env) {
        return process.env[viteKey] || process.env[key];
    }
    return '';
};

const SUPABASE_URL = getEnvVar('SUPABASE_URL', 'VITE_SUPABASE_URL');
const SUPABASE_KEY = getEnvVar('SUPABASE_ANON_KEY', 'VITE_SUPABASE_KEY');

const hasSupabase = !!(SUPABASE_URL && SUPABASE_KEY);

if (!hasSupabase) {
    console.warn("Supabase keys missing. Falling back to localStorage (No Cross-Device Sync).");
} else {
    console.log("Supabase connected.");
}

// --- API Helpers ---

const apiHeaders = {
    'apikey': SUPABASE_KEY || '',
    'Authorization': `Bearer ${SUPABASE_KEY || ''}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
};

// --- LocalStorage Fallbacks (Same logic as before) ---
const getLocalDB = (): Record<string, any> => {
    try {
        const data = localStorage.getItem(USERS_KEY);
        return data ? JSON.parse(data) : {};
    } catch { return {}; }
};
const saveLocalDB = (db: Record<string, any>) => localStorage.setItem(USERS_KEY, JSON.stringify(db));


// --- Auth Functions ---

export const signUp = async (username: string, password: string): Promise<UserProfile> => {
    const cleanUser = username.trim().toLowerCase();
    
    // 1. Validation
    if (!cleanUser || !password) throw "Username and password required.";

    // 2. Supabase Logic
    if (hasSupabase) {
        try {
            // Check if exists
            const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${cleanUser}`, {
                method: 'GET', headers: apiHeaders
            });
            const existing = await checkRes.json();
            if (existing && existing.length > 0) throw "Username already taken.";

            // Create
            const newUser = {
                username: cleanUser,
                password: password,
                learning_index: 0,
                learned_words: [],
                mistakes: {}
            };

            const createRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
                method: 'POST',
                headers: apiHeaders,
                body: JSON.stringify(newUser)
            });

            if (!createRes.ok) {
                const err = await createRes.json();
                console.error("Supabase Error:", err);
                throw err.message || err.error_description || "Error creating account. Ensure database table 'users' exists.";
            }
            
            localStorage.setItem(SESSION_KEY, cleanUser);
            return {
                username: cleanUser,
                learningIndex: 0,
                learnedWords: [],
                mistakes: {}
            };
        } catch (e: any) {
            throw typeof e === 'string' ? e : "Connection error. Please try again.";
        }
    }

    // 3. LocalStorage Logic (Fallback)
    const db = getLocalDB();
    if (db[cleanUser]) throw "Username already taken.";
    
    const newUser = {
        username: cleanUser,
        password: password,
        learningIndex: 0,
        learnedWords: [],
        mistakes: {}
    };
    db[cleanUser] = newUser;
    saveLocalDB(db);
    localStorage.setItem(SESSION_KEY, cleanUser);
    
    return newUser;
};

export const signIn = async (username: string, password: string): Promise<UserProfile> => {
    const cleanUser = username.trim().toLowerCase();

    if (hasSupabase) {
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${cleanUser}`, {
                method: 'GET', headers: apiHeaders
            });
            
            if (!res.ok) {
                const err = await res.json();
                console.error("Supabase Login Error:", err);
                throw "Database connection error";
            }

            const users = await res.json();
            
            if (!users || users.length === 0) throw "User not found.";
            
            const user = users[0];
            if (user.password !== password) throw "Invalid password.";
            
            localStorage.setItem(SESSION_KEY, cleanUser);
            return {
                username: user.username,
                learningIndex: user.learning_index || 0,
                learnedWords: user.learned_words || [],
                mistakes: user.mistakes || {}
            };
        } catch (e: any) {
             throw typeof e === 'string' ? e : "Login failed. Please check connection.";
        }
    }

    // Fallback
    const db = getLocalDB();
    const user = db[cleanUser];
    if (!user) throw "User not found.";
    if (user.password !== password) throw "Invalid password.";
    
    localStorage.setItem(SESSION_KEY, cleanUser);
    return user;
};

export const signOut = () => {
    localStorage.removeItem(SESSION_KEY);
};

export const getCurrentSession = async (): Promise<UserProfile | null> => {
    const username = localStorage.getItem(SESSION_KEY);
    if (!username) return null;

    if (hasSupabase) {
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${username}`, {
                method: 'GET', headers: apiHeaders
            });
            const users = await res.json();
            if (users && users.length > 0) {
                const user = users[0];
                return {
                    username: user.username,
                    learningIndex: user.learning_index || 0,
                    learnedWords: user.learned_words || [],
                    mistakes: user.mistakes || {}
                };
            }
        } catch (e) { console.error("Session sync failed", e); }
    }

    // Fallback
    const db = getLocalDB();
    const user = db[username];
    return user ? {
        username: user.username,
        learningIndex: user.learningIndex || 0,
        learnedWords: user.learnedWords || [],
        mistakes: user.mistakes || {}
    } : null;
};

export const saveUserProgress = async (username: string, learningIndex: number, learnedWords: string[]) => {
    if (hasSupabase) {
        await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${username}`, {
            method: 'PATCH',
            headers: apiHeaders,
            body: JSON.stringify({
                learning_index: learningIndex,
                learned_words: learnedWords
            })
        });
    } else {
        const db = getLocalDB();
        if (db[username]) {
            db[username].learningIndex = learningIndex;
            db[username].learnedWords = learnedWords;
            saveLocalDB(db);
        }
    }
};

export const recordMistake = async (username: string, wordId: string) => {
    if (hasSupabase) {
         try {
             // 1. Get current
             const getRes = await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${username}`, {
                method: 'GET', headers: apiHeaders
            });
            const users = await getRes.json();
            if (users && users.length > 0) {
                const user = users[0];
                const mistakes = user.mistakes || {};
                mistakes[wordId] = (mistakes[wordId] || 0) + 1;
                
                // 2. Patch
                await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${username}`, {
                    method: 'PATCH',
                    headers: apiHeaders,
                    body: JSON.stringify({ mistakes: mistakes })
                });
            }
         } catch(e) { console.error("Mistake sync error", e); }
    } else {
        const db = getLocalDB();
        if (db[username]) {
            const mistakes = db[username].mistakes || {};
            mistakes[wordId] = (mistakes[wordId] || 0) + 1;
            db[username].mistakes = mistakes;
            saveLocalDB(db);
        }
    }
};
