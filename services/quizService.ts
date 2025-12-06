
import { Word, QuizQuestion, QuizQuestionType } from '../types';
import { allWords } from '../data';

export const generateQuiz = (words: Word[]): QuizQuestion[] => {
  return words.map((targetWord, index) => {
    // Determine question type:
    // If a sentence exists, ALWAYS use Context.
    // If not, there is a 40% chance we will try to generate a Context question via AI in the UI.
    let type = QuizQuestionType.DEFINITION;
    
    if (targetWord.sentence) {
        type = QuizQuestionType.CONTEXT;
    } else {
        // Randomly assign Context type to force dynamic generation
        type = Math.random() < 0.4 ? QuizQuestionType.CONTEXT : QuizQuestionType.DEFINITION;
    }

    const correctAnswer = targetWord.meaning;
    
    // Get 3 random distractors
    const distractors: string[] = [];
    while (distractors.length < 3) {
      const randomIdx = Math.floor(Math.random() * allWords.length);
      const randomWord = allWords[randomIdx];
      
      if (
        randomWord.id !== targetWord.id && 
        randomWord.meaning !== correctAnswer &&
        !distractors.includes(randomWord.meaning)
      ) {
        distractors.push(randomWord.meaning);
      }
    }

    const options = [...distractors, correctAnswer];
    // Fisher-Yates shuffle
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }

    let questionText = "";
    
    if (type === QuizQuestionType.CONTEXT) {
        if (targetWord.sentence) {
            // Format existing sentence: "The <u>word</u> ..."
            const regex = new RegExp(`\\b${targetWord.term}\\b`, 'i');
            questionText = targetWord.sentence.replace(regex, `<u>${targetWord.term}</u>`);
            
            // Fallback if regex didn't match (e.g. slight variation)
            if (questionText === targetWord.sentence) {
                 const parts = targetWord.sentence.split(new RegExp(`(${targetWord.term})`, 'gi'));
                 questionText = parts.map(p => p.toLowerCase() === targetWord.term.toLowerCase() ? `<u>${p}</u>` : p).join('');
            }
        } else {
            // Leave empty to signal the UI to generate it via AI
            questionText = ""; 
        }
    } else {
        questionText = `The word "${targetWord.term}" means:`;
    }

    return {
      id: `q_${targetWord.id}`,
      type,
      word: targetWord,
      questionText,
      options,
      correctOptionIndex: options.indexOf(correctAnswer),
    };
  });
};
