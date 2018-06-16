import { createStore } from 'redux';
import uuidv4 from 'uuid-v4';
import equal from 'fast-deep-equal';
import cookie from 'cookie';
import {
  getChildrenOfRef,
  getContextIdForRefId,
  getFormulaGraphs,
  getRefsById,
  getSheetsByName,
  refsAtPosition,
  refParentId,
  rewriteRefTermToParentLookup,
  transitiveChildren,
  translateExpr,
} from '../selectors/formulas/selectors';
import { digMut } from '../selectors/algorithms/algorithms';
import {
  parseFormula,
  translateLookups,
} from '../selectors/formulas/parser';
import { idealWidthAndHeight, DRAG_RESIZE } from '../selectors/geom/dragGeom';
import defaultCellName from '../selectors/formulas/defaultCellName';

export const SHEET = 'sheet';
export const CELL = 'cell';
export const ARRAY = 'array';
export const ARRAY_CELL = 'array_cell';
export const OBJECT = 'object';
export const OBJECT_CELL = 'object_cell';
export const TABLE = 'table';
export const TABLE_ROW = 'table_row';
export const TABLE_COLUMN = 'table_column';
export const COMPUTED_TABLE_COLUMN = 'computed_table_column';
export const TABLE_CELL = 'table_cell';

const DEFAULT_FORMULA = { value: '' };

const blankDocument = () => ({
  data: {
    sheets: [{
      id: uuidv4(),
      name: 's1',
      type: SHEET,
    }, {
      id: uuidv4(),
      name: 's2',
      type: SHEET,
    }],
    cells: [],
  },
  metadata: { name: 'New document' },
  id: uuidv4(),
});

const loggedOutDocs = [];

export const LOGIN_STATES = {
  UNKNOWN: 'UNKNOWN',
  LOGGED_IN: 'LOGGED_IN',
  LOGGED_OUT: 'LOGGED_OUT',
};
const UNSAVED_DOCUMENT = 'unsavedDocument';
const LAST_SAVE = 'lastSave';

const initialState = {
  userState: {
    loginState: LOGIN_STATES.UNKNOWN,
    documents: loggedOutDocs,
  },
  uistate: { dragState: {} },
};

const path = terminalName => ({
  updateId: ['openDocument', 'updateId'],
  cells: ['openDocument', 'data', 'cells'],
  sheets: ['openDocument', 'data', 'sheets'],
  data: ['openDocument', 'data'],
  dragState: ['uistate', 'dragState'],
}[terminalName]);

export const createSheet = () => ({ type: 'CREATE_SHEET' });

export const setFormula = (selection, formula) => ({
  type: 'SET_CELL_FORMULA',
  payload: { selection, formulaStr: formula },
});

export const deleteThing = refId => ({
  type: 'DELETE_THING',
  payload: { refId },
});

export const deleteLoc = (contextId, typeToDelete, indexToDelete) => ({
  type: 'DELETE_LOCATION',
  payload: { contextId, typeToDelete, indexToDelete },
});

export const toggleMaximiseSheetElem = (dispatch, refId) => {
  const refsById = getRefsById(store.getState());
  const ref = refsById[refId];
  if (!ref || !ref.sheetId) return undefined;
  const { y, x } = ref;
  const { width, height } = (ref.width * ref.height) > 1 ?
    { width: 1, height: 1 } :
    idealWidthAndHeight(refId, ref.sheetId, y, x);

  return dispatch(moveThing(refId, ref.sheetId, y, x, height, width));
};

// Maybe deal with re-parenting and re-typing? "Cut-paste from table cell
// into a sheet" etc.
export const moveThing = (refId, sheetId, y, x, height, width) => ({
  type: 'MOVE_THING',
  payload: { refId, sheetId, y, x, height, width },
});

export const startDrag = (sourceViewId, refId, type) => ({
  type: 'START_DRAG',
  payload: { sourceViewId, refId, type },
});

export const updateDrag = (targetViewId, targetSheetId, y, x) => ({
  type: 'UPDATE_DRAG',
  payload: { targetViewId, targetSheetId, y, x },
});

export const clearDrag = () => ({ type: 'CLEAR_DRAG' });

