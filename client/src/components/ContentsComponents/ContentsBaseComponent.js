import React, { Component } from 'react';
import equal from 'fast-deep-equal';
import { CELL } from '../../redux/stateConstants';
import { clampValue, clampOverlap, rangesOverlap, truncateOverlap } from '../../selectors/geom/geom';
import { clearDrag, startDrag, updateDrag } from '../../redux/uistate';
import { moveThing, toggleMaximiseSheetElem, undo, redo } from '../../redux/documentEditing';
import '../CellComponent/CellComponent.css';

// For moving the cursor out of a large cell
const maybeBreakOut = (curr, move, start, length) => {
  if (move < 0) return start - 0.5;
  if (move > 0) return start + length;
  return curr;
};

export default class ContentsBaseComponent extends Component {
  constructor(props) {
    super(props);
    this.cellKeys = this.cellKeys.bind(this);
    this.setViewSelection = this.setViewSelection.bind(this);
    this.setChildSelectionTableRef = this.setChildSelectionTableRef.bind(this);

    this.childSelectionTableRef = null;
    this.state = { scrollX: 0, scrollY: 0 };
    this.scrollXPx = 0;
    this.scrollYPx = 0;
    this.onScroll = this.onScroll.bind(this);
    this.move = this.move.bind(this);
    this.relativeScroll = this.relativeScroll.bind(this);
  }

  componentWillUnmount() {
    // React complains about setState({ scroll }) after unmount. I don't
    // know if this is a reasonable fix...
    this.setSelection = () => {};
  }

  setChildSelectionTableRef(ref) {
    this.childSelectionTableRef = ref;
  }

  setViewSelection(worldY, worldX, maybeClickExpr) {
    const { x: selX, y: selY } = this.worldToLocal({ y: worldY, x: worldX });
    this.setSelection(selY, selX, maybeClickExpr);
  }

  setSelection(selY, selX, maybeClickExpr) {
    const { scrollX, scrollY } = this.state;
    const { setViewSelection, viewWidth, viewHeight } = this.props;

    const localScale = this.localScale();
    const localViewHeight = viewHeight * localScale.y;
    const localViewWidth = viewWidth * localScale.x;
    const newScrollY = clampOverlap(scrollY, localViewHeight, selY, selY + 0.5);
    const newScrollX = clampOverlap(scrollX, localViewWidth, selX, selX + 0.5);
    this.scroll({ scrollY: newScrollY, scrollX: newScrollX });
    const worldCoords = this.localToWorld({ y: selY, x: selX });
    setViewSelection(worldCoords.y, worldCoords.x, maybeClickExpr);
  }

  onScroll(pxOffset) {
    // Pixel offsets from wheel/touch listening
    const { dx, dy } = pxOffset;
    const xOffset = dx - this.scrollXPx;
    const yOffset = dy - this.scrollYPx;
    const xMove = Math.trunc(xOffset / 100);
    const yMove = Math.trunc(yOffset / 40);
    if (xMove !== 0 || yMove !== 0) {
      this.scrollXPx += xMove * 100;
      this.scrollYPx += yMove * 40;
      this.relativeScroll(yMove, xMove);
    }
  }

  relativeScroll(wantDY, wantDX) {
    // discretised onScroll or left-over scroll from children that have
    // scrolled all the way to the end.
    const { yUB, xUB } = this.bounds();
    const { viewWidth, viewHeight } = this.props;
    const scale = this.localScale();
    const { scrollX, scrollY } = this.state;
    const maxScrollY = yUB - (viewHeight * scale.y);
    const maxScrollX = xUB - (viewWidth * scale.x);
    const newYPos = clampValue(scrollY + wantDY, 0, maxScrollY);
    const newXPos = clampValue(scrollX + wantDX, 0, maxScrollX);

    const leftOverY = scrollY + wantDY - newYPos;
    const leftOverX = scrollX + wantDX - newXPos;
    this.scroll({ scrollY: newYPos, scrollX: newXPos });
    if (leftOverY || leftOverX) {
      const { parentRelativeScroll } = this.props;
      if (!parentRelativeScroll) return;
      parentRelativeScroll(leftOverY, leftOverX);
    }
  }

