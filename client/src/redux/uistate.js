import equal from 'fast-deep-equal';
import { digMut } from '../selectors/algorithms/algorithms';
import { path } from './stateConstants';

export const startDrag = (refId, type) => ({
  type: 'START_DRAG',
  payload: { refId, type },
});

export const updateDrag = (targetSheetId, y, x) => ({
  type: 'UPDATE_DRAG',
  payload: { targetSheetId, y, x },
});

export const clearDrag = () => ({ type: 'CLEAR_DRAG' });

// Maybe in the future this can re-parent in more complex ways. At the
// moment it can just move "sheet things" between sheets.
export const moveThing = (refId, sheetId, y, x, height, width) => ({
  type: 'MOVE_THING',
  payload: { refId, sheetId, y, x, height, width },
});

export const updateView = newView => ({
  type: 'UPDATE_VIEW', payload: { newView },
});

export const updateSelection = newSelection => ({
  type: 'UPDATE_SELECTION', payload: { newSelection },
});

export const setFormulaFocus = newFocus => ({
  type: 'SET_FORMULA_FOCUS', payload: newFocus,
});

export const uistateReducer = (state, action) => {
  if (action.type === 'START_DRAG') {
    return digMut(state, path('dragState'), action.payload);
  }

  if (action.type === 'UPDATE_DRAG') {
    const { dragState } = state;
    const newDragState = { ...dragState, ...action.payload };
    if (equal(dragState, newDragState)) {
      return state;
    }
    return digMut(state, path('dragState'), newDragState);
  }

  if (action.type === 'CLEAR_DRAG') {
    return digMut(state, path('dragState'), {});
  }

  if (action.type === 'UPDATE_VIEW') {
    const { newView } = action.payload;
    if (equal(newView, state.uistate)) return state;
    return digMut(state, ['uistate'], newView);
  }

  if (action.type === 'UPDATE_SELECTION') {
    const { newSelection } = action.payload;
    if (equal(newSelection, state.selection)) return state;
    return digMut(state, ['selection'], newSelection);
  }

  if (action.type === 'SET_FORMULA_FOCUS') {
    return digMut(state, ['formulaFocus'], action.payload);
  }

  return state;
};
