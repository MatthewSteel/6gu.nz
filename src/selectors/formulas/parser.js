import store from '../../redux/store';
import { lexFormula } from './lexer';

import {
  getCellsByNameForSheetId,
  getSheetsByName,
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
  const ret = { ...lookupObj };
  let lastToken = ret;
  let j;
  for (j = i + 1; j < tokens.length && tokens[j].lookup; j += 2) {
    if (j + 1 === tokens.length || !tokens[j + 1].name) {
      throw new Error('Expected name to be looked up');
    }
    lastToken.lookup = { ...tokens[j + 1] };
    lastToken = tokens[j + 1];
  }
  return {
    term: ret,
    newIndex: j,
  };
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
    } = parseLookups(tokens, j, tokens[j]);
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
  const { term, newIndex } = parseLookups(tokens, i, tokens[i]);
  const nextToken = tokens[newIndex];
  if (nextToken === undefined || nextToken.op || nextToken.close || nextToken.comma) {
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
    const finalExpr = parseLookups(tokens, argsData.newIndex - 1, callTerm);
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
    if (j === tokens.length || tokens[j].close || tokens[j].comma) {
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
const subNamesForRefsInName = (term, sheetId) => {
  // Three cases:
  // 1. It's the name of a cell in our sheet. Make a straight ref.
  // 2. It's the name of another sheet. Make a straight ref.
  // 3. It's a cell looked up on another sheet. Make a ref to it.
  // Any further lookups are made by name -- no translations.
  const mySheetCellsByName = getCellsByNameForSheetId(
    store.getState(),
    sheetId,
  );
  const maybeMyCell = mySheetCellsByName[term.name];

  const sheetsByName = getSheetsByName(store.getState());
  const maybeThatSheet = sheetsByName[term.name];

  let eventualRef = term.name; // a bad reference if not replaced
  let eventualLookup = term.lookup;
  if (maybeMyCell) {
    eventualRef = maybeMyCell.id;
  } else if (maybeThatSheet) {
    if (!term.lookup) {
      // Just `=sheet`, not `=sheet.cell`
      eventualRef = maybeThatSheet.id;
    } else {
      // `=sheet.cell`, we hope
      const thatSheetCellsByName = getCellsByNameForSheetId(
        store.getState(),
        maybeThatSheet.id,
      );
      const thatCell = thatSheetCellsByName[term.lookup.name];
      if (thatCell) {
        eventualRef = thatCell.id;
        eventualLookup = thatCell.lookup;
      }
    }
  }
  return {
    lookup: eventualLookup,
    ref: eventualRef,
  };
};

const subNamesForRefsInTerm = (term, sheetId) => {
  if (term.name) return subNamesForRefsInName(term, sheetId);
  if (term.call) {
    const argRefs = term.args.map(({ ref }) => ref);
    if ([term.call, ...argRefs].some(({ lookup }) => lookup)) {
      throw new Error('Got a field ref when we just want a cell ref.');
    }
  }
  return term;
};

const subNamesForRefs = (nameFormula, sheetId) => {
  if (!nameFormula) return {};
  return { formula: translateExpr(nameFormula, sheetId, subNamesForRefsInTerm) };
};

const parseFormulaExpr = (tokens, formulaStart, sheetId, s) => {
  try {
    return {
      ...subNamesForRefs(parseTokens(tokens, formulaStart), sheetId),
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

export const parseFormula = (s, sheetId) => {
  try {
    const tokens = lexFormula(s);
    const { formulaStart, formulaName } = getNameFromTokens(tokens);
    return {
      ...formulaName,
      ...parseFormulaExpr(tokens, formulaStart, sheetId, s),
    };
  } catch (e) {
    // Really bad -- can't lex or get a name... Formula is totally
    // broken.
    return { formula: [{ badFormula: s }] };
  }
};
