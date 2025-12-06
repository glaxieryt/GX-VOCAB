
import { UserProfile } from '../types';

const USERS_KEY = 'gx_users_db';
const SESSION_KEY = 'gx_current_session';

// Helper to get all users
const getDB = (): Record<string, any> => {
    try {
        const data = localStorage.getItem(USERS_KEY);
        return data ? JSON.parse(data) : {};
    } catch {
        return {};
    }
};

// Helper to save DB
const saveDB = (db: Record<string, any>) => {
    localStorage.setItem(USERS_KEY, JSON.stringify(db));
};

export const signUp = (username: string, password: string): Promise<UserProfile> => {
    return new Promise((resolve, reject) => {
        try {
            const db = getDB();
            const cleanUser = username.trim().toLowerCase();

            if (!cleanUser || !password) {
                return reject("Username and password required.");
            }

            if (db[cleanUser]) {
                return reject("Username already taken. Please choose another.");
            }

            // Create new user
            const newUser = {
                username: cleanUser,
                password: password, // In a real app, hash this!
                learningIndex: 0,
                learnedWords: [],
                mistakes: {} // Init empty mistakes
            };

            db[cleanUser] = newUser;
            saveDB(db);
            
            // Auto login
            localStorage.setItem(SESSION_KEY, cleanUser);
            
            console.log("User registered:", cleanUser);

            resolve({
                username: cleanUser,
                learningIndex: 0,
                learnedWords: [],
                mistakes: {}
            });
        } catch (e) {
            console.error("Signup error", e);
            reject("An error occurred during sign up.");
        }
    });
};

export const signIn = (username: string, password: string): Promise<UserProfile> => {
    return new Promise((resolve, reject) => {
        try {
            const db = getDB();
            const cleanUser = username.trim().toLowerCase();
            const userRecord = db[cleanUser];

            console.log("Attempting login for:", cleanUser);

            if (!userRecord) {
                return reject("User not found. Please sign up.");
            }
            
            if (userRecord.password !== password) {
                return reject("Invalid password.");
            }

            localStorage.setItem(SESSION_KEY, cleanUser);
            console.log("Login successful");

            resolve({
                username: userRecord.username,
                learningIndex: userRecord.learningIndex || 0,
                learnedWords: userRecord.learnedWords || [],
                mistakes: userRecord.mistakes || {}
            });
        } catch (e) {
            console.error("Signin error", e);
            reject("An error occurred during sign in.");
        }
    });
};

export const signOut = () => {
    localStorage.removeItem(SESSION_KEY);
};

export const getCurrentSession = (): UserProfile | null => {
    try {
        const username = localStorage.getItem(SESSION_KEY);
        if (!username) return null;

        const db = getDB();
        const user = db[username];
        
        if (!user) return null;

        return {
            username: user.username,
            learningIndex: user.learningIndex || 0,
            learnedWords: user.learnedWords || [],
            mistakes: user.mistakes || {}
        };
    } catch (e) {
        return null;
    }
};

export const saveUserProgress = (username: string, learningIndex: number, learnedWords: string[]) => {
    const db = getDB();
    if (db[username]) {
        db[username].learningIndex = learningIndex;
        db[username].learnedWords = learnedWords;
        saveDB(db);
    }
};

export const recordMistake = (username: string, wordId: string) => {
    const db = getDB();
    if (db[username]) {
        const currentMistakes = db[username].mistakes || {};
        currentMistakes[wordId] = (currentMistakes[wordId] || 0) + 1;
        
        db[username].mistakes = currentMistakes;
        saveDB(db);
    }
};
