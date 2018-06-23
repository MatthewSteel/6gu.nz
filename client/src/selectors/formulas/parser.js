import { ARRAY, OBJECT, SHEET, TABLE, COMPUTED_TABLE_COLUMN, TABLE_COLUMN, TABLE_ROW } from '../../redux/stateConstants';
import { lexFormula } from './lexer';

import {
  getContextIdForRefId,
  getRefsById,
  getRefsByNameForContextId,
  getSheetsByName,
  refParentId,
  runTranslations,
} from './selectors';

import { binaryPrecedences, assocRight, globalFunctions, globalFunctionArgs } from './builtins';

// A recursive-descent parser.

const parseLookups = (tokens, i, lookupObj) => {
  if (tokens[i]) {
    const nextToken = tokens[i];
    if (nextToken.lookup) {
      if (!tokens[i + 1] || !tokens[i + 1].name) {
        throw new Error('Expected name to be looked up');
      }
      const termSoFar = { lookup: tokens[i + 1].name, on: lookupObj };
      return parseLookups(tokens, i + 2, termSoFar);
    }
    if (nextToken.openBracket) {
      let termSoFar;
      let nextIndex;
      if (tokens[i + 2] && tokens[i + 1].name && tokens[i + 2].assignment) {
        const {
          term: expression,
          newIndex: expressionIndex,
        } = parseExpression(tokens, i + 3);
        termSoFar = {
          indexLookup: expression,
          keyCol: { lookup: tokens[i + 1].name, on: lookupObj },
          on: lookupObj,
        };
        nextIndex = expressionIndex + 1;
      } else {
        const {
          term: expression,
          newIndex: expressionIndex,
        } = parseExpression(tokens, i + 1);
        termSoFar = { lookupIndex: expression, on: lookupObj };
        nextIndex = expressionIndex + 1;
      }
      if (!tokens[nextIndex - 1].closeBracket) {
        throw new Error('Missing close bracket after index expression');
      }
      return parseLookups(tokens, nextIndex, termSoFar);
    }
  }
  return { term: lookupObj, newIndex: i };
};


const parseKwarg = (tokens, i) => {
  if (!tokens[i].name) {
    throw new Error('Expected name at start of argument');
  }
  const {
    term: lookups,
    newIndex: eqIndex,
  } = parseLookups(tokens, i + 1, tokens[i]);
  if (!tokens[eqIndex].assignment) {
    throw new Error('Expected assignment in argument');
  }
  const {
    term: expression,
    newIndex: exprIndex,
  } = parseExpression(tokens, eqIndex + 1);
  const ret = {
    term: { ref: lookups, expr: expression },
    newIndex: exprIndex,
  };

  if (!tokens[exprIndex].close && !tokens[exprIndex].comma) {
    throw new Error('Expected ")" or "," after keyword arg.');
  }
  return ret;
};


const parseArgsList = (tokens, i) => {
  if (tokens[i].close) {
    return {
      term: { args: [], kwargs: [] },
      newIndex: i + 1,
    };
  }
  const args = [];
  const kwargs = [];
  let parsedKwarg = false;
  for (let j = i; j < tokens.length; ++j) {
    // TODO
    try {
      const { term, newIndex } = parseKwarg(tokens, j);
      parsedKwarg = true;
      kwargs.push(term);
      j = newIndex;
    } catch (e) {
      if (parsedKwarg) throw e;
      const { term, newIndex } = parseExpression(tokens, j);
      args.push(term);
      j = newIndex;
    }
    if (tokens[j].close) {
      return {
        term: { args, kwargs },
        newIndex: j + 1,
      };
    }
    if (!tokens[j].comma) {
      throw new Error('Expected comma or bracket in args list');
    }
  }
  throw new Error('Expected more in args list');
};


