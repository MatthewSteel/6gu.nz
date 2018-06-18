import { createStore } from 'redux';
import { dragReducer } from './drag';
import { userStateReducer } from './backend';
import { documentReducer } from './documentEditing';
import { initialState } from './stateConstants';

const rootReducer = (state0, action) => {
  const state1 = dragReducer(state0, action);
  const state2 = userStateReducer(state1, action);
  return documentReducer(state2, action);
};

const store = createStore(rootReducer, initialState);
export default store;
