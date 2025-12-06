
import { MathProblem, MathTopic, DifficultyLevel } from '../types';

export const generateProblem = (topic: MathTopic, difficulty: DifficultyLevel): MathProblem => {
    let question = "";
    let correct = 0;
    let hint = "";
    let explanation = "";
    let distractors: number[] = [];

    const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

    // --- MULTIPLICATION ---
    if (topic === MathTopic.MULTIPLICATION) {
        let n1 = 0, n2 = 0;
        if (difficulty === DifficultyLevel.BEGINNER) {
            n1 = randomInt(2, 9);
            n2 = randomInt(2, 9);
        } else if (difficulty === DifficultyLevel.INTERMEDIATE) {
            n1 = randomInt(10, 15);
            n2 = randomInt(3, 9);
        } else if (difficulty === DifficultyLevel.ADVANCED) {
            n1 = randomInt(12, 19);
            n2 = randomInt(12, 19);
        } else {
            n1 = randomInt(20, 50);
            n2 = randomInt(5, 20);
        }
        
        correct = n1 * n2;
        question = `${n1} × ${n2} = ?`;
        hint = difficulty === DifficultyLevel.BEGINNER 
            ? `Think of ${n1} groups of ${n2}.` 
            : `Try breaking ${n1} into ${Math.floor(n1/10)*10} + ${n1%10}.`;
        
        explanation = `${n1} multiplied by ${n2} equals ${correct}.`;
        
        // Distractors
        distractors = [
            correct + n1, // Added an extra group
            correct - n1, // Missed a group
            correct + 10, // Calculation error
            (n1 + 1) * n2 // Off by one error
        ];
    } 
    
    // --- POWERS ---
    else if (topic === MathTopic.POWERS) {
        let n = 0;
        if (difficulty === DifficultyLevel.BEGINNER) {
            n = randomInt(2, 10);
            correct = n * n;
            question = `${n}² = ?`;
            hint = `Multiply ${n} by itself.`;
        } else if (difficulty === DifficultyLevel.INTERMEDIATE) {
            n = randomInt(11, 20);
            correct = n * n;
            question = `${n}² = ?`;
            hint = `Remember that 10² is 100 and 20² is 400.`;
        } else {
            n = randomInt(3, 10);
            correct = n * n * n;
            question = `${n}³ = ?`;
            hint = `${n} × ${n} × ${n}`;
        }
        explanation = `The exponent tells you to multiply the base by itself.`;
        
        distractors = [
            correct + n,
            correct - n,
            n * 2, // Common mistake: n * exponent
            correct + (Math.random() > 0.5 ? 10 : -10)
        ];
    }

    // --- ROOTS ---
    else if (topic === MathTopic.ROOTS) {
        let root = 0;
        if (difficulty === DifficultyLevel.BEGINNER) {
            root = randomInt(2, 10);
            const sq = root * root;
            correct = root;
            question = `√${sq} = ?`;
            hint = `What number multiplied by itself gives ${sq}?`;
        } else if (difficulty === DifficultyLevel.INTERMEDIATE) {
            root = randomInt(11, 20);
            const sq = root * root;
            correct = root;
            question = `√${sq} = ?`;
            hint = `Ends in ${root%10}, so the root must end in...`;
        } else {
            root = randomInt(3, 8);
            const cb = root * root * root;
            correct = root;
            question = `∛${cb} = ?`;
            hint = `What number cubed equals ${cb}?`;
        }
        explanation = `${correct} × ${correct} = ${correct*correct}.`;
        
        distractors = [
            correct + 1,
            correct - 1,
            Math.floor(correct / 2),
            correct + 2
        ];
    }

    // Ensure distractors are unique and positive
    const uniqueOpts = new Set<number>();
    uniqueOpts.add(correct);
    distractors.forEach(d => {
        if (d > 0 && d !== correct) uniqueOpts.add(d);
    });
    
    // Fill if needed
    while (uniqueOpts.size < 4) {
        uniqueOpts.add(correct + Math.floor(Math.random() * 10) + 1);
    }

    const finalOptions = Array.from(uniqueOpts).sort(() => Math.random() - 0.5);

    return {
        id: Math.random().toString(36).substr(2, 9),
        question,
        correctAnswer: correct,
        options: finalOptions,
        hint,
        explanation,
        difficulty
    };
};
