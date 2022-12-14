import uuidv4 from 'uuid-v4';
import cookie from 'cookie';
import { digMut, nameCopy } from '../selectors/algorithms/algorithms';
import { path, SHEET, loggedOutDocs, LOGIN_STATES } from './stateConstants';
import { loggedIn } from '../selectors/formulas/selectors';
import { dropDownDocuments } from '../selectors/uistate/uistate';

import store from './store';

export const blankDocument = () => ({
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
  metadata: { name: 'Document' },
  id: uuidv4(),
});

const UNSAVED_DOCUMENT = 'unsavedDocument';
const LAST_SAVE = 'lastSave';

export const renameDocument = (documentId, name) => ({
  type: 'RENAME_DOCUMENT', payload: { documentId, name },
});

export const deleteDocument = documentId => ({
  type: 'DELETE_DOCUMENT', payload: documentId,
});

export const loadDocument = documentId => ({
  type: 'LOAD_DOCUMENT', payload: documentId,
});

const recentUnsavedWork = (stringDoc, unsavedWork, documents, loginState) => {
  if (!stringDoc) return false;
  if (loginState === LOGIN_STATES.LOGGED_IN && !unsavedWork) return false;
  const doc = JSON.parse(stringDoc);

  if (loginState === LOGIN_STATES.LOGGED_OUT) return doc;

  // Logged in. New document of ours that we didn't manage to persist.
  // Pretty ids come from the server.
  if (!doc.prettyId) return doc;

  const [docId, lastUpdateId] = unsavedWork.split(',');
  if (docId !== doc.id) return false; // a bug, maybe?
  const maybeDoc = documents.find(({ id }) => id === docId);

  // Probably something we deleted on another computer
  if (!maybeDoc) return false;

  // Old document of ours with "expected" persisted state.
  return maybeDoc.updateId === lastUpdateId && doc;
};

const documentWeWant = () => {
  // Nasty function:
  //  - If we're a node "client", we want to use an environment variable.
  //  - If we're a real web client, we want to decode the browser's URL.
  if (process.env.SERVING_DOCUMENT_PRETTY_ID) {
    return process.env.SERVING_DOCUMENT_PRETTY_ID;
  }
  // "/d/{documentShortId}/..."
  const maybeId = window.location.pathname.split('/')[2];
  if (maybeId === 'unsaved') return undefined;
  return maybeId;
};

export const fetchUserInfo = async (dispatch) => {
  // Should logged-out users get sent to unmodified last-viewed docs?
  //  nah...
  const maybeUrlDocId = documentWeWant();
  let serverData = {};
  let fetchFailed = false;
  try {
    const result = await fetch(
      `/api/userInfo/${maybeUrlDocId || ''}`,
      { credentials: 'same-origin' },
    );
    serverData = await result.json();
  } catch (e) {
    // Pretend we're logged out :-/
    fetchFailed = true;
  }
  const body = { documents: loggedOutDocs, user: {}, ...serverData };

  const loginState = {
    true: LOGIN_STATES.LOGGED_IN,
    false: LOGIN_STATES.LOGGED_OUT,
  }[!fetchFailed && cookie.parse(document.cookie).loggedIn];

  const { openDocument } = store.getState();

  const unsavedWork = (!maybeUrlDocId) && recentUnsavedWork(
    localStorage[UNSAVED_DOCUMENT],
    localStorage[LAST_SAVE],
    body.documents,
    loginState,
  );

  let newOpenDocument;
  if (openDocument && openDocument.updateId) {
    // Non-pageload: Stay where we are if it's "interesting"
    newOpenDocument = openDocument;
    // TODO: might want to save on login?
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
        userId: body.user.id,
      },
      openDocument: newOpenDocument,
    },
  });
};

export const doLogout = async (dispatch) => {
  // Just
  //  - Make a logout request to the server,
  //  - call fetchUserInfo.
  try {
    await fetch('/api/logout', { credentials: 'same-origin' });
  } catch (e) {
    // In the event of network failure here, we won't be able to clear the
    // session cookie :-(. We can only pretend to log out. `fetchUserInfo`
    // will be responsible for that.
  }
  await fetchUserInfo(dispatch);
};

const savedDoc = details => ({
  type: 'SAVED_DOC',
  payload: details,
});

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const persistDocToServer = async (doc, stringDoc) => {
  try {
    const response = await fetch(
      `/api/documents/${doc.id}`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: stringDoc,
        credentials: 'same-origin',
      },
    );
    if (response.status === 200) {
      // TODO: "saved" status in new redux state
      delete localStorage[UNSAVED_DOCUMENT];
      localStorage[LAST_SAVE] = `${doc.id},${doc.updateId}`;
      const body = await response.json();
      store.dispatch(savedDoc(body));
    }
  } catch (e) {
    // Network failure, probably. Keep unsaved document around.
  }
};

const updateDocumentDetails = async (doc) => {
  const copy = { ...doc };
  delete copy.data;
  try {
    const response = await fetch(
      `/api/documents/${doc.id}`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(doc),
        credentials: 'same-origin',
      },
    );
    if (response.status === 200) {
      const body = await response.json();
      store.dispatch(savedDoc(body));
    }
  } catch (e) {
    // If the request fails, just ignore the rename I guess?
  }
};