  scroll(coords) {
    const { scrollX, scrollY } = this.state;
    if (!equal({ scrollX, scrollY }, coords)) {
      this.setState(coords);
    }
  }

  worldToLocal(world) {
    // Turn "position on screen" into "position relative to our top-left"
    const { viewOffsetY, viewOffsetX } = this.props;
    const windowY = world.y - viewOffsetY;
    const windowX = world.x - viewOffsetX;

    // Turn "position relative to our top-left" in world-coords into
    // "offset from top-left elem" in elements.
    // Add an offset in case we have special header rows etc.
    const localScale = this.localScale();
    const elemsIntoWindowY = Math.max(0, localScale.y * windowY);
    const elemsIntoWindowX = Math.max(0, localScale.x * windowX);

    // Turn "offset from top-left elem" into "offset from very start"
    // Always truncate in case someone sends us a fractional world coord
    // we can't deal with.
    // Also, don't let it go negative -- we might click on a header :-/
    // Maybe that'll be useful later...
    // TODO: Maybe update world coords if they're way off base?
    const { scrollY, scrollX } = this.state;
    const { yLB, yUB, xLB, xUB } = this.bounds();
    return {
      y: clampValue(Math.floor(elemsIntoWindowY + scrollY), yLB, yUB - 1),
      x: clampValue(Math.floor(elemsIntoWindowX + scrollX), xLB, xUB - 1),
    };
  }

  localSelection() {
    const { viewSelY: y, viewSelX: x } = this.props;
    const { y: selY, x: selX } = this.worldToLocal({ y, x });
    return { selX, selY };
  }

  localToWorld(local) {
    // Turn "Local elem position" into "offset position from own corner"
    const { scrollY, scrollX } = this.state;
    const elemsIntoWindowY = local.y - scrollY;
    const elemsIntoWindowX = local.x - scrollX;

    // Turn "elem position from our top left" into "global coords from our
    // top left".
    const localScale = this.localScale();
    const windowY = elemsIntoWindowY / localScale.y;
    const windowX = elemsIntoWindowX / localScale.x;

    // Turn "coords from top left of window" into "coords from top left of
    // sheet. Possibly ends up fractional :-)
    const { viewOffsetY, viewOffsetX } = this.props;
    return {
      y: windowY + viewOffsetY,
      x: windowX + viewOffsetX,
    };
  }

  localScale() {
    return { y: 1, x: 1 };
  }

  locationSelected() {
    // { typeToDelete, indexToDelete } or undefined.
    return undefined;
  }

  selectedCellId() {
    const { selY, selX } = this.localSelection();
    const selectedCell = this.maybeSelectedCell();
    const { contextId, readOnly } = this.props;

    // We might just be a cell that holds an array or something. If so,
    // provide the cell's (sheet) context to the formula box so we can
    // rename the cell.
    const realContext = (selectedCell && selectedCell.type === CELL)
      ? selectedCell.sheetId : contextId;
    return {
      context: realContext,
      cellId: selectedCell && selectedCell.id, // may be undefined
      y: selY,
      x: selX,
      locationSelected: this.locationSelected(),
      readOnly,
    };
  }

  move(dy, dx) {
    // All coords are "local", scaled for our data and relative to the
    // start of our data.
    const { selY, selX } = this.localSelection();
    const selectedCell = this.maybeSelectedCell();

    // Speed past "big" cells -- move multiple "spaces"
    const selBox = selectedCell
      ? this.cellPosition(selectedCell)
      : { x: selX, y: selY, width: 1, height: 1 };
    const wantedNewY = maybeBreakOut(selY, dy, selBox.y, selBox.height);
    const wantedNewX = maybeBreakOut(selX, dx, selBox.x, selBox.width);

    // Clamp wanted selection to navigable cells.
    const { yLB, yUB, xLB, xUB } = this.bounds();
    const newY = clampOverlap(wantedNewY, 0.5, yLB, yUB);
    const newX = clampOverlap(wantedNewX, 0.5, xLB, xUB);

    if (
      rangesOverlap(newY, 0.5, selBox.y, selBox.height)
      && rangesOverlap(newX, 0.5, selBox.x, selBox.width)
    ) {
      // Only move (and swallow event) if we actually move somewhere.
      // In particular, send the event to our parent if we hit a wall.
      const { parentMove } = this.props;
      if (parentMove) parentMove(dy, dx);
    } else {
      this.setSelection(newY, newX);
    }
  }

  cellKeys(ev) {
    const { dispatchUndo, dispatchRedo } = this.props;

    if (this.childSelectionTableRef) {
      this.childSelectionTableRef
        .getWrappedInstance()
        .cellKeys(ev);
      if (ev.defaultPrevented) return;
    }

    if ('zZ'.includes(ev.key) && (ev.ctrlKey || ev.metaKey)) {
      if (ev.key === 'z') {
        dispatchUndo();
      } else {
        dispatchRedo();
      }
      return;
    }
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
    const moves = {
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
    };

    // Movement actions
    if (moves[ev.key]) {
      // Cursor key nav
      ev.preventDefault();
      this.move(...moves[ev.key]);
    }
    if (ev.key === 'Enter') {
      ev.preventDefault();
      const yMove = ev.shiftKey ? -1 : 1;
      this.move(yMove, 0);
    }
    if (ev.key === 'Tab') {
      ev.preventDefault();
      const xMove = ev.shiftKey ? -1 : 1;
      this.move(0, xMove);
    }
    if (ev.key === 'Escape') {
      const { popViewStack } = this.props;
      popViewStack();
      ev.preventDefault();
    }
  }

  render() {
    // Render shadows around views that are truncated by surroundings
    const { scrollY, scrollX } = this.state;
    const { viewOffsetY, viewOffsetX, viewWidth, viewHeight } = this.props;
    const { yLB, yUB, xLB, xUB } = this.bounds();
    const localScale = this.localScale();

    const getStyle = (ylower, ylen, xlower, xlen) => ({
      gridColumn: (`${xlower / localScale.x + viewOffsetX + 1}
        / span ${xlen / localScale.x}`),
      gridRow: (`${ylower * (2 / localScale.y) + 2 * viewOffsetY + 1}
        / span ${ylen * (2 / localScale.y)}`),
      position: 'relative',
    });

    const ret = [];
    const yOverlap = truncateOverlap(
      yLB - scrollY,
      yUB - yLB,
      0,
      viewHeight,
    );
    const xOverlap = truncateOverlap(
      xLB - scrollX,
      xUB - xLB,
      0,
      viewWidth,
    );
    if (scrollX > 0) {
      const style = getStyle(yOverlap.x, yOverlap.length, 0, 1);
      ret.push((
        <div
          key="LeftInternalShadow"
          className="LeftInternalShadow"
          style={style}
        />
      ));
    }
    if (xUB - scrollX < viewWidth * localScale.x) {
      const style = getStyle(yOverlap.x, yOverlap.length, viewWidth * localScale.x - 1, 1);
      ret.push((
        <div
          key="RightInternalShadow"
          className="RightInternalShadow"
          style={style}
        />
      ));
    }
    if (scrollY > 0) {
      const style = getStyle(0, 1, xOverlap.x, xOverlap.length);
      ret.push((
        <div
          key="TopInternalShadow"
          className="TopInternalShadow"
          style={style}
        />
      ));
    }
    if (yUB - scrollY > viewHeight * localScale.y) {
      const style = getStyle(viewHeight * localScale.y - 1, 1, xOverlap.x, xOverlap.length);
      ret.push((
        <div
          key="BottomInternalShadow"
          className="BottomInternalShadow"
          style={style}
        />
      ));
    }
    return ret;
  }
}

// Chrome doesn't like us updating the DOM in the drag start handler...
const asyncStartDrag = (dispatch, refId, type) => {
  setTimeout(() => dispatch(startDrag(refId, type)), 0);
};

export const mapDispatchToProps = dispatch => ({
  clearDragProp: () => dispatch(clearDrag()),
  startDragProp: (refId, type) => asyncStartDrag(dispatch, refId, type),
  updateDragProp: (sheetId, dragY, dragX) => (
    dispatch(updateDrag(sheetId, dragY, dragX))),
  dispatchUndo: () => dispatch(undo()),
  dispatchRedo: () => dispatch(redo()),
  moveCell: (cellId, sheetId, y, x, width, height) => (
    dispatch(moveThing(cellId, sheetId, y, x, width, height))),
  toggleElementSize: refId => toggleMaximiseSheetElem(dispatch, refId),
});