export const parseTermFromName = (tokens, i) => {
  const { term, newIndex } = parseLookups(tokens, i + 1, tokens[i]);
  const nextToken = tokens[newIndex];
  if (
    nextToken === undefined ||
    nextToken.op ||
    nextToken.close ||
    nextToken.comma ||
    nextToken.closeBracket ||
    nextToken.closeBrace
  ) {
    return {
      term,
      newIndex,
    };
  }
  if (nextToken.open) {
    if (newIndex + 1 === tokens.length) {
      throw new Error("Formula can't end with the start of a call");
    }
    const argsData = parseArgsList(tokens, newIndex + 1);
    const callTerm = {
      call: term,
      ...argsData.term,
    };
    const finalExpr = parseLookups(tokens, argsData.newIndex, callTerm);
    return {
      term: finalExpr.term,
      newIndex: finalExpr.newIndex,
    };
  }
  throw new Error('Unexpected token after name.');
};

const parseTerm = (tokens, i) => {
  if ('+-!~'.includes(tokens[i].op)) {
    const innerTerm = parseTerm(tokens, i + 1);
    return {
      term: { unary: tokens[i].op, on: innerTerm.term },
      newIndex: innerTerm.newIndex,
    };
  }
  if (tokens[i].open) {
    const { term, newIndex } = parseExpression(tokens, i + 1);
    if (!tokens[newIndex] || !tokens[newIndex].close) {
      throw new Error('Expected closing bracket');
    }
    return parseLookups(tokens, newIndex + 1, { expression: term });
  }
  if (tokens[i].openBracket) return parseArray(tokens, i + 1);
  if (tokens[i].openBrace) return parseObject(tokens, i + 1);
  if ('value' in tokens[i]) {
    return {
      term: tokens[i],
      newIndex: i + 1,
    };
  }
  if (tokens[i].name) {
    return parseTermFromName(tokens, i);
  }
  throw new Error('Unexpected term token');
};

const parseExpression = (tokens, i) => {
  const { term, newIndex } = parseTerm(tokens, i);
  if (
    newIndex === tokens.length ||
    tokens[newIndex].close ||
    tokens[newIndex].comma ||
    tokens[newIndex].closeBracket ||
    tokens[newIndex].closeBrace
  ) {
    return { term, newIndex };
  }
  if (tokens[newIndex].op) {
    const rightParse = parseExpression(tokens, newIndex + 1);
    return {
      term: {
        binary: tokens[newIndex].op,
        left: term,
        right: rightParse.term,
      },
      newIndex: rightParse.newIndex,
    };
  }
  throw new Error('Unexpected end of expression');
};

const parseArray = (tokens, i) => {
  const array = [];
  let j = i;
  while (!tokens[j].closeBracket) {
    // could detect "extra" commas here, but not sure what to do with them.
    const { term, newIndex } = parseExpression(tokens, j);
    array.push(term);
    if (tokens[newIndex].comma) {
      j = newIndex + 1;
      continue;
    }
    if (!tokens[newIndex].closeBracket) {
      throw new Error('Unexpected character in array');
    }
    j = newIndex;
  }

  return parseLookups(tokens, j + 1, { array });
};

const parseObject = (tokens, i) => {
  // { name1, value(call=foo).name2 }
  //  --> { name1: name1, name2: value(call=foo).name2 }
  const object = [];
  let j = i;
  while (!tokens[j].closeBrace) {
    let nextIndex;
    const maybeKey = tokens[j].name || tokens[j].value;
    if (typeof maybeKey === 'string' && tokens[j + 1].assignment) {
      const { term, newIndex } = parseExpression(tokens, j + 2);
      nextIndex = newIndex;
      object.push({ key: maybeKey, value: term });
    } else {
      const { term, newIndex } = parseTerm(tokens, j);
      nextIndex = newIndex;
      if (term.name) {
        object.push({ key: term.name, value: term });
      } else if (term.lookup) {
        object.push({ key: term.lookup, value: term });
      } else {
        throw new Error('Single object terms must be either names or lookups');
      }
    }
    if (tokens[nextIndex].comma) {
      j = nextIndex + 1;
      continue;
    }
    if (!tokens[nextIndex].closeBrace) {
      throw new Error('Unexpected character in object');
    }
    j = nextIndex;
  }

  return parseLookups(tokens, j + 1, { object });
};

