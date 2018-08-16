import { canStartName, isNameChar } from './lexer';
import { pkColIdForExpr } from './parser';
import {
  getRefsById,
  getContextIdForRefId,
  lookupExpression,
  refParentId,
  runTranslations,
  translateExpr,
} from './selectors';

// Turning a stored raw formula back into a string.

export const unlexName = (name) => {
  const toJoin = [];
  for (let i = 0; i < name.length; ++i) {
    const character = name[i];
    if (i === 0 && !canStartName(character)) {
      toJoin.push('\\');
    }
    if (i > 0 && !isNameChar(character)) {
      toJoin.push('\\');
    }
    toJoin.push(character);
  }
  return toJoin.join('');
};

const unlexRef = (id, state) => {
  const ref = getRefsById(state)[id];
  if (!ref || !ref.name) throw new Error('ugh');
  return unlexName(ref.name);
};

export const unlexToken = state => (token) => {
  if (token.expanded) {
    return translateExpr(token.expanded, state, unparseTerm)
      .map(unlexToken(state)).join('');
  }
  if (token.ref) return unlexRef(token.ref, state);
  if (token.name) return unlexName(token.name);
  if (token.value) return JSON.stringify(token.value);
  const values = Object.values(token);
  if (values.length !== 1) {
    // Just tokens like { op: '+' } and { whitespace: ' ' } etc.
    throw new Error(`Weird token ${JSON.stringify(token)}`);
  }
  return values[0];
};

const unparseObject = (object, state) => {
  if (object.length === 0) return [{ openBrace: '{' }, { closeBrace: '}' }];

  const elems = object.map(({ key, value }) => {
    if (value.length === 1 && value[0].ref) {
      const ref = getRefsById(state)[value[0].ref];
      if (ref.name && ref.name === key) return value;
    }
    return [key, { comma: ',' }, { whitespace: ' ' }, ...value];
  });

  return [
    { openBrace: '{' },
    { whitespace: ' ' },
    ...join(elems),
    { whitespace: ' ' },
    { closeBrace: '}' },
  ];
};

const unparseLookupIndex = term => [
  ...term.on,
  { openBracket: '[' },
  ...term.lookupIndex,
  { closeBracket: ']' },
];

const makeArrows = (term, contextId, state) => {
  // Turns A[pkCol :: B] into B->A.
  const { lookupIndex, on } = term;
  if (!lookupIndex) return term;
  const { left, right, binary } = lookupIndex;
  if (binary !== '::') return term;
  const pkColId = pkColIdForExpr(right, state);
  if (!pkColId || left.ref !== pkColId) return term;
  return { binary: '->', right: on, left: right };
};

const join = (seq) => {
  const ret = [];
  seq.forEach((elem, i) => {
    if (i !== 0) {
      ret.push(...[{ comma: ',' }, { whitespace: ' ' }]);
    }
    ret.push(...elem);
  });
  return ret;
};

const unparseCall = (term) => {
  const argsList = [
    ...term.args,
    ...term.kwargs.map(({ ref, expr }) => [
      ...ref, { assignment: ':' }, { whitespace: ' ' }, ...expr,
    ]),
  ];
  return [
    ...term.call,
    { open: '(' },
    ...join(argsList),
    { close: ')' },
  ];
};

const unparseBinary = (term) => {
  if (term.binary === '->') {
    return [...term.left, { op: term.binary }, ...term.right];
  }
  return [
    ...term.left,
    { whitespace: (term.binary === '->') ? '' : ' ' },
    { op: term.binary },
    { whitespace: (term.binary === '->') ? '' : ' ' },
    ...term.right,
  ];
};

const unparseArray = term => [
  { openBracket: '[' },
  ...join(term.array),
  { closeBracket: ']' },
];

export const unparseTerm = (term, contextId, state) => {
  if (term.lookup) return [...term.on, { lookup: '.' }, { name: term.lookup }];
  if (term.lookupIndex) return unparseLookupIndex(term, state);
  if (term.call) return unparseCall(term);
  if (term.expression) {
    return [{ open: '(' }, ...term.expression, { close: ')' }];
  }
  if (term.unary) return [{ op: term.unary }, ...term.on];
  if (term.binary) return unparseBinary(term);
  if (term.array) return unparseArray(term);
  if (term.object) return unparseObject(term.object, state);
  if (term.ref || term.name || term.badFormula || 'value' in term) {
    return [term];
  }
  throw new Error('Unknown term type');
};

const subRefsForLookupsInTerm = (term, contextId, state) => {
  if (!term.ref) return term;
  const expanded = lookupExpression(getRefsById(state), contextId, term.ref);
  // Add some data for later use -- for refs like `Table[0].foo` we add
  //   { lookup: 'foo', on: { lookupIndex: { value: 10 }, on: {...} } }.
  return { ...term, expanded };
};

export const unparseFormula = (formula, context, state) => {
  if (!formula) return [];
  return runTranslations(
    formula,
    getContextIdForRefId(getRefsById(state), context, context),
    state,
    [makeArrows, subRefsForLookupsInTerm, unparseTerm],
  );
};

export const unparseRefFormula = (ref, state) => {
  const refParent = refParentId(ref);
  const tokens = unparseFormula(ref.formula, refParent, state);

  if (!ref.name) return tokens;
  return [
    { name: ref.name },
    { assignment: ':' },
    { whitespace: ' ' },
    ...tokens,
  ];
};

export const stringFormula = (state, refId) => {
  const ref = getRefsById(state)[refId];
  if (!ref) return '';
  return unparseRefFormula(ref, state).map(unlexToken(state)).join('');
};
