import store, { ARRAY, OBJECT, SHEET, TABLE, TABLE_COLUMN, TABLE_ROW } from '../../redux/store';
import { lexFormula } from './lexer';

import {
  getContextIdForRefId,
  getRefsById,
  getRefsByNameForContextId,
  getSheetsByName,
  refIdParentId,
  refParentId,
  translateExpr,
} from './selectors';

import { binaryPrecedences, assocRight } from './builtins';

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
      const {
        term: expression,
        newIndex: expressionIndex,
      } = parseExpression(tokens, i + 1);
      if (
        !tokens[expressionIndex] ||
        !tokens[expressionIndex].closeBracket
      ) {
        throw new Error('Missing close bracket after index expression');
      }
      const termSoFar = { lookupIndex: expression, on: lookupObj };
      return parseLookups(tokens, expressionIndex + 1, termSoFar);
    }
  }
  return { term: lookupObj, newIndex: i };
};


const parseArgsList = (tokens, i) => {
  if (tokens[i].close) {
    return {
      term: [],
      newIndex: i + 1,
    };
  }
  const argsList = [];
  for (let j = i; j < tokens.length; ++j) {
    if (!tokens[j].name) {
      throw new Error('Expected name at start of argument');
    }
    const {
      term: lookups,
      newIndex: eqIndex,
    } = parseLookups(tokens, j + 1, tokens[j]);
    if (eqIndex === tokens.length || !tokens[eqIndex].assignment) {
      throw new Error('Expected assignment in argument');
    }
    if (eqIndex + 1 === tokens.length) {
      throw new Error('Expected expression after equals in argument');
    }
    const {
      term: expression,
      newIndex: expressionIndex,
    } = parseExpression(tokens, eqIndex + 1);
    argsList.push({
      ref: lookups,
      expr: expression,
    });
    if (expressionIndex === tokens.length) {
      throw new Error('Expected more after experssion in args list');
    }

    if (tokens[expressionIndex].close) {
      return {
        term: argsList,
        newIndex: expressionIndex + 1,
      };
    }
    if (!tokens[expressionIndex].comma) {
      throw new Error('Expected comma or bracket in args list');
    }
    j = expressionIndex;
  }
  throw new Error('Expected more in args list');
};


const parseTermFromName = (tokens, i) => {
  const { term, newIndex } = parseLookups(tokens, i + 1, tokens[i]);
  const nextToken = tokens[newIndex];
  if (
    nextToken === undefined ||
    nextToken.op ||
    nextToken.close ||
    nextToken.comma ||
    nextToken.closeBracket
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
      args: argsData.term,
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
    tokens[newIndex].closeBracket
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

const subNamesForRefsInName = (term, contextId) => {
  // Check cols in table, cells in sheet.
  let thisContextId = contextId;
  while (thisContextId) {
    const maybeMyRef = getRefsByNameForContextId(
      store.getState(),
      thisContextId,
    )[term.name];
    if (maybeMyRef) return { ref: maybeMyRef.id };
    thisContextId = getContextIdForRefId(refIdParentId(thisContextId));
  }

  // Check sheets in book
  const maybeSheet = getSheetsByName(store.getState())[term.name];
  if (maybeSheet) {
    return { ref: maybeSheet.id };
  }

  // Bad ref. Assume it's local so we can try to rewire it in the future.
  return { lookup: term.name, on: { ref: contextId } };
};

const subNamesForRefsInLookup = (term) => {
  // This turns "tableRef.cellName" into "cellRef" etc.
  if (!term.on.ref) return term;
  const { ref: refId } = term.on;
  const ref = getRefsById(store.getState())[refId];

  if (ref.type === SHEET || ref.type === OBJECT || ref.type === TABLE || ref.type === TABLE_ROW) {
    const maybeCell = getRefsByNameForContextId(store.getState(), refId)[term.lookup];
    if (maybeCell) return { ref: maybeCell.id };
  }
  return term;
};

const subNamesForRefsInLookupIndex = (term) => {
  // This turns "arrayRef[arrIndex]" into "arrayCellRef" etc.
  if (!term.on.ref) return term;
  if (!('value' in term.lookupIndex)) return term;
  const index = term.lookupIndex.value;
  if (typeof index !== 'number') return term;

  const { ref: refId } = term.on;
  const ref = getRefsById(store.getState())[refId];

  if (ref.type === ARRAY || ref.type === TABLE || ref.type === TABLE_COLUMN) {
    const maybeCell = getRefsByNameForContextId(store.getState(), refId)[index];
    if (maybeCell) return { ref: maybeCell.id };
  }
  return term;
};

export const subNamesForRefsInTerm = (term, contextId) => {
  if (term.name) return subNamesForRefsInName(term, contextId);
  if (term.lookup) return subNamesForRefsInLookup(term);
  if (term.lookupIndex) return subNamesForRefsInLookupIndex(term);
  if (term.call) {
    const argRefs = term.args.map(({ ref }) => ref);
    if ([term.call, ...argRefs].some(({ lookup }) => lookup)) {
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

const postProcessFormula = (nameFormula, contextId) => {
  if (!nameFormula) return {};
  const refFormula = translateExpr(nameFormula, contextId, subNamesForRefsInTerm);
  const precedenceFormula = translateExpr(refFormula, null, fixPrecedence);
  return { formula: precedenceFormula };
};

const parseFormulaExpr = (tokens, formulaStart, contextId, s) => {
  try {
    return {
      ...postProcessFormula(parseTokens(tokens, formulaStart), contextId),
    };
  } catch (e) {
    // Bad formula, but we might at least have a name. Stick everything
    // after the `=` symbol (if one exists) into the badFormula attr.
    const formulaStr = (formulaStart === 0) ? s : s.slice(s.indexOf('=') + 1);
    return {
      formula: { badFormula: formulaStr.trim() },
    };
  }
};

export const parseFormula = (s, contextId) => {
  try {
    const tokens = lexFormula(s);
    const { formulaStart, formulaName } = getNameFromTokens(tokens);
    return {
      ...formulaName,
      ...parseFormulaExpr(tokens, formulaStart, contextId, s),
    };
  } catch (e) {
    // Really bad -- can't lex or get a name... Formula is totally
    // broken.
    return { formula: { badFormula: s } };
  }
};