export const parseTokens = (tokens, start) => {
  // There are two legal forms for formulas
  //  1. name? = expression?
  //  2. expression
  if (start === tokens.length) return undefined;
  const { term, newIndex } = parseExpression(tokens, start);
  if (newIndex !== tokens.length) {
    throw new Error('Unchomped tokens at end of forumla');
  }
  return term;
};

const getNameFromTokens = (tokens) => {
  if (tokens[0] && tokens[0].assignment) {
    return { formulaStart: 1, formulaName: {} };
  }
  if (tokens[1] && tokens[1].assignment) {
    if (!tokens[0].name) {
      throw new Error('Can only assign to a name');
    }
    return { formulaStart: 2, formulaName: { name: tokens[0].name } };
  }
  return { formulaStart: 0, formulaName: {} };
};


// Post-processing: turn string names into refs. Hopefully in the future
// a good ref-suggestion tab-completion engine will avoid us having to
// rely on this so much.

export const translateLookups = (newRefs) => {
  const newRefsByParentId = {};
  newRefs.forEach((newRef) => {
    const parentId = refParentId(newRef);
    if (!newRefsByParentId[parentId]) newRefsByParentId[parentId] = {};

    const { name, id, index } = newRef;
    if (name) newRefsByParentId[parentId][name] = id;
    if (index !== undefined) newRefsByParentId[parentId][index] = id;
  });

  return (existingTerm) => {
    // D'oh, we can't run `subNamesFor...` in reducers because everything
    // relies on selectors which are built on the global (previous) state.
    // FIXME.
    if (!existingTerm.on || !newRefsByParentId[existingTerm.on.ref]) {
      return existingTerm;
    }
    const newRefsByName = newRefsByParentId[existingTerm.on.ref];
    if (newRefsByName[existingTerm.lookup]) {
      return { ref: newRefsByName[existingTerm.lookup] };
    }
    if (
      'lookupIndex' in existingTerm &&
      newRefsByName[existingTerm.lookupIndex.value]
    ) {
      return { ref: newRefsByName[existingTerm.lookupIndex.value] };
    }
    return existingTerm;
  };
};

const subNamesForRefsInName = (term, contextId, state) => {
  // Check cols in table, cells in sheet.
  let thisContextId = contextId;
  while (thisContextId) {
    const maybeMyRef = getRefsByNameForContextId(
      state,
      thisContextId,
    )[term.name];
    if (maybeMyRef) return { ref: maybeMyRef.id };
    const refsById = getRefsById(state);
    thisContextId = getContextIdForRefId(
      refsById,
      refParentId(refsById[thisContextId]),
    );
  }

  // Check sheets in book
  const maybeSheet = getSheetsByName(state)[term.name];
  if (maybeSheet) {
    return { ref: maybeSheet.id };
  }

  if (term.name in globalFunctions) return term;
  if (contextId in globalFunctions && globalFunctionArgs[contextId].has(term.name)) {
    return term;
  }

  // Bad ref. Assume it's local so we can try to rewire it in the future.
  return { lookup: term.name, on: { ref: contextId } };
};

const subNamesForRefsInLookup = (term, state) => {
  // This turns "tableRef.cellName" into "cellRef" etc.

  if (!term.on.ref) return term;
  const refsById = getRefsById(state);
  const { ref: refId } = term.on;
  const ref = refsById[refId];

  if (ref.type === SHEET || ref.type === OBJECT || ref.type === TABLE || ref.type === TABLE_ROW) {
    const maybeCell = getRefsByNameForContextId(state, refId)[term.lookup];
    if (maybeCell) return { ref: maybeCell.id };
  }
  // We have some trouble with table[0].computedCol, it doesn't resolve.
  // Turn it into table.computedCol[0] :-)
  if (ref.type === TABLE_ROW) {
    const maybeCol = getRefsByNameForContextId(state, ref.tableId)[term.lookup];
    if (maybeCol && maybeCol.type === COMPUTED_TABLE_COLUMN) {
      return {
        lookupIndex: { value: ref.index },
        on: { ref: maybeCol.id },
      };
    }
  }

  return term;
};