const recentUnsavedWork = (stringDoc, unsavedWork, documents) => {
  if (!stringDoc || !unsavedWork) return false;
  const doc = JSON.parse(stringDoc);
  const [docId, lastUpdateId] = unsavedWork.split(',');

  if (docId !== doc.id) return false;
  const maybeDoc = documents.find(({ id }) => id === docId);

  // New document of ours that we didn't manage to persist
  // FIXME (maybe) -- check that it's actually a "never persisted" doc?
  if (!maybeDoc) return doc;

  // Old document of ours with "expected" persisted state.
  return maybeDoc.updateId === lastUpdateId && doc;
};

export const fetchUserInfo = async (dispatch) => {
  // TODO: Send a document id if there's one in the URL, for page loads.
  // (Just for page loads?)
  // Should logged-out users get sent to unmodified last-viewed docs?
  //  nah...
  const result = await fetch('/userInfo', { credentials: 'same-origin' });
  const body = await result.json() || { documents: [] };

  const loginState = {
    true: LOGIN_STATES.LOGGED_IN,
    false: LOGIN_STATES.LOGGED_OUT,
  }[cookie.parse(document.cookie).loggedIn];

  const { openDocument } = store.getState();

  const unsavedWork = recentUnsavedWork(
    localStorage[UNSAVED_DOCUMENT],
    localStorage[LAST_SAVE],
    body.documents,
  );

  let newOpenDocument;
  if (openDocument && openDocument.updateId) {
    // Non-pageload: Stay where we are if it's "interesting"
    newOpenDocument = openDocument;
  } else if (!openDocument && unsavedWork) {
    // Page load.
    // Use the unsaved document if the unsaved edit is newer than than
    // the doc's latest edit in the database (or it's not in the db)
    newOpenDocument = unsavedWork;
    fetchQueue.push(unsavedWork);
  } else if (body.maybeRecentDocument) {
    // Not already looking at an interesting document, no unsaved work
    // from a previous session, go back to something we were on before.
    // Don't schedule a save.
    newOpenDocument = body.maybeRecentDocument;
  } else {
    // (Or a blank document if we're new or it has been deleted)
    // Don't schedule a save.
    newOpenDocument = blankDocument();
  }

  dispatch({
    type: 'USER_STATE',
    payload: {
      userState: {
        loginState,
        documents: body.documents,
      },
      openDocument: newOpenDocument,
    },
  });
};

export const doLogout = async (dispatch) => {
  // Just
  //  - Make a logout request to the server,
  //  - call fetchUserInfo.
  await fetch('/logout', { credentials: 'same-origin' });
  await fetchUserInfo(dispatch);
};

const defaultArrayCell = (contextId, index, formula = DEFAULT_FORMULA) => ({
  id: uuidv4(),
  arrayId: contextId,
  type: ARRAY_CELL,
  formula,
  index,
});

const defaultSheetElem = (contextId, y, x) => ({
  sheetId: contextId,
  id: uuidv4(),
  name: defaultCellName(y, x),
  x,
  y,
});

const defaultObject = (contextId, y, x) => {
  const base = defaultSheetElem(contextId, y, x);
  const { width, height } = idealWidthAndHeight(
    base.id,
    contextId,
    y,
    x,
    undefined, // maxWidth
    2, // maxHeight
  );
  return { width, height, type: OBJECT, ...base };
};

const defaultTable = (contextId, y, x) => {
  const base = defaultSheetElem(contextId, y, x);
  const { width, height } = idealWidthAndHeight(base.id, contextId, y, x);
  return { width, height, type: TABLE, ...base };
};

const defaultTableCell = (arrayId, objectId, formula = DEFAULT_FORMULA) => ({
  id: uuidv4(),
  arrayId,
  objectId,
  formula,
  type: TABLE_CELL,
});

const defaultTableColumn = (contextId, index, name = `c${index + 1}`) => ({
  id: uuidv4(),
  tableId: contextId,
  name,
  index,
  type: TABLE_COLUMN,
});

const defaultComputedTableColumn = (contextId, index, name = `c${index + 1}`) => ({
  id: uuidv4(),
  tableId: contextId,
  formula: DEFAULT_FORMULA,
  name,
  index,
  type: COMPUTED_TABLE_COLUMN,
});

