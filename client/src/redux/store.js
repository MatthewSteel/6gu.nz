import { createStore } from 'redux';
import { uistateReducer } from './uistate';
import { userStateReducer } from './backend';
import { documentReducer } from './documentEditing';
import { initialState } from './stateConstants';

const rootReducer = (state0, action) => {
  const state1 = uistateReducer(state0, action);
  const state2 = userStateReducer(state1, action);
  return documentReducer(state2, action);
};

const store = createStore(rootReducer, initialState);
export default store;
