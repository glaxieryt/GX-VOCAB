
import { UserProfile, MathStats } from '../types';

const USERS_KEY = 'gx_users_db';
const SESSION_KEY = 'gx_current_session';

// --- SUPABASE CONFIG ---
// Access environment variables directly via process.env.
// The vite.config.ts file is configured to replace these variables with their string values at build time.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

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

// Helper to extract full user profile from a Supabase row
const mapSupabaseUserToProfile = (user: any): UserProfile => ({
    username: user.username,
    learningIndex: user.learning_index || 0,
    learnedWords: user.learned_words || [],
    mistakes: user.mistakes || {},
    xp: user.xp || 0,
    isPublic: user.is_public ?? true,
    srs_state: user.srs_state || {},
    // FIX: Add math_stats with a default value to the user profile mapping.
    math_stats: user.math_stats || { streak: 0, solved: 0, lastPlayed: 0, progress: {} }
});

export const signUp = async (username: string, password: string, isPublic: boolean = true): Promise<UserProfile> => {
    const cleanUser = username.trim().toLowerCase();
    
    if (!cleanUser || !password) throw "Username and password required.";

    if (hasSupabase) {
        const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${cleanUser}&select=username`, {
            method: 'GET', headers: apiHeaders, cache: 'no-cache'
        });
        const existing = await checkRes.json();
        if (existing && existing.length > 0) throw "Username already taken.";

        const newUser = {
            username: cleanUser,
            password: password, // In a real app, hash this!
            is_public: isPublic
            // All other columns have default values in the database
        };

        const createRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
            method: 'POST',
            headers: apiHeaders,
            body: JSON.stringify(newUser)
        });

        if (!createRes.ok) {
            const err = await createRes.json();
            throw err.message || "Error creating account on Supabase.";
        }
        
        localStorage.setItem(SESSION_KEY, cleanUser);
        const createdUser = (await createRes.json())[0];
        return mapSupabaseUserToProfile(createdUser);
    }

    // Fallback to local storage
    const db = getLocalDB();
    if (db[cleanUser]) throw "Username already taken.";
    const newUserProfile: UserProfile = {
        username: cleanUser,
        learningIndex: 0, learnedWords: [], mistakes: {}, xp: 0, isPublic,
        srs_state: {},
        // FIX: Add default math_stats for new local users.
        math_stats: { streak: 0, solved: 0, lastPlayed: 0, progress: {} }
    };
    db[cleanUser] = { ...newUserProfile, password };
    saveLocalDB(db);
    localStorage.setItem(SESSION_KEY, cleanUser);
    return newUserProfile;
};

export const signIn = async (username: string, password: string): Promise<UserProfile> => {
    const cleanUser = username.trim().toLowerCase();

    if (hasSupabase) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${cleanUser}&select=*`, {
            method: 'GET', headers: apiHeaders, cache: 'no-cache'
        });
        
        if (!res.ok) throw "Database connection error";
        const users = await res.json();
        
        if (!users || users.length === 0) throw "User not found.";
        const user = users[0];
        if (user.password !== password) throw "Invalid password.";
        
        localStorage.setItem(SESSION_KEY, cleanUser);
        return mapSupabaseUserToProfile(user);
    }

    // Fallback
    const db = getLocalDB();
    const user = db[cleanUser];
    if (!user) throw "User not found (Offline Mode).";
    if (user.password !== password) throw "Invalid password.";
    localStorage.setItem(SESSION_KEY, cleanUser);
    return user;
};

export const signOut = () => localStorage.removeItem(SESSION_KEY);

export const getCurrentSession = async (): Promise<UserProfile | null> => {
    const username = localStorage.getItem(SESSION_KEY);
    if (!username) return null;

    if (hasSupabase) {
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${username}&select=*`, {
                method: 'GET', headers: apiHeaders, cache: 'no-cache'
            });
            const users = await res.json();
            if (users && users.length > 0) {
                return mapSupabaseUserToProfile(users[0]);
            }
        } catch (e) { console.error("Session sync failed", e); }
    }
    
    // Fallback
    const db = getLocalDB();
    return db[username] || null;
};

export const saveUserProgress = async (username: string, learningIndex: number, learnedWords: string[], xp?: number) => {
    const payload: any = { learning_index: learningIndex, learned_words: learnedWords };
    if (xp !== undefined) payload.xp = xp;

    if (hasSupabase) {
        await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${username}`, {
            method: 'PATCH', headers: apiHeaders, body: JSON.stringify(payload), cache: 'no-cache'
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

// FIX: Add missing recordMistake function.
export const recordMistake = async (username: string, wordId: string) => {
    if (hasSupabase) {
        try {
            // 1. Get current mistakes
            const res = await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${username}&select=mistakes`, {
                method: 'GET', headers: apiHeaders, cache: 'no-cache'
            });
            if (!res.ok) {
                console.error("Failed to fetch mistakes");
                return;
            }
            const data = await res.json();
            const currentMistakes = data[0]?.mistakes || {};

            // 2. Update mistakes
            currentMistakes[wordId] = (currentMistakes[wordId] || 0) + 1;

            // 3. Save back
            await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${username}`, {
                method: 'PATCH', 
                headers: apiHeaders, 
                body: JSON.stringify({ mistakes: currentMistakes }),
                cache: 'no-cache'
            });
        } catch (e) {
            console.error("Failed to record mistake", e);
        }
    } else {
        const db = getLocalDB();
        if (db[username]) {
            const userMistakes = db[username].mistakes || {};
            userMistakes[wordId] = (userMistakes[wordId] || 0) + 1;
            db[username].mistakes = userMistakes;
            saveLocalDB(db);
        }
    }
};

// FIX: Add missing saveMathProgress function.
export const saveMathProgress = async (username: string, stats: MathStats, addedXp: number = 0) => {
    if (hasSupabase) {
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${username}&select=xp`, {
                method: 'GET', headers: apiHeaders, cache: 'no-cache'
            });
            const data = await res.json();
            const currentXp = data[0]?.xp || 0;
            
            const payload = {
                math_stats: stats,
                xp: currentXp + addedXp
            };

            await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${username}`, {
                method: 'PATCH', headers: apiHeaders, body: JSON.stringify(payload), cache: 'no-cache'
            });
        } catch (e) { console.error("Failed to save math progress", e); }
    } else {
        const db = getLocalDB();
        if (db[username]) {
            db[username].math_stats = stats;
            db[username].xp = (db[username].xp || 0) + addedXp;
            saveLocalDB(db);
        }
    }
};

