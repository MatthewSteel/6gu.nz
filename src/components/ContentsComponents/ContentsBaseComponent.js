import { Component } from 'react';
import { clampValue, clampOverlap, rangesOverlap } from '../../selectors/geom/geom';

// For moving the cursor out of a large cell
const maybeBreakOut = (curr, move, start, length) => {
  if (move < 0) return start - 1;
  if (move > 0) return start + length;
  return curr;
};

export default class ContentsBaseComponent extends Component {
  constructor(props) {
    super(props);
    this.cellKeys = this.cellKeys.bind(this);
    this.formulaKeys = this.formulaKeys.bind(this);
    this.setViewSelection = this.setViewSelection.bind(this);
    this.setChildSelectionTableRef = this.setChildSelectionTableRef.bind(this);

    this.childSelectionTableRef = null;
    this.state = { scrollX: 0, scrollY: 0 };
    this.updateSelection();
  }

  componentDidUpdate() {
    this.updateSelection();
  }

  setChildSelectionTableRef(ref) {
    this.childSelectionTableRef = ref;
  }

  setViewSelection(worldY, worldX) {
    const { x: selX, y: selY } = this.worldToLocal({ y: worldY, x: worldX });
    this.setSelection(selY, selX);
  }

  setSelection(selY, selX) {
    const { scrollX, scrollY } = this.state;
    const { setViewSelection, viewWidth, viewHeight } = this.props;

    const localScale = this.localScale();
    const localViewHeight = viewHeight * localScale.y - localScale.yOffset;
    const localViewWidth = viewWidth * localScale.x - localScale.xOffset;
    const newScrollY = clampOverlap(scrollY, localViewHeight, selY, selY + 1);
    const newScrollX = clampOverlap(scrollX, localViewWidth, selX, selX + 1);
    this.setState({ scrollY: newScrollY, scrollX: newScrollX });
    const worldCoords = this.localToWorld({ y: selY, x: selX });
    setViewSelection(worldCoords.y, worldCoords.x);
    this.updateSelection();
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
    const elemsIntoWindowY = Math.max(0, localScale.y * windowY - localScale.yOffset);
    const elemsIntoWindowX = Math.max(0, localScale.x * windowX - localScale.xOffset);

    // Turn "offset from top-left elem" into "offset from very start"
    // Always truncate in case someone sends us a fractional world coord
    // we can't deal with.
    // Also, don't let it go negative -- we might click on a header :-/
    // Maybe that'll be useful later...
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
    const windowY = (elemsIntoWindowY + localScale.yOffset) / localScale.y;
    const windowX = (elemsIntoWindowX + localScale.xOffset) / localScale.x;

    // Turn "coords from top left of window" into "coords from top left of
    // sheet. Possibly ends up fractional :-)
    const { viewOffsetY, viewOffsetX } = this.props;
    return {
      y: windowY + viewOffsetY,
      x: windowX + viewOffsetX,
    };
  }

  // eslint-disable-next-line class-methods-use-this
  localScale() {
    return { y: 1, x: 1, yOffset: 0, xOffset: 0 };
  }

  selectedCellId() {
    const { selY, selX } = this.localSelection();
    const selectedCell = this.maybeSelectedCell();
    const { contextId } = this.props;
    return {
      context: contextId,
      cellId: selectedCell && selectedCell.id, // may be undefined
      y: selY,
      x: selX,
    };
  }

  updateSelection() {
    const { setFormulaSelection, viewSelected } = this.props;
    if (!viewSelected) return;
    const selectedCell = this.maybeSelectedCell();
    // If we've selected a table or something we should let them update
    // the formula box.
    if (selectedCell && !selectedCell.formula) return;
    setFormulaSelection(this.selectedCellId());
  }

  move(dy, dx, event) {
    // All coords are "local", scaled for our data and relative to the
    // start of our data.
    const { selY, selX } = this.localSelection();
    const selectedCell = this.maybeSelectedCell();

    // Speed past "big" cells -- move multiple "spaces"
    const selBox = selectedCell ?
      this.cellPosition(selectedCell) :
      { x: selX, y: selY, width: 1, height: 1 };
    const wantedNewY = maybeBreakOut(selY, dy, selBox.y, selBox.height);
    const wantedNewX = maybeBreakOut(selX, dx, selBox.x, selBox.width);

    // Clamp wanted selection to navigable cells.
    const { yLB, yUB, xLB, xUB } = this.bounds();
    const newY = clampOverlap(wantedNewY, 1, yLB, yUB);
    const newX = clampOverlap(wantedNewX, 1, xLB, xUB);

    if (
      rangesOverlap(newY, 1, selBox.y, selBox.height) &&
      rangesOverlap(newX, 1, selBox.x, selBox.width)
    ) {
      // Only move (and swallow event) if we actually move somewhere.
      // In particular, send the event to our parent if we hit a wall.
      return;
    }
    this.setSelection(newY, newX);
    event.preventDefault();
  }

  cellKeys(ev) {
    const { formulaRef, readOnly } = this.props;
    const realFormulaRef = formulaRef && formulaRef.getWrappedInstance();

    if (this.childSelectionTableRef) {
      this.childSelectionTableRef
        .getWrappedInstance()
        .cellKeys(ev);
      if (ev.defaultPrevented) return;
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
      this.move(...moves[ev.key], ev);
    }
    if (ev.key === 'Enter') {
      if (ev.shiftKey) {
        this.move(-1, 0, ev);
      } else if (readOnly) {
        this.move(1, 0, ev);
      } else if (realFormulaRef) {
        // Enter selects the formula box when editable
        realFormulaRef.focus();
        ev.preventDefault();
      }
    }
    if (ev.key === 'Tab') {
      const xMove = ev.shiftKey ? -1 : 1;
      this.move(0, xMove, ev);
    }
    if (ev.key === 'Escape') {
      const { popViewStack } = this.props;
      popViewStack();
      ev.preventDefault();
    }

    // Modification actions
    if (ev.key === 'Backspace' || ev.key === 'Delete') {
      ev.preventDefault();
      if (!readOnly) {
        // Careful: swallow the event so a parent doesn't get it.
        const selection = this.selectedCellId();
        const { deleteCellProp } = this.props;
        if (selection.cellId) deleteCellProp(selection.cellId);
        if (realFormulaRef) realFormulaRef.resetValue();
      }
    }
    if (ev.key.length === 1) {
      // User just starts typing.
      // Careful: swallow the event so a parent doesn't get it.
      ev.preventDefault();
      if (!readOnly && realFormulaRef) {
        realFormulaRef.sendKey(ev.key);
      }
    }
  }

  formulaKeys(ev) {
    if (this.childSelectionTableRef) {
      this.childSelectionTableRef
        .getWrappedInstance()
        .formulaKeys(ev);
      if (ev.defaultPrevented) return;
    }
    const { formulaRef } = this.props;
    const realFormulaRef = formulaRef && formulaRef.getWrappedInstance();
    if (ev.key === 'Escape') {
      // Enter selects the formula box
      if (realFormulaRef) realFormulaRef.blur();
      ev.preventDefault();
    }
    // I'm not over the moon about intercepting shift-enter and tab --
    // they could be useful for entering multiline, rich text etc...
    // Maybe if/when we do that, that entry can suppress this behaviour?
    if (ev.key === 'Enter') {
      if (realFormulaRef) realFormulaRef.submit(ev);
      const yMove = ev.shiftKey ? -1 : 1;
      this.move(yMove, 0, ev);
    }
    if (ev.key === 'Tab') {
      if (realFormulaRef) realFormulaRef.submit(ev);
      const xMove = ev.shiftKey ? -1 : 1;
      this.move(0, xMove, ev);
    }
  }

  render() {
    return false;
  }
}