const subNamesForRefsInLookupIndex = (term, state) => {
  // This turns "arrayRef[arrIndex]" into "arrayCellRef" etc.
  if (!term.on.ref) return term;
  if (!('value' in term.lookupIndex)) return term;
  const index = term.lookupIndex.value;
  if (typeof index !== 'number') return term;

  const { ref: refId } = term.on;
  const ref = getRefsById(state)[refId];

  if ([ARRAY, TABLE, TABLE_COLUMN, COMPUTED_TABLE_COLUMN].includes(ref.type)) {
    const maybeCell = getRefsByNameForContextId(state, refId)[index];
    if (maybeCell) return { ref: maybeCell.id };
  }
  return term;
};

export const subNamesForRefsInTerm = (term, contextId, state) => {
  if (term.name) return subNamesForRefsInName(term, contextId, state);
  if (term.lookup) return subNamesForRefsInLookup(term, state);
  if (term.lookupIndex) return subNamesForRefsInLookupIndex(term, state);
  if (term.call) {
    const argRefs = term.kwargs.map(({ ref }) => ref);
    if ([term.call, ...argRefs].some(({ lookup, lookupIndex }) => (
      lookup || lookupIndex))) {
      throw new Error('Got a field ref when we just want a cell ref.');
    }
  }
  return term;
};

const fixPrecedence = (term) => {
  if (!term.binary || !term.right.binary) return term;
  const other = term.right;
  const ourPrecedence = binaryPrecedences[term.binary];
  const otherPrecedence = binaryPrecedences[other.binary];
  if (
    ourPrecedence < otherPrecedence ||
    (ourPrecedence === otherPrecedence && assocRight.has(term.binary))
  ) return term;
  return { ...other, left: fixPrecedence({ ...term, right: other.left }) };
};

const translateIndexLookups = (term) => {
  // User types in `table[name: "Fred"].age` and it comes out of the
  // parser like
  //
  //   lookup: "age"
  //   on: {
  //     indexLookup: { value: "Fred" },
  //     on: { ref: table.id },
  //     keyCol: { lookup: "name", on: { ref: table.id } },
  //   }
  //
  // This function translates that to
  //
  //   indexLookup: { value: "Fred" },
  //   on: { lookup: "age", on: { ref: table.id } },
  //   keyCol: { lookup: "name", on: { ref: table.id } },
  //
  // In a later step we (hopefully) resolve the lookups into direct refs.
  // (We also do an inverse step in the unparser)
  if (term.lookup && term.on.indexLookup) {
    return { ...term.on, on: { ...term, on: term.on.on } };
  }
  return term;
};

const postProcessFormula = (nameFormula, contextId, state) => {
  if (!nameFormula) return {};
  return {
    formula: runTranslations(
      nameFormula,
      contextId,
      state,
      [translateIndexLookups, subNamesForRefsInTerm, fixPrecedence],
    ),
  };
};

const parseFormulaExpr = (tokens, formulaStart, contextId, s, state) => {
  try {
    return {
      ...postProcessFormula(parseTokens(tokens, formulaStart), contextId, state),
    };
  } catch (e) {
    // Bad formula, but we might at least have a name. Stick everything
    // after the `=` symbol (if one exists) into the badFormula attr.
    const formulaStr = (formulaStart === 0) ? s : s.slice(s.indexOf(':') + 1);
    return {
      formula: { badFormula: formulaStr.trim() },
    };
  }
};

export const parseFormula = (s, contextId, state) => {
  try {
    const tokens = lexFormula(s);
    const { formulaStart, formulaName } = getNameFromTokens(tokens);
    return {
      ...formulaName,
      ...parseFormulaExpr(tokens, formulaStart, contextId, s, state),
    };
  } catch (e) {
    // Really bad -- can't lex or get a name... Formula is totally
    // broken.
    return { formula: { badFormula: s } };
  }
};
