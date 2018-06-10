import store from '../../redux/store';
import { getRefsById, sheetPlacedCellLocs } from '../formulas/selectors';

export const DRAG_MOVE = 'move';
export const DRAG_RESIZE = 'resize';

const moveDragGeom = (cell, y, x) => ({
  y,
  x,
  height: cell.height,
  width: cell.width,
});

const resizeDimension = (startX, endX) => {
  if (endX >= startX) {
    return [startX, endX - startX + 1];
  }
  return [endX, startX - endX];
};

const resizeDragGeom = (cell, y, x) => {
  const [newY, height] = resizeDimension(cell.y, y);
  const [newX, width] = resizeDimension(cell.x, x);
  return { x: newX, y: newY, width, height };
};

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

export const canPlaceWithoutConflict = (
  dragRefId,
  dragGeom,
  placedCellLocs,
) => {
  if (!dragGeom) return false;
  const { x, y, width, height } = dragGeom;
  for (let cx = x; cx < x + width; ++cx) {
    for (let cy = y; cy < y + height; ++cy) {
      const maybePlacedId = placedCellLocs[`${cy},${cx}`];
      if (maybePlacedId && maybePlacedId !== dragRefId) return false;
    }
  }
  return true;
};

export const idealWidthAndHeight = (
  refId,
  sheetId,
  y,
  x,
  maxWidth = 3,
  maxHeight = 4,
) => {
  const placedCellLocs = sheetPlacedCellLocs(store.getState());
  let best = { width: 1, height: 1 };
  for (let height = 1; height <= maxHeight; ++height) {
    for (let width = 1; width <= maxWidth; ++width) {
      if (height * width <= best.height * best.width) continue;
      if (
        canPlaceWithoutConflict(
          refId,
          { y, x, width, height },
          placedCellLocs,
        )
      ) {
        best = { width, height };
      }
    }
  }
  return best;
};