const defaultTableRow = (contextId, index) => ({
  id: uuidv4(),
  tableId: contextId,
  index,
  type: TABLE_ROW,
});

const defaultObjectCell = (contextId, index, formula = DEFAULT_FORMULA, name = `f${index + 1}`) => ({
  id: uuidv4(),
  objectId: contextId,
  formula,
  index,
  name,
  type: OBJECT_CELL,
});

const defaultCell = (contextId, y, x) => ({
  ...defaultSheetElem(contextId, y, x),
  width: 1,
  height: 1,
  formula: DEFAULT_FORMULA,
  type: CELL,
});

const defaultArray = (contextId, y, x) => {
  const base = defaultSheetElem(contextId, y, x);
  const { width, height } = idealWidthAndHeight(
    base.id,
    contextId,
    y,
    x,
    2, // maxWidth
  );
  return { width, height, type: ARRAY, ...base };
};

const defaultSheetElemForLocation = (context, y, x, formula) => {
  let baseCell = defaultCell(context.id, y, x);
  let children = [];
  if (formula && formula.array) {
    if (formula.array.length > 0 && formula.array.every(t => t.object)) {
      baseCell = defaultTable(context.id, y, x);
      const keys = {}; // name -> new child
      formula.array.forEach(({ object }, rowIndex) => {
        const row = defaultTableRow(baseCell.id, rowIndex);
        children.push(row);
        object.forEach(({ key, value }) => {
          if (!keys[key]) {
            const numKeys = Object.keys(keys).length;
            keys[key] = defaultTableColumn(baseCell.id, numKeys, key);
            children.push(keys[key]);
          }
          children.push(defaultTableCell(keys[key].id, row.id, value));
        });
      });
    } else {
      baseCell = defaultArray(context.id, y, x);
      children = formula.array.map((
        (childFormula, index) => defaultArrayCell(
          baseCell.id,
          index,
          childFormula,
        )
      ));
    }
  } else if (formula && formula.object) {
    baseCell = defaultObject(context.id, y, x);
    children = formula.object.map((
      (childFormula, index) => defaultObjectCell(
        baseCell.id,
        index,
        childFormula.value,
        childFormula.key,
      )
    ));
  }

  return { baseCell, children };
};

const defaultTableElemForLocation = (context, y, x, locationSelected, formula) => {
  if (!locationSelected) {
    const tableRefsAtPosition = refsAtPosition(store.getState())[context.id];
    const children = [];
    let array = tableRefsAtPosition.columns[x];
    if (!array) {
      const col = defaultTableColumn(context.id, x);
      children.push(col);
      array = col;
    }
    let object = tableRefsAtPosition.rows[y];
    if (!object) {
      const row = defaultTableRow(context.id, y);
      children.push(row);
      object = row;
    }
    const baseCell = defaultTableCell(array.id, object.id);
    return { baseCell, children };
  }
  if (locationSelected.type === TABLE_COLUMN) {
    const baseCell = formula ?
      defaultComputedTableColumn(context.id, locationSelected.index) :
      defaultTableColumn(context.id, locationSelected.index);

    return { baseCell, children: [] };
  }
  if (locationSelected.type !== TABLE_ROW) {
    throw new Error('Unknown locationSelected type');
  }
  return {
    baseCell: defaultTableRow(context.id, locationSelected.index),
    children: [],
  };
};

