export const bareToken = ({ inputLength, ...rest }) => rest;
const startNamePattern = /^[\\a-zA-Z_]$/u;
export const canStartName = c => c.match(startNamePattern);
export const isNameChar = c => c.match(/^[\\0-9a-zA-Z_?]$/u);
const literalValues = new Set(['true', 'false']);

/* In the formula box we want to know, "Does the character the user just typed
 * cause a new token to be produced? If the user has typed "asdf" in the box,
 * a character " " will cause one token to be produced -- { name: "asdf" }.
 * On the other hand, a character "(" will result in two tokens: the name and
 * the paren. I think we can treat EOF as whitespace.
 * This is pretty horrible, tbh. I might have written the generator stuff
 * inside-out, and it would probably have been simpler to just lex the whole
 * input and never consider tokens that include the last character. Doing it
 * incrementally does have the benefit of making it easier to restart after
 * exceptions, though, and does make the mapping from input characters to
 * tokens (arguably) simpler.
 */


function* lexName(prevLeftOverTokens, firstChar) {
  const chars = [];
  let nextChar = firstChar;
  let leftOverTokens = prevLeftOverTokens;
  let inputLength = 0;
  let nextCharEscaped = false;
  while (nextChar && (nextCharEscaped || isNameChar(nextChar))) {
    if (nextChar === '\\' && !nextCharEscaped) {
      nextCharEscaped = true;
    } else {
      chars.push(nextChar);
      nextCharEscaped = false;
    }
    nextChar = yield leftOverTokens;
    inputLength += 1;
    leftOverTokens = [];
  }
  const str = chars.join('');
  const token = literalValues.has(str)
    ? { value: JSON.parse(str), inputLength }
    : { name: str, inputLength };
  return { nextChar, leftOverTokens: [token] };
}

function* lexNumber(prevLeftOverTokens, firstChar) {
  const chars = [];
  let nextChar = firstChar;
  let inputLength = 0;
  let leftOverTokens = prevLeftOverTokens;
  while (nextChar && nextChar.match(/^[0-9.]$/)) {
    chars.push(nextChar);
    nextChar = yield leftOverTokens;
    inputLength += 1;
    leftOverTokens = [];
  }
  const token = { value: JSON.parse(chars.join('')), inputLength };
  return { nextChar, leftOverTokens: [token] };
}

function* lexString(prevLeftOverTokens) {
  let inputLength = 1;
  let next = yield prevLeftOverTokens;
  inputLength += 1;
  const chars = ['"'];
  let charEscaped = false;
  while (next) {
    chars.push(next);
    if (next === '"' && !charEscaped) {
      const token = { value: JSON.parse(chars.join('')), inputLength };
      const nextChar = yield [token];
      return { nextChar, leftOverTokens: [] };
    }
    next = yield [];
    inputLength += 1;
    charEscaped = next === '\\';
  }
  // Unterminated strings just get taken literally from the quote to the end.
  // Then we don't need to worry about "what if it ends with a backslash" etc.
  const token = {
    value: chars.slice(1).join(''),
    inputLength: inputLength - 1,
  };
  return { nextChar: next, leftOverTokens: [token] };
}


function* chompWhitespace(prevLeftOverTokens, firstChar) {
  let nextChar = firstChar;
  let inputLength = 0;
  let leftOverTokens = prevLeftOverTokens;
  const retStr = [];
  while (nextChar && nextChar.match(/^\s$/)) {
    inputLength += 1;
    retStr.push(nextChar);
    nextChar = yield leftOverTokens;
    leftOverTokens = [];
  }
  leftOverTokens.push({ whitespace: retStr.join(''), inputLength });
  return { nextChar, leftOverTokens };
}


const twoCharOps = new Set(['**', '>=', '<=', '>>', '<<', '&&', '||', '!=']);
const twoCharOpPrefixes = new Set([...twoCharOps].map(([c]) => c));

function* lexOp(prevLeftOverTokens, firstChar) {
  if (!twoCharOpPrefixes.has(firstChar)) {
    const token = { op: firstChar, inputLength: 1 };
    const nextChar = yield [...prevLeftOverTokens, token];
    return { nextChar, leftOverTokens: [] };
  }
  const secondChar = yield prevLeftOverTokens;
  const maybeTwoCharOp = firstChar + secondChar;
  if (secondChar && twoCharOps.has(maybeTwoCharOp)) {
    const nextChar = yield [{ op: maybeTwoCharOp, inputLength: 2 }];
    return { nextChar, leftOverTokens: [] };
  }
  const token = { op: firstChar, inputLength: 1 };
  return { nextChar: secondChar, leftOverTokens: [token] };
}


export function* generatorLex() {
  const singleCharTokens = {
    '(': 'open',
    ')': 'close',
    '[': 'openBracket',
    ']': 'closeBracket',
    '{': 'openBrace',
    '}': 'closeBrace',
    ':': 'assignment',
    '.': 'lookup',
    ',': 'comma',
  };
  const multiCharTokenStarts = [
    { pattern: startNamePattern, chomp: lexName },
    { pattern: /^[0-9]$/, chomp: lexNumber },
    { pattern: /^"$/, chomp: lexString },
    { pattern: /^\s$/, chomp: chompWhitespace },
    { pattern: /^[=<>+\-*/%&|^!~]$/, chomp: lexOp },
  ];

  let next = yield [];
  let moreTokens = [];
  outer: while (next) {
    if (singleCharTokens[next]) {
      const token = { [singleCharTokens[next]]: next, inputLength: 1 };
      next = yield [...moreTokens, token];
      moreTokens = [];
      continue;
    } else {
      for (const { pattern, chomp } of multiCharTokenStarts) {
        if (next.match(pattern)) {
          const { nextChar, leftOverTokens } = yield* chomp(moreTokens, next);
          next = nextChar;
          moreTokens = leftOverTokens;
          continue outer;
        }
      }
    }
    throw new Error(`don't know what to do with '${next}'`);
  }
  yield moreTokens;
}

export const lexFormula = (input, includeWhitespace = false) => {
  if (input[0] === "'") return [{ value: input.slice(1) }];
  const ret = [];
  const gen = generatorLex();
  // EOF might result in a dangling token getting returned :-)
  [null, ...input, null].forEach((c) => {
    const next = gen.next(c);
    // console.log(next);
    next.value.forEach((token) => {
      if (includeWhitespace || !token.whitespace) ret.push(token);
    });
  });
  return ret;
};
