
import { UserProfile } from '../types';

const USERS_KEY = 'gx_users_db';
const SESSION_KEY = 'gx_current_session';

// --- SUPABASE CONFIG ---
// CRITICAL: We must access these directly so Vite's build process can replace the strings
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || (import.meta as any).env?.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY || (import.meta as any).env?.VITE_SUPABASE_KEY || '';

const hasSupabase = !!(SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.startsWith('http'));

if (!hasSupabase) {
    console.warn("Supabase keys missing or invalid. Falling back to localStorage (No Cross-Device Sync).");
} else {
    console.log("Supabase config found.");
}

export const getConnectionStatus = () => hasSupabase;

// --- API Helpers ---

const apiHeaders = {
    'apikey': SUPABASE_KEY || '',
    'Authorization': `Bearer ${SUPABASE_KEY || ''}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
};

// --- LocalStorage Fallbacks ---
const getLocalDB = (): Record<string, any> => {
    try {
        const data = localStorage.getItem(USERS_KEY);
        return data ? JSON.parse(data) : {};
    } catch { return {}; }
};
const saveLocalDB = (db: Record<string, any>) => localStorage.setItem(USERS_KEY, JSON.stringify(db));


// --- Auth Functions ---

export const signUp = async (username: string, password: string, isPublic: boolean = true): Promise<UserProfile> => {
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
            // REMOVED srs_state from here to prevent "Column not found" error if DB schema isn't updated
            const newUser = {
                username: cleanUser,
                password: password,
                learning_index: 0,
                learned_words: [],
                mistakes: {},
                is_public: isPublic
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
                mistakes: {},
                isPublic: isPublic,
                srs_state: {}
            };
        } catch (e: any) {
            console.error("SignUp Exception:", e);
            throw typeof e === 'string' ? e : "Connection error. Check your internet.";
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
        mistakes: {},
        isPublic: isPublic,
        srs_state: {}
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
            
            if (!users || users.length === 0) throw "User not found. Please sign up first.";
            
            const user = users[0];
            if (user.password !== password) throw "Invalid password.";
            
            localStorage.setItem(SESSION_KEY, cleanUser);
            return {
                username: user.username,
                learningIndex: user.learning_index || 0,
                learnedWords: user.learned_words || [],
                mistakes: user.mistakes || {},
                isPublic: user.is_public ?? true,
                srs_state: user.srs_state || {} // Load SRS state so progress bar works
            };
        } catch (e: any) {
             console.error("SignIn Exception:", e);
             throw typeof e === 'string' ? e : "Login failed. Please check connection.";
        }
    }

    // Fallback
    const db = getLocalDB();
    const user = db[cleanUser];
    if (!user) throw "User not found (Offline Mode).";
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
                    mistakes: user.mistakes || {},
                    isPublic: user.is_public ?? true,
                    srs_state: user.srs_state || {} // Load SRS state
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
        mistakes: user.mistakes || {},
        isPublic: user.isPublic ?? true,
        srs_state: user.srs_state || {}
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

export const getLeaderboard = async (): Promise<{username: string, score: number}[]> => {
    if (hasSupabase) {
        try {
            // Fetch top 100 users, sorted by learning_index desc
            const res = await fetch(`${SUPABASE_URL}/rest/v1/users?learning_index=gt.0&select=username,learning_index,is_public&order=learning_index.desc&limit=100`, {
                method: 'GET', 
                headers: apiHeaders
            });
            
            if (!res.ok) throw "Failed to fetch leaderboard";
            
            const users = await res.json();
            return users.map((u: any) => ({
                username: (u.is_public === false) ? "Anonymous" : u.username,
                score: u.learning_index || 0
            }));
        } catch (e) {
            console.error("Leaderboard error", e);
            return [];
        }
    } else {
        // Fallback for offline mode
        const db = getLocalDB();
        const users = Object.values(db).map((u: any) => ({
            username: (u.isPublic === false) ? "Anonymous" : u.username,
            score: u.learningIndex || 0
        })).filter(u => u.score > 0);
        
        return users.sort((a, b) => b.score - a.score).slice(0, 100);
    }
};

// --- BETA SRS SYNC ---

export const saveSRSState = async (username: string, srsState: Record<string, any>) => {
    if (hasSupabase) {
        try {
            // We still try to patch srs_state here. If column is missing, this request might 400,
            // but it won't block the main app flow since it's caught.
            await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${username}`, {
                method: 'PATCH',
                headers: apiHeaders,
                body: JSON.stringify({ srs_state: srsState })
            });
        } catch (e) { console.error("SRS Sync failed (Column likely missing)", e); }
    } else {
        const db = getLocalDB();
        if(db[username]) {
            db[username].srs_state = srsState;
            saveLocalDB(db);
        }
    }
}

export const getSRSState = async (username: string): Promise<Record<string, any>> => {
    if (hasSupabase) {
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${username}`, {
                method: 'GET', headers: apiHeaders
            });
            const users = await res.json();
            if (users && users.length > 0) {
                return users[0].srs_state || {};
            }
        } catch (e) { console.error("Get SRS failed", e); }
    } else {
        const db = getLocalDB();
        if(db[username]) return db[username].srs_state || {};
    }
    return {};
}