const defaultCellForLocation = (context, y, x, locationSelected, formula) => {
  if (context.type === SHEET) {
    return defaultSheetElemForLocation(context, y, x, formula);
  }
  if (context.type === TABLE) {
    return defaultTableElemForLocation(context, y, x, locationSelected, formula);
  }
  if (context.type === OBJECT) {
    return {
      baseCell: defaultObjectCell(context.id, x),
      children: [],
    };
  }
  if (context.type !== ARRAY) {
    throw new Error(`Unknown context type ${context.type}`);
  }
  return {
    baseCell: defaultArrayCell(context.id, y),
    children: [],
  };
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

class FetchQueue {
  constructor() {
    this.syncing = false;
    this.queuedItem = null;
  }

  push(doc) {
    this.queuedItem = doc;
    if (!this.syncing) {
      this.sync();
    }
  }

  async sync() {
    this.syncing = true;
    while (this.queuedItem) {
      /* eslint-disable no-await-in-loop */
      // It's ok to sleep in this loop, we're not doing "parallel
      // processing".

      // important: sleep before fetching the queued item, but after
      // setting this.syncing to true.
      await sleep(1000);
      const doc = this.queuedItem;
      try {
        const stringDoc = JSON.stringify(doc);
        localStorage[UNSAVED_DOCUMENT] = stringDoc;
        // eslint-disable-next-line no-await-in-loop
        const response = await fetch(
          `/documents/${doc.id}`,
          {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: stringDoc,
            credentials: 'same-origin',
          },
        );
        if (response.status !== 200) throw new Error('Bad response');
        // TODO: "saved" status
        delete localStorage[UNSAVED_DOCUMENT];
        localStorage[LAST_SAVE] = `${doc.id},${doc.updateId}`;
      } finally {
        if (doc === this.queuedItem) {
          // No new thing to sync, exit the function.
          this.queuedItem = null;
        }
        // keep looping if someone pushed while the request was in flight
      }
      /* eslint-enable no-await-in-loop */
    }
    this.syncing = false;
  }
}
const fetchQueue = new FetchQueue();

const scheduleSave = (state) => {
  const nextUpdateId = uuidv4();
  const ret = digMut(state, path('updateId'), () => nextUpdateId);
  fetchQueue.push(ret.openDocument);

  // TODO: "unsaved" status.
  return ret;
};

const newSheet = () => {
  const sheetsByName = getSheetsByName(store.getState());
  for (let i = 1; ; ++i) {
    const maybeName = `s${i}`;
    if (!sheetsByName[maybeName]) {
      return {
        id: uuidv4(),
        name: maybeName,
        type: SHEET,
      };
    }
  }
};

const translateTermForDeletions = (deletedRefIds) => {
  const refsById = getRefsById(store.getState());
  return (
    (term) => {
      const outer = { on: term };
      let inner = outer;
      while (deletedRefIds.has(inner.on.ref)) {
        const ref = refsById[inner.on.ref];
        if (ref.type === SHEET) {
          inner.on = { name: ref.name };
          break;
        }
        inner.on = rewriteRefTermToParentLookup(inner.on);
        inner = inner.on;
      }
      return outer.on;
    }
  );
};


const translateDeletions = (newState, deletedRefIds) => {
  const { backwardsGraph } = getFormulaGraphs(store.getState());
  const refsById = getRefsById(store.getState());
  const deletedRefsArr = Array.from(deletedRefIds);
  const refIdsToRewrite = new Set([].concat(...deletedRefsArr.map(id => (
    backwardsGraph[id].filter(predId => refsById[predId].formula)
  ))));

  return digMut(newState, path('cells'), cells => (
    cells.map((cell) => {
      if (!refIdsToRewrite.has(cell.id)) return cell;
      return {
        ...cell,
        formula: translateExpr(
          cell.formula,
          undefined,
          translateTermForDeletions(deletedRefIds),
        ),
      };
    })
  ));
};

const rewireFormula = (cell, translateFn) => {
  const { formula } = cell;
  if (!formula) return cell;

  const contextId = getContextIdForRefId(cell.id);
  const translatedFormula = translateExpr(
    formula,
    contextId,
    translateFn,
  );
  return { ...cell, formula: translatedFormula };
};

const rewireBadRefs = (newState, updatedRefs) => {
  const translateFn = translateLookups(updatedRefs);
  return digMut(newState, path('cells'), cells => (
    cells.map(cell => rewireFormula(cell, translateFn))));
};

const rootReducer = (state, action) => {
  if (action.type === 'CREATE_SHEET') {
    // Re-wire? Dunno...
    return scheduleSave((
      digMut(state, path('sheets'), sheets => [...sheets, newSheet()])
    ));
  }

  if (action.type === 'SET_CELL_FORMULA') {
    const { selection, formulaStr } = action.payload;
    const newFormula = parseFormula(formulaStr, selection.context);

    const contextRef = getRefsById(store.getState())[selection.context];

    const { baseCell, children } = selection.cellId ?
      {
        baseCell: state.openDocument.data.cells
          .find(({ id }) => id === selection.cellId),
        children: [],
      } :
      defaultCellForLocation(
        contextRef,
        selection.y,
        selection.x,
        selection.locationSelected,
        newFormula.formula,
      );

    if (!baseCell.name) {
      delete newFormula.name;
    }
    if (!baseCell.formula) {
      delete newFormula.formula;
    }

    if (!newFormula.name && !newFormula.formula && selection.cellId) {
      // Formula is like `name: formula`.
      // When name or formula is blank and we have an existing cell, we use
      // the existing value.
      // When both are blank (i.e., the formula is `:`) we should leave
      // the cell alone.
      // When one is blank but there's no cell there, we can use a default
      // value. Don't put a default cell for the `:` formula though.
      return state;
    }

    const cell = {
      ...baseCell,
      ...newFormula,
    };

    const stateWithCell = digMut(state, path('cells'), cells => [
      ...cells.filter(({ id }) => id !== selection.cellId),
      cell,
      ...children,
    ]);
    return scheduleSave((
      rewireBadRefs(stateWithCell, [cell, ...children])
    ));
  }

  if (action.type === 'DELETE_THING') {
    const { refId } = action.payload;
    const existingRef = getRefsById(state)[refId];
    if (!existingRef) return state;

    const idsToDelete = transitiveChildren(refId);

    const stateMinusDeletions = digMut(state, path('data'), data => ({
      ...data,
      sheets: data.sheets.filter(({ id }) => !idsToDelete.has(id)),
      cells: data.cells.filter(({ id }) => !idsToDelete.has(id)),
    }));
    return scheduleSave((
      translateDeletions(stateMinusDeletions, idsToDelete)
    ));
  }

  if (action.type === 'DELETE_LOCATION') {
    const { contextId, typeToDelete, indexToDelete } = action.payload;
    const context = getRefsById(state)[contextId];
    if (!context) return state;
    if (![ARRAY, OBJECT, TABLE].includes(context.type)) return state;

    const refToDelete = getChildrenOfRef(state, contextId)
      .find(({ type, index }) => index === indexToDelete && type === typeToDelete);
    const idsToDelete = refToDelete ?
      transitiveChildren(refToDelete.id) :
      new Set();

    const stateMinusDeletions = digMut(state, path('data'), data => ({
      ...data,
      sheets: data.sheets.filter(({ id }) => !idsToDelete.has(id)),
      cells: data.cells.filter(({ id }) => !idsToDelete.has(id))
        .map((cell) => {
          if (typeToDelete !== cell.type) return cell;
          if (refParentId(cell) !== contextId) return cell;
          if (cell.index < indexToDelete) return cell;
          return { ...cell, index: cell.index - 1 };
        }),
    }));
    return scheduleSave((
      translateDeletions(stateMinusDeletions, idsToDelete)
    ));
  }

  if (action.type === 'MOVE_THING') {
    const { refId, ...newGeometry } = action.payload;
    const existingRef = getRefsById(state)[refId];
    if (!existingRef) return state;
    if (!existingRef.sheetId) {
      throw new Error('Can only move/resize things in sheets');
    }

    return scheduleSave(digMut(state, path('cells'), cells => [
      ...cells.filter(({ id }) => id !== refId),
      { ...existingRef, ...newGeometry },
    ]));
  }

  if (action.type === 'START_DRAG') {
    return digMut(state, path('dragState'), action.payload);
  }

  if (action.type === 'UPDATE_DRAG') {
    const { targetViewId } = action.payload;
    const { sourceViewId, type } = state.uistate.dragState;
    if (type === DRAG_RESIZE && sourceViewId !== targetViewId) {
      return state;
    }
    const { dragState } = state.uistate;
    const newDragState = { ...dragState, ...action.payload };
    if (equal(dragState, newDragState)) {
      return state;
    }
    return digMut(state, path('dragState'), newDragState);
  }

  if (action.type === 'CLEAR_DRAG') {
    return digMut(state, path('dragState'), {});
  }

  if (action.type === 'USER_STATE') {
    return {
      ...state,
      ...action.payload,
    };
  }

  return state;
};

const store = createStore(rootReducer, initialState);
export default store;