const isMine = (doc) => {
  if (!doc.userId) return true;
  const myUserId = store.getState().userState.userId;
  return myUserId === doc.userId;
};

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

        try {
          localStorage[UNSAVED_DOCUMENT] = stringDoc;
        } catch (e) {
          // If the new doc is too big to fit, don't leave some old
          // unsaved copy in there.
          delete localStorage[UNSAVED_DOCUMENT];
        }
        if (loggedIn(store.getState()) && isMine(doc)) {
          await persistDocToServer(doc, stringDoc);
        }
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

export const scheduleSave = (prevState, state, pushQueue = true) => {
  const nextUpdateId = uuidv4();
  let ret = digMut(state, path('updateId'), () => nextUpdateId);
  if (pushQueue) {
    ret = {
      ...ret,
      redoStack: [],
      undoStack: [...prevState.undoStack, prevState.openDocument],
    };
  }
  fetchQueue.push(ret.openDocument);

  // TODO: "unsaved" status in new redux state
  return ret;
};

const updateDocState = (state, doc, insert) => {
  const docWithoutData = { ...doc };
  delete docWithoutData.data;

  const existingDocs = state.userState.documents;

  // Only insert into the list when we have a confirmed save, otherwise
  // just do a replacement.
  const newDocs = insert
    ? [docWithoutData, ...existingDocs.filter(({ id }) => id !== doc.id)]
    : existingDocs.map(d => (d.id === doc.id ? docWithoutData : d));

  const mutatedDocs = digMut(state, ['userState', 'documents'], newDocs);
  if (state.openDocument.id !== doc.id) return mutatedDocs;
  return digMut(mutatedDocs, ['openDocument'], openDoc => ({
    ...openDoc, ...doc,
  }));
};
const savedDocState = (state, doc) => (
  updateDocState(state, doc, true));
const saveDocState = (state, doc) => (
  updateDocState(state, doc, false));

const fetchDocument = async (documentId) => {
  const result = await fetch(
    `/api/documents/${documentId}`,
    { credentials: 'same-origin' },
  );
  return result.json();
};
const scheduleDelete = (documentId) => {
  fetch(
    `/api/documents/${documentId}`,
    {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
    },
  );
};

export const fetchAndLoadDocument = async (dispatch, documentId) => {
  // Dispatch "loading document" action here?
  try {
    const body = await fetchDocument(documentId);
    dispatch({ type: 'LOAD_DOCUMENT', payload: body });
  } catch (e) {
    // probably cancel the load here?
  }
};

export const copyDocument = async (dispatch, docs, documentId) => {
  // Get the data we need,
  const { openDocument } = store.getState();
  const newDoc = (openDocument.id === documentId)
    ? { ...openDocument } : (await fetchDocument(documentId));

  // Update properties on the document,
  const existingNames = docs.map(doc => doc.metadata.name);
  newDoc.metadata.name = nameCopy(existingNames, newDoc.metadata.name);
  newDoc.id = uuidv4();
  delete newDoc.prettyId;
  delete newDoc.userId;

  dispatch({ type: 'SAVE_COPY', payload: newDoc });
};

export const newDocument = () => ({ type: 'NEW_DOCUMENT' });


const replaceDoc = (state, newDoc) => ({
  ...state,
  openDocument: newDoc,
  undoStack: [],
  redoStack: [],
});


export const userStateReducer = (state, action) => {
  if (action.type === 'USER_STATE') {
    // login with open doc, document list, login state etc.
    return { ...state, ...action.payload };
  }

  if (action.type === 'SAVED_DOC') {
    // Document metadata came back after a successful save
    return savedDocState(state, action.payload);
  }

  if (action.type === 'SAVE_COPY') {
    // Set open document and save it. Clear the undo/redo stacks.
    return scheduleSave(state, replaceDoc(state, action.payload), false);
  }

  if (action.type === 'RENAME_DOCUMENT') {
    const { documentId, name } = action.payload;

    const doc = dropDownDocuments(state)
      .find(({ id }) => id === documentId);
    const newDoc = digMut(doc, ['metadata', 'name'], name);
    const newState = saveDocState(state, newDoc);
    if (state.openDocument.id === documentId) {
      return scheduleSave(state, newState);
    }
    updateDocumentDetails(newDoc);
    return newState;
  }

  if (action.type === 'DELETE_DOCUMENT') {
    // TODO: schedule actual server deletion
    const docId = action.payload;
    scheduleDelete(docId);

    const newOpenDoc = (state.openDocument.id === docId)
      ? digMut(state, ['openDocument'], blankDocument()) : state;

    const newDocs = state.userState.documents
      .filter(({ id }) => id !== docId);
    return digMut(newOpenDoc, ['userState', 'documents'], newDocs);
  }

  if (action.type === 'LOAD_DOCUMENT') {
    // set document title and url?
    // Reset the view?
    return replaceDoc(state, action.payload);
  }

  if (action.type === 'NEW_DOCUMENT') {
    return replaceDoc(state, blankDocument());
  }

  return state;
};
