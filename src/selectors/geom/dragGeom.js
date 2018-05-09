import store from '../../redux/store';
import { getRefsById } from '../formulas/selectors';

export const DRAG_MOVE = 'move';
export const DRAG_RESIZE = 'resize';

const moveDragGeom = (cell, y, x) => ({
  y,
  x,
  height: cell.height,
  width: cell.width,
});

const resizeDragGeom = (cell, y, x) => ({
  y: cell.y,
  x: cell.x,
  height: Math.max(1, y - cell.y + 1),
  width: Math.max(1, x - cell.x + 1),
});

export const getDragRefId = state => state.uistate.dragState.refId;

export default (sheetId) => {
  const {
    targetSheetId,
    y,
    x,
    type,
    refId,
  } = store.getState().uistate.dragState;
  if (!refId) return undefined;
  if (x === undefined) return undefined; // dragOver may not have happened
  if (targetSheetId !== sheetId) return undefined;

  const ref = getRefsById(store.getState())[refId];
  if (!ref || !ref.sheetId) throw new Error('Bad ref in dragGeom');
  if (type === DRAG_MOVE) return moveDragGeom(ref, y, x);
  if (type !== DRAG_RESIZE) throw new Error(`Bad drag type: ${type}`);
  return resizeDragGeom(ref, y, x);
};
