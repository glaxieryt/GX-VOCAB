
import { UserProfile } from '../types';

const USERS_KEY = 'gx_users_db';
const SESSION_KEY = 'gx_current_session';

// --- SUPABASE CONFIG ---
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || (import.meta as any).env?.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY || (import.meta as any).env?.VITE_SUPABASE_KEY || '';

const hasSupabase = !!(SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.startsWith('http'));

export const getConnectionStatus = () => hasSupabase;

const apiHeaders = {
    'apikey': SUPABASE_KEY || '',
    'Authorization': `Bearer ${SUPABASE_KEY || ''}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
};

const getLocalDB = (): Record<string, any> => {
    try {
        const data = localStorage.getItem(USERS_KEY);
        return data ? JSON.parse(data) : {};
    } catch { return {}; }
};
const saveLocalDB = (db: Record<string, any>) => localStorage.setItem(USERS_KEY, JSON.stringify(db));

export const signUp = async (username: string, password: string, isPublic: boolean = true): Promise<UserProfile> => {
    const cleanUser = username.trim().toLowerCase();
    
    if (!cleanUser || !password) throw "Username and password required.";

    if (hasSupabase) {
        try {
            const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${cleanUser}`, {
                method: 'GET', headers: apiHeaders
            });
            const existing = await checkRes.json();
            if (existing && existing.length > 0) throw "Username already taken.";

            const newUser = {
                username: cleanUser,
                password: password,
                learning_index: 0,
                learned_words: [],
                mistakes: {},
                xp: 0, // Init XP
                is_public: isPublic
                // NOTE: srs_state removed to prevent error if column is missing.
                // It will be added on first saveSRSState.
            };

            const createRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
                method: 'POST',
                headers: apiHeaders,
                body: JSON.stringify(newUser)
            });

            if (!createRes.ok) {
                const err = await createRes.json();
                throw err.message || "Error creating account.";
            }
            
            localStorage.setItem(SESSION_KEY, cleanUser);
            return {
                username: cleanUser,
                learningIndex: 0,
                learnedWords: [],
                mistakes: {},
                xp: 0,
                isPublic: isPublic,
                srs_state: {}
            };
        } catch (e: any) {
            console.error("SignUp Exception:", e);
            throw typeof e === 'string' ? e : "Connection error.";
        }
    }

    const db = getLocalDB();
    if (db[cleanUser]) throw "Username already taken.";
    
    const newUser = {
        username: cleanUser,
        password: password,
        learningIndex: 0,
        learnedWords: [],
        mistakes: {},
        xp: 0,
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
            
            if (!res.ok) throw "Database connection error";
            const users = await res.json();
            
            if (!users || users.length === 0) throw "User not found.";
            
            const user = users[0];
            if (user.password !== password) throw "Invalid password.";
            
            localStorage.setItem(SESSION_KEY, cleanUser);
            return {
                username: user.username,
                learningIndex: user.learning_index || 0,
                learnedWords: user.learned_words || [],
                mistakes: user.mistakes || {},
                xp: user.xp || 0,
                isPublic: user.is_public ?? true,
                srs_state: user.srs_state || {} 
            };
        } catch (e: any) {
             throw typeof e === 'string' ? e : "Login failed.";
        }
    }

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
                    xp: user.xp || 0,
                    isPublic: user.is_public ?? true,
                    srs_state: user.srs_state || {}
                };
            }
        } catch (e) { console.error("Session sync failed", e); }
    }

    const db = getLocalDB();
    const user = db[username];
    return user ? {
        username: user.username,
        learningIndex: user.learningIndex || 0,
        learnedWords: user.learnedWords || [],
        mistakes: user.mistakes || {},
        xp: user.xp || 0,
        isPublic: user.isPublic ?? true,
        srs_state: user.srs_state || {}
    } : null;
};

export const saveUserProgress = async (username: string, learningIndex: number, learnedWords: string[], xp?: number) => {
    const payload: any = {
        learning_index: learningIndex,
        learned_words: learnedWords
    };
    if (xp !== undefined) payload.xp = xp;

    if (hasSupabase) {
        await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${username}`, {
            method: 'PATCH',
            headers: apiHeaders,
            body: JSON.stringify(payload)
        });
    } else {
        const db = getLocalDB();
        if (db[username]) {
            db[username].learningIndex = learningIndex;
            db[username].learnedWords = learnedWords;
            if (xp !== undefined) db[username].xp = xp;
            saveLocalDB(db);
        }
    }
};

export const recordMistake = async (username: string, wordId: string) => {
    if (hasSupabase) {
         try {
             const getRes = await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${username}`, {
                method: 'GET', headers: apiHeaders
            });
            const users = await getRes.json();
            if (users && users.length > 0) {
                const user = users[0];
                const mistakes = user.mistakes || {};
                mistakes[wordId] = (mistakes[wordId] || 0) + 1;
                
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
            // Sort by XP now instead of learning_index
            const res = await fetch(`${SUPABASE_URL}/rest/v1/users?xp=gt.0&select=username,xp,is_public&order=xp.desc&limit=100`, {
                method: 'GET', 
                headers: apiHeaders
            });
            
            if (!res.ok) throw "Failed to fetch leaderboard";
            
            const users = await res.json();
            return users.map((u: any) => ({
                username: (u.is_public === false) ? "Anonymous" : u.username,
                score: u.xp || 0
            }));
        } catch (e) {
            console.error("Leaderboard error", e);
            return [];
        }
    } else {
        const db = getLocalDB();
        const users = Object.values(db).map((u: any) => ({
            username: (u.isPublic === false) ? "Anonymous" : u.username,
            score: u.xp || 0
        })).filter(u => u.score > 0);
        
        return users.sort((a, b) => b.score - a.score).slice(0, 100);
    }
};

export const saveSRSState = async (username: string, srsState: Record<string, any>, addedXp: number = 0) => {
    if (hasSupabase) {
        try {
            const getRes = await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${username}`, {
                method: 'GET', headers: apiHeaders
            });
            const users = await getRes.json();
            const currentXp = users[0]?.xp || 0;
            const newXp = currentXp + addedXp;

            await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${username}`, {
                method: 'PATCH',
                headers: apiHeaders,
                body: JSON.stringify({ srs_state: srsState, xp: newXp })
            });
        } catch (e) { console.error("SRS Sync failed", e); }
    } else {
        const db = getLocalDB();
        if(db[username]) {
            db[username].srs_state = srsState;
            db[username].xp = (db[username].xp || 0) + addedXp;
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
