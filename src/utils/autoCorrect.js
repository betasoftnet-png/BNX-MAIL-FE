// Dictionary of common typos, contractions, and their standard corrections
export const AUTO_CORRECT_DICT = {
  // Common Typos
  "teh": "the",
  "adn": "and",
  "taht": "that",
  "recieve": "receive",
  "recieved": "received",
  "recieving": "receiving",
  "seperate": "separate",
  "seperated": "separated",
  "definately": "definitely",
  "untill": "until",
  "truely": "truly",
  "wierd": "weird",
  "beleive": "believe",
  "beleived": "believed",
  "acheive": "achieve",
  "acheived": "achieved",
  "adress": "address",
  "adresses": "addresses",
  "alot": "a lot",
  "occured": "occurred",
  "occuring": "occurring",
  "goverment": "government",
  "accomodate": "accommodate",
  "calender": "calendar",
  "tommorrow": "tomorrow",
  "tommorow": "tomorrow",
  "beutiful": "beautiful",
  "neccessary": "necessary",
  "begining": "beginning",
  "enviroment": "environment",

  // Contractions
  "dont": "don't",
  "cant": "can't",
  "wont": "won't",
  "didnt": "didn't",
  "isnt": "isn't",
  "arent": "aren't",
  "wasnt": "wasn't",
  "werent": "weren't",
  "havent": "haven't",
  "hasnt": "hasn't",
  "hadnt": "hadn't",
  "wouldnt": "wouldn't",
  "couldnt": "couldn't",
  "shouldnt": "shouldn't",
  "im": "I'm",
  "ive": "I've",
  "youre": "you're",
  "theyre": "they're",
  "weve": "we've",
  "youve": "you've",
  "theyve": "they've",
  "thats": "that's",
  "whats": "what's",
  "hows": "how's",
  "wheres": "where's",
  "theres": "there's",
  "lets": "let's",

  // Standalone 'i'
  "i": "I",
};

/**
 * Returns the corrected version of a word if found, preserving capitalization.
 */
export function getAutoCorrectWord(rawWord) {
  if (!rawWord) return null;
  const lower = rawWord.toLowerCase();
  const correction = AUTO_CORRECT_DICT[lower];
  if (!correction) return null;

  // Preserve all-caps (e.g. TEH -> THE)
  if (rawWord.length > 1 && rawWord === rawWord.toUpperCase()) {
    return correction.toUpperCase();
  }
  // Preserve TitleCase (e.g. Teh -> The, Recieve -> Receive, Dont -> Don't)
  if (rawWord[0] === rawWord[0].toUpperCase() && rawWord.slice(1) === rawWord.slice(1).toLowerCase()) {
    return correction.charAt(0).toUpperCase() + correction.slice(1);
  }
  return correction;
}

/**
 * Attaches a smart auto-correct listener to a Quill editor instance.
 * Automatically replaces typos on Space, Enter, or punctuation.
 */
export function attachQuillAutoCorrect(quill, isEnabledGetter) {
  if (!quill || quill.__autoCorrectAttached) return;
  quill.__autoCorrectAttached = true;

  const handleKeyDown = (e) => {
    const isEnabled = typeof isEnabledGetter === 'function' ? isEnabledGetter() : Boolean(isEnabledGetter);
    if (!isEnabled) return;

    if (e.key === ' ' || e.key === 'Enter' || e.key === '.' || e.key === ',' || e.key === '!' || e.key === '?') {
      try {
        const range = quill.getSelection();
        if (!range) return;
        const cursor = range.index;
        if (cursor <= 0) return;

        // Inspect up to 30 characters before cursor
        const checkLength = Math.min(cursor, 30);
        const startPos = cursor - checkLength;
        const textBefore = quill.getText(startPos, checkLength);

        // Find the last word immediately before cursor
        const match = textBefore.match(/([a-zA-Z']+)\s*$/);
        if (match) {
          const rawWord = match[1];
          const corrected = getAutoCorrectWord(rawWord);
          if (corrected && corrected !== rawWord) {
            const wordStart = cursor - match[0].length;
            const wordLen = rawWord.length;

            setTimeout(() => {
              try {
                quill.deleteText(wordStart, wordLen);
                quill.insertText(wordStart, corrected);
                const newCursor = wordStart + corrected.length + (e.key === ' ' ? 1 : 1);
                quill.setSelection(newCursor, 0);
              } catch (err) {
                // Silently ignore selection errors
              }
            }, 0);
          }
        }
      } catch (err) {
        console.warn("Quill auto-correct error:", err);
      }
    }
  };

  quill.root.addEventListener('keydown', handleKeyDown);
  return () => {
    quill.root.removeEventListener('keydown', handleKeyDown);
    quill.__autoCorrectAttached = false;
  };
}

/**
 * Handles auto-correct on standard input / textarea on KeyDown.
 */
export function handleStandardInputAutoCorrect(e, isEnabled) {
  if (!isEnabled) return;
  if (e.key === ' ' || e.key === 'Enter' || e.key === '.' || e.key === ',' || e.key === '!' || e.key === '?') {
    const input = e.target;
    const start = input.selectionStart;
    const value = input.value;
    if (start === null || start === 0) return;

    const checkLength = Math.min(start, 30);
    const textBefore = value.slice(start - checkLength, start);
    const match = textBefore.match(/([a-zA-Z']+)\s*$/);

    if (match) {
      const rawWord = match[1];
      const corrected = getAutoCorrectWord(rawWord);
      if (corrected && corrected !== rawWord) {
        const wordStart = start - match[0].length;
        const wordLen = rawWord.length;

        // Defer replacement to right after key is inserted
        setTimeout(() => {
          const curVal = input.value;
          const newVal = curVal.slice(0, wordStart) + corrected + curVal.slice(wordStart + wordLen);
          input.value = newVal;
          const newPos = wordStart + corrected.length + 1;
          input.setSelectionRange(newPos, newPos);
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }, 0);
      }
    }
  }
}