export const getLeaderboard = async (): Promise<{username: string, score: number}[]> => {
    if (hasSupabase) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/users?xp=gt.0&select=username,xp,is_public&order=xp.desc&limit=100`, {
            method: 'GET', headers: apiHeaders, cache: 'no-cache'
        });
        if (!res.ok) return [];
        const users = await res.json();
        return users.map((u: any) => ({
            username: u.is_public === false ? "Anonymous" : u.username,
            score: u.xp || 0
        }));
    }
    // Fallback
    const db = getLocalDB();
    return Object.values(db).map((u: any) => ({
        username: u.isPublic === false ? "Anonymous" : u.username,
        score: u.xp || 0
    })).filter(u => u.score > 0).sort((a, b) => b.score - a.score).slice(0, 100);
};

export const saveSRSState = async (username: string, srsState: Record<string, any>, addedXp: number = 0) => {
    if (!hasSupabase) {
        const db = getLocalDB();
        if(db[username]) {
            db[username].srs_state = srsState;
            db[username].xp = (db[username].xp || 0) + addedXp;
            saveLocalDB(db);
        }
        return;
    }
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${username}&select=xp`, {
            method: 'GET', headers: apiHeaders, cache: 'no-cache'
        });
        const data = await res.json();
        const currentXp = data[0]?.xp || 0;
        await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${username}`, {
            method: 'PATCH',
            headers: apiHeaders,
            body: JSON.stringify({ srs_state: srsState, xp: currentXp + addedXp }),
            cache: 'no-cache'
        });
    } catch (e) { console.error("SRS Sync failed", e); }
};

export const getSRSState = async (username: string): Promise<Record<string, any>> => {
    if (hasSupabase) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${username}&select=srs_state`, {
            method: 'GET', headers: apiHeaders, cache: 'no-cache'
        });
        const data = await res.json();
        return data[0]?.srs_state || {};
    }
    return getLocalDB()[username]?.srs_state || {};
};

export const saveWordProgress = async (
    username: string, 
    wordId: string, 
    status: string, 
    confidence: number,
    nextReview: number,
    streak: number
) => {
    if (!hasSupabase) return;

    // Payload for POST (new record)
    const postPayload = {
        user_id: username,
        word_id: wordId,
        status: status,
        confidence_level: confidence,
        next_review: new Date(nextReview).toISOString(),
        last_reviewed: new Date().toISOString(),
        review_count: streak
    };

    // Payload for PATCH (existing record) - don't include identifiers
    const patchPayload = {
        status: status,
        confidence_level: confidence,
        next_review: new Date(nextReview).toISOString(),
        last_reviewed: new Date().toISOString(),
        review_count: streak
    };

    try {
        // 1. Check if a record exists for this user and word.
        const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/als_word_progress?user_id=eq.${username}&word_id=eq.${wordId}&select=id`, {
            method: 'GET',
            headers: apiHeaders,
            cache: 'no-cache'
        });
        
        if (!checkRes.ok) {
            console.error("Failed to check for existing word progress", await checkRes.json());
            return;
        }

        const existing = await checkRes.json();

        let saveRes;
        if (existing && existing.length > 0) {
            // 2. If it exists, PATCH it using its primary key `id`.
            saveRes = await fetch(`${SUPABASE_URL}/rest/v1/als_word_progress?id=eq.${existing[0].id}`, {
                method: 'PATCH',
                headers: apiHeaders,
                body: JSON.stringify(patchPayload),
                cache: 'no-cache'
            });
        } else {
            // 3. If not, POST to create it.
            saveRes = await fetch(`${SUPABASE_URL}/rest/v1/als_word_progress`, {
                method: 'POST',
                headers: apiHeaders,
                body: JSON.stringify(postPayload),
                cache: 'no-cache'
            });
        }

        if (!saveRes.ok) {
            const error = await saveRes.json();
            console.error("Failed to save word progress (upsert):", error);
            throw new Error(error.message);
        }

    } catch (e) {
        console.error("Network error saving word progress:", e);
    }
};