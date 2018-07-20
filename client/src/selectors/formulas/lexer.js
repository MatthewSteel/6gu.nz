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
  let nextCharEscaped = false;
  while (nextChar && (nextCharEscaped || isNameChar(nextChar))) {
    if (nextChar === '\\' && !nextCharEscaped) {
      nextCharEscaped = true;
    } else {
      chars.push(nextChar);
      nextCharEscaped = false;
    }
    nextChar = yield leftOverTokens;
    leftOverTokens = [];
  }
  const str = chars.join('');
  const token = literalValues.has(str)
    ? { value: JSON.parse(str) }
    : { name: str };
  return { nextChar, leftOverTokens: [token] };
}

function* lexNumber(prevLeftOverTokens, firstChar) {
  const chars = [];
  let nextChar = firstChar;
  let leftOverTokens = prevLeftOverTokens;
  while (nextChar && nextChar.match(/^[0-9.]$/)) {
    chars.push(nextChar);
    nextChar = yield leftOverTokens;
    leftOverTokens = [];
  }
  const token = { value: JSON.parse(chars.join('')) };
  return { nextChar, leftOverTokens: [token] };
}

function* lexString(prevLeftOverTokens) {
  let next = yield prevLeftOverTokens;
  const chars = ['"'];
  let charEscaped = false;
  while (next) {
    chars.push(next);
    if (next === '"' && !charEscaped) {
      const nextChar = yield [{ value: JSON.parse(chars.join('')) }];
      return { nextChar, leftOverTokens: [] };
    }
    next = yield [];
    charEscaped = next === '\\';
  }
  throw new Error('Unterminated string');
}


function* chompWhitespace(prevLeftOverTokens, firstChar) {
  let nextChar = firstChar;
  let leftOverTokens = prevLeftOverTokens;
  while (nextChar && nextChar.match(/^\s$/)) {
    nextChar = yield leftOverTokens;
    leftOverTokens = [];
  }
  return { nextChar, leftOverTokens };
}


const twoCharOps = new Set(['**', '>=', '<=', '>>', '<<', '&&', '||', '!=']);
const twoCharOpPrefixes = new Set([...twoCharOps].map(([c]) => c));

function* lexOp(prevLeftOverTokens, firstChar) {
  if (!twoCharOpPrefixes.has(firstChar)) {
    const nextChar = yield [...prevLeftOverTokens, { op: firstChar }];
    return { nextChar, leftOverTokens: [] };
  }
  const secondChar = yield prevLeftOverTokens;
  const maybeTwoCharOp = firstChar + secondChar;
  if (secondChar && twoCharOps.has(maybeTwoCharOp)) {
    const nextChar = yield [{ op: maybeTwoCharOp }];
    return { nextChar, leftOverTokens: [] };
  }
  return { nextChar: secondChar, leftOverTokens: [{ op: firstChar }] };
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
      next = yield [...moreTokens, { [singleCharTokens[next]]: next }];
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

export const lexFormula = (input) => {
  if (input[0] === "'") return [{ value: input.slice(1) }];
  const ret = [];
  const gen = generatorLex();
  // EOF might result in a dangling token getting returned :-)
  [null, ...input, null].forEach((c) => {
    const next = gen.next(c);
    // console.log(next);
    next.value.forEach((token) => { ret.push(token); });
  });
  return ret;
};
