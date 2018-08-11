import { canStartName, isNameChar } from './lexer';
import { TABLE_CELL, TABLE_COLUMN_TYPES } from '../../redux/stateConstants';
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

const maybeArrowFromMaybeColumn = (term, state, pkCol) => {
  const refsById = getRefsById(state);
  let lookupName;
  const recurse = (innerTerm) => {
    // Given a term like `colRef[?][?]`, see if we can translate it into
    // tableRef[?][?]->colName if pkColId matches the column's FK.
    // Also: If we get `something[?]->colName.otherColName`, translate it into
    // `something->colName->otherColName`.
    if (innerTerm.lookupIndex) {
      return { ...innerTerm, on: recurse(innerTerm.on) };
    }
    let col, refWithoutLookup;
    if (innerTerm.fakeColRef) {
      // From an earlier arrow-translation
      col = refsById[innerTerm.fakeColRef];
      refWithoutLookup = innerTerm.on;
    } else if (innerTerm.ref) {
      const ref = refsById[innerTerm.ref];
      if (ref.type === TABLE_CELL) {
        col = refsById[ref.arrayId];
        refWithoutLookup = { ref: ref.objectId };
      } else if (TABLE_COLUMN_TYPES.includes(ref.type)) {
        col = ref;
        refWithoutLookup = { ref: ref.tableId };
      } else {
        return innerTerm;
      }
    } else {
      return innerTerm;
    }
    if (col.foreignKey !== pkCol.id) return innerTerm;
    lookupName = col.name;
    return refWithoutLookup;
  };
  const innerTerm = recurse(term.lookupIndex.right);
  if (!lookupName) return term;
  const arrowLookup = {
    lookup: lookupName,
    on: innerTerm,
    lookupType: '->',
  };
  if (term.on.ref === pkCol.tableId) return arrowLookup;
  const onRef = refsById[term.on.ref];
  return {
    lookup: onRef.name,
    lookupType: '.',
    on: arrowLookup,
    fakeColRef: term.on.ref,
  };
};

const makeArrows = (term, contextId, state) => {
  if (!term.lookupIndex) return term;
  if (term.lookupIndex.binary !== '::') return term;
  const { on } = term;
  const { left } = term.lookupIndex;
  if (!on.ref || !left.ref) return term;

  const refsById = getRefsById(state);
  const leftRef = refsById[left.ref];
  const onRef = refsById[on.ref];
  if (!TABLE_COLUMN_TYPES.includes(leftRef.type)) return term;
  if (![onRef.id, onRef.tableId].includes(leftRef.tableId)) return term;
  // OK! we know we have a table (or table-column) lookup. Finally. Now we
  // just need to make sure the RHS has an appropriate foreign-key relation
  // and then we can rewrite it as an arrow.
  return maybeArrowFromMaybeColumn(term, state, leftRef);
};

const unparseIndexLookup = term => [
  ...term.on,
  { openBracket: '[' },
  ...term.keyCol,
  { assignment: ':' },
  { whitespace: ' ' },
  ...term.indexLookup,
  { closeBracket: ']' },
];

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

const unparseBinary = term => [
  ...term.left,
  { whitespace: ' ' },
  { op: term.binary },
  { whitespace: ' ' },
  ...term.right,
];

const unparseArray = term => [
  { openBracket: '[' },
  ...join(term.array),
  { closeBracket: ']' },
];

export const unparseTerm = (term, contextId, state) => {
  if (term.lookup) {
    return [...term.on, { lookup: term.lookupType }, { name: term.lookup }];
  }
  if (term.lookupIndex) return unparseLookupIndex(term, state);
  if (term.indexLookup) return unparseIndexLookup(term);
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

const translateIndexLookupKeyCol = term => (
  // For a formula like Table[age: "Fred"].name
  // Turns
  //   indexLookup: { value: "Fred" },
  //   on: { lookup: "age", on: { ref: table.id } },
  //   keyCol: { lookup: "name", on: { ref: table.id } },
  // into
  //   indexLookup: { value: "Fred" },
  //   on: { lookup: "age", on: { ref: table.id } },
  //   keyCol: { name: "name" },
  { ...term, keyCol: { name: term.keyCol.expanded.lookup } });

const undoTranslateIndexLookups = (term) => {
  // For a formula like Table[name: "Fred"].age
  // Turns
  //   indexLookup: { value: "Fred" },
  //   keyCol: { lookup: "name", on: { ref: table.id } },
  //   on: { lookup: "age", on: { ref: table.id } },
  // into
  //   lookup: "age",
  //   on: {
  //     indexLookup: { value: "Fred" },
  //     keyCol: { lookup: "name", on: { ref: table.id } },
  //     on: { ref: table.id },
  //   },
  //  TODO: Consider just having formulas like
  //    Table.age[Table.name: "Fred"]
  //  instead. It's shorter now that we have a fancy formula box...
  if (term.indexLookup && term.on.expanded.lookup) {
    return {
      lookup: term.on.expanded.lookup,
      lookupType: '.',
      on: translateIndexLookupKeyCol({ ...term, on: term.on.expanded.on }),
    };
  }
  if (term.indexLookup) return translateIndexLookupKeyCol(term);
  return term;
};

export const unparseFormula = (formula, context, state) => {
  if (!formula) return [];
  const translations = [
    makeArrows,
    subRefsForLookupsInTerm,
    undoTranslateIndexLookups,
    unparseTerm,
  ];
  return runTranslations(
    formula,
    getContextIdForRefId(getRefsById(state), context, context),
    state,
    translations,
  );
};

export const unparseRefFormula = (ref, state) => {
  const refParent = refParentId(ref);
  const tokens = unparseFormula(ref.formula, refParent, state);

  if (!ref.name) return tokens;
  return [
    { name: unlexName(ref.name) },
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
