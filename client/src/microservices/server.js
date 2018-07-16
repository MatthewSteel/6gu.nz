import http from 'http';
import url from 'url';
import fs from 'fs';

import { lexFormula } from '../selectors/formulas/lexer';
import { parseTermFromName, subNamesForRefsInTerm } from '../selectors/formulas/parser';
import { translateExpr } from '../selectors/formulas/selectors';
import { fromJson1, toJson1 } from '../selectors/formulas/builtins';
import store from '../redux/store';
import { callSignature, createFunction, expandUserCall, getCellValuesById, getRefExpressions } from '../selectors/formulas/codegen';

const openDocument = JSON.parse(fs.readFileSync(
  process.env.FILENAME,
  { encoding: 'utf8' },
)).maybeRecentDocument;
store.dispatch({ type: 'USER_STATE', payload: { openDocument } });
const globals = getCellValuesById(store.getState());

const parseName = (name, context = undefined) => {
  const tokens = lexFormula(name);
  const expr = parseTermFromName(tokens, 0).term;
  const ref = translateExpr(
    expr,
    context,
    store.getState(),
    subNamesForRefsInTerm,
  );
  if (!ref.ref) {
    throw new Error(`Reference to ${name} did not resolve.`);
  }
  return ref;
};

const server = http.createServer((request, response) => {
  let signature;
  let haveFn = true;
  try {
    const requestUrl = request.url;
    const { query, pathname } = url.parse(requestUrl, true);
    const call = parseName(pathname.slice(1)); // starts with '/'

    const kwargs = Object.entries(query).map(([k, v]) => {
      const ref = parseName(k, call.ref);
      const expr = { value: fromJson1(v) };
      return { ref, expr };
    });
    const callTerm = { call, args: [], kwargs };
    signature = callSignature(callTerm);
    haveFn = signature in globals;
    if (!haveFn) { // :-(
      const refExpressions = getRefExpressions(store.getState());
      globals[signature] = createFunction(callTerm, refExpressions);
    }

    const ret = toJson1(eval(expandUserCall(callTerm)));

    response.statusCode = 200;
    response.end(ret);
  } catch (e) {
    response.statusCode = 500;
    response.end(e.toString());
  } finally {
    // Eh, not really necessary...
    if (!haveFn) delete globals[signature];
  }
});

server.listen(5010);
