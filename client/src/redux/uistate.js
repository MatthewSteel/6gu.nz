import equal from 'fast-deep-equal';
import { digMut } from '../selectors/algorithms/algorithms';
import { DRAG_RESIZE } from '../selectors/geom/dragGeom';
import { path } from './stateConstants';

export const startDrag = (sourceViewId, refId, type) => ({
  type: 'START_DRAG',
  payload: { sourceViewId, refId, type },
});

export const updateDrag = (targetViewId, targetSheetId, y, x) => ({
  type: 'UPDATE_DRAG',
  payload: { targetViewId, targetSheetId, y, x },
});

export const clearDrag = () => ({ type: 'CLEAR_DRAG' });

// Maybe in the future this can re-parent in more complex ways. At the
// moment it can just move "sheet things" between sheets.
export const moveThing = (refId, sheetId, y, x, height, width) => ({
  type: 'MOVE_THING',
  payload: { refId, sheetId, y, x, height, width },
});

export const setSelectedView = viewId => ({
  type: 'SET_VIEW_SELECTION', payload: viewId,
});

export const updateView = newView => ({
  type: 'UPDATE_VIEW', payload: { newView },
});

export const uistateReducer = (state, action) => {
  if (action.type === 'START_DRAG') {
    return digMut(state, path('dragState'), action.payload);
  }

  if (action.type === 'UPDATE_DRAG') {
    const { targetViewId } = action.payload;
    const { sourceViewId, type } = state.dragState;
    if (type === DRAG_RESIZE && sourceViewId !== targetViewId) {
      return state;
    }
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

  if (action.type === 'SET_VIEW_SELECTION') {
    if (action.payload === state.uistate.selectedViewId) return state;
    return digMut(state, ['uistate', 'selectedViewId'], action.payload);
  }

  if (action.type === 'UPDATE_VIEW') {
    const { newView } = action.payload;
    const newState = digMut(state, ['uistate'], oldUiState => ({
      selectedViewId: newView.id,
      views: oldUiState.views.map(view => (
        view.id === newView.id ? newView : view)),
    }));
    if (equal(newState.uistate, state.uistate)) return state;
    return newState;
  }

  return state;
};
