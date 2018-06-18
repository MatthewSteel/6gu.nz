import uuidv4 from 'uuid-v4';
import cookie from 'cookie';
import { digMut } from '../selectors/algorithms/algorithms';
import { path, SHEET, loggedOutDocs, LOGIN_STATES } from './stateConstants';
import { loggedIn } from '../selectors/formulas/selectors';

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
  metadata: { name: 'New document' },
  id: uuidv4(),
});

const UNSAVED_DOCUMENT = 'unsavedDocument';
const LAST_SAVE = 'lastSave';

const recentUnsavedWork = (stringDoc, unsavedWork, documents) => {
  if (!stringDoc || !unsavedWork) return false;


  const doc = JSON.parse(stringDoc);
  // New document of ours that we didn't manage to persist. Pretty ids
  // come from the server.
  if (!doc.prettyId) return doc;

  const [docId, lastUpdateId] = unsavedWork.split(',');
  if (docId !== doc.id) return false; // a bug, maybe?
  const maybeDoc = documents.find(({ id }) => id === docId);

  // Probably something we deleted on another computer
  if (!maybeDoc) return false;

  // Old document of ours with "expected" persisted state.
  return maybeDoc.updateId === lastUpdateId && doc;
};

export const fetchUserInfo = async (dispatch) => {
  // TODO: Send a document id if there's one in the URL, for page loads.
  // (Just for page loads?)
  // Should logged-out users get sent to unmodified last-viewed docs?
  //  nah...
  const result = await fetch('/userInfo', { credentials: 'same-origin' });
  const body = await result.json() || { documents: loggedOutDocs };

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

const setPrettyDocId = (id, prettyId) => ({
  type: 'SET_PRETTY_DOC_ID',
  payload: { id, prettyId },
});

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const persistDocToServer = async (doc, stringDoc) => {
  const response = await fetch(
    `/documents/${doc.id}`,
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
    store.dispatch(setPrettyDocId(doc.id, body));
  }
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
        if (loggedIn(store.getState())) {
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

export const scheduleSave = (state) => {
  const nextUpdateId = uuidv4();
  const ret = digMut(state, path('updateId'), () => nextUpdateId);
  fetchQueue.push(ret.openDocument);

  // TODO: "unsaved" status in new redux state
  return ret;
};

const mutDocProperty = (state, id, updates) => {
  // Set updates in two places:
  //  - User's documents,
  //  - Document itself.
  // Slightly annoying that it's denormalised, but kinda necessary because
  // we might be looking at a document we don't own and want to keep some
  // of this data id in the state in that case.
  const mutatedDocsState = digMut(
    state,
    ['userState', 'documents'],
    documents => documents.map((doc) => {
      if (doc.id !== id) return doc;
      return { ...doc, ...updates };
    }),
  );
  if (state.openDocument.id !== id) {
    return mutatedDocsState;
  }
  return digMut(mutatedDocsState, ['openDocument'], doc => ({
    ...doc,
    ...updates,
  }));
};

export const userStateReducer = (state, action) => {
  if (action.type === 'USER_STATE') {
    return {
      ...state,
      ...action.payload,
    };
  }
  if (action.type === 'SET_PRETTY_DOC_ID') {
    return mutDocProperty(state, action.payload.id, action.payload);
  }
  return state;
};
