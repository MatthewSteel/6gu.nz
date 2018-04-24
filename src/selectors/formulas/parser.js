import store, { SHEET } from '../../redux/store';
import { lexFormula } from './lexer';

import {
  getContextIdForRefId,
  getRefsById,
  getRefsByNameForContextId,
  getSheetsByName,
  refParentId,
  translateExpr,
} from './selectors';

// A recursive-descent parser.

const parseOperators = (tokens, i) => {
  if (!tokens[i].op) {
    throw new Error('Expected a binary operator somewhere');
  }
  let j;
  for ( // any number of unary pluses and minuses after first binary op
    j = i + 1;
    j < tokens.length && tokens[j].op && '+-'.includes(tokens[j].op);
    ++j
  );
  return tokens.slice(i, j);
};

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
  if (tokens[i].open) {
    const { term, newIndex } = parseExpression(tokens, i + 1);
    if (!tokens[newIndex] || !tokens[newIndex].close) {
      throw new Error('Expected closing bracket');
    }
    return {
      term: { expression: term },
      newIndex: newIndex + 1,
    };
  }
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
  const elements = [];
  for (let j = i; j < tokens.length; ++j) {
    // Precondition: We should be looking at the start of a term.
    const { term, newIndex } = parseTerm(tokens, j);
    elements.push(term);
    j = newIndex;
    if (j === tokens.length || tokens[j].close || tokens[j].comma || tokens[j].closeBracket) {
      return {
        term: elements,
        newIndex: j,
      };
    }
    parseOperators(tokens, j).forEach((op) => {
      elements.push(op);
    });
  }
  throw new Error('Unexpected end of expression');
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
const subNamesForRefsInName = (term, contextId) => {
  // Check cols in table, cells in sheet.
  let thisContextId = contextId;
  while (thisContextId) {
    const maybeMyRef = getRefsByNameForContextId(
      store.getState(),
      thisContextId,
    )[term.name];
    if (maybeMyRef) return { ref: maybeMyRef.id };
    thisContextId = getContextIdForRefId(refParentId(thisContextId));
  }

  // Check sheets in book
  const maybeSheet = getSheetsByName(store.getState())[term.name];
  if (maybeSheet) {
    return { ref: maybeSheet.id };
  }

  return term; // bad ref
};

const subNamesForRefsInLookup = (term) => {
  // This turns "tableRef.cellName" into "cellRef" etc.
  // Should do colRef[index] too.
  if (!term.on.ref) return term;
  const { ref: refId } = term.on;
  const ref = getRefsById(store.getState())[refId];
  if (ref.type === SHEET) {
    const maybeCell = getRefsByNameForContextId(store.getState(), refId)[term.lookup];
    if (maybeCell) {
      return { ref: maybeCell.id };
    }
  }
  return term;
};

const subNamesForRefsInTerm = (term, contextId) => {
  if (term.name) return subNamesForRefsInName(term, contextId);
  if (term.lookup) return subNamesForRefsInLookup(term);
  if (term.call) {
    const argRefs = term.args.map(({ ref }) => ref);
    if ([term.call, ...argRefs].some(({ lookup }) => lookup)) {
      throw new Error('Got a field ref when we just want a cell ref.');
    }
  }
  return term;
};

const subNamesForRefs = (nameFormula, contextId) => {
  if (!nameFormula) return {};
  return { formula: translateExpr(nameFormula, contextId, subNamesForRefsInTerm) };
};

const parseFormulaExpr = (tokens, formulaStart, contextId, s) => {
  try {
    return {
      ...subNamesForRefs(parseTokens(tokens, formulaStart), contextId),
    };
  } catch (e) {
    // Bad formula, but we might at least have a name. Stick everything
    // after the `=` symbol (if one exists) into the badFormula attr.
    const formulaStr = (formulaStart === 0) ? s : s.slice(s.indexOf('=') + 1);
    return {
      formula: [{
        badFormula: formulaStr.trim(),
      }],
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
    return { formula: [{ badFormula: s }] };
  }
};
