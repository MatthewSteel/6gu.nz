import { Component } from 'react';
import { clampOverlap } from '../../selectors/geom/geom';

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
    this.state = {
      selY: 0,
      selX: 0,
      scrollX: 0,
      scrollY: 0,
    };
    this.updateSelection();
  }

  componentDidUpdate() {
    this.updateSelection();
  }

  setChildSelectionTableRef(ref) {
    this.childSelectionTableRef = ref;
  }

  setViewSelection(viewSelY, viewSelX) {
    const { scrollY, scrollX } = this.state;
    const { viewOffsetY, viewOffsetX } = this.props;
    const selY = viewSelY + scrollY - viewOffsetY;
    const selX = viewSelX + scrollX - viewOffsetX;
    this.setSelection(selY, selX);
  }

  setSelection(selY, selX) {
    const { scrollX, scrollY } = this.state;
    const { getViewFocus, viewWidth, viewHeight } = this.props;
    const newScrollY = clampOverlap(scrollY, viewHeight, selY, selY + 1);
    const newScrollX = clampOverlap(scrollX, viewWidth, selX, selX + 1);
    this.setState({
      selY,
      selX,
      scrollY: newScrollY,
      scrollX: newScrollX,
    });
    getViewFocus();
    this.updateSelection();
  }

  selectedCellId() {
    const { selY, selX } = this.state;
    const selectedCell = this.maybeSelectedCell();
    const { sheetId } = this.props;
    return {
      context: sheetId,
      cellId: selectedCell && selectedCell.id, // may be undefined
      y: selY,
      x: selX,
    };
  }

  updateSelection() {
    const { setFormulaSelection } = this.props;
    setFormulaSelection(this.selectedCellId());
  }

  move(dy, dx, event) {
    const { selY, selX } = this.state;
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

    // Only move (and swallow event) if we actually move somewhere.
    // In particular, send the event to our parent if we hit a wall.
    if (newY === selY && newX === selX) return;
    this.setSelection(newY, newX);
    event.preventDefault();
  }

  cellKeys(ev) {
    const { formulaRef, readOnly } = this.props;
    const realFormulaRef = formulaRef && formulaRef.getWrappedInstance();

    if (this.childSelectionTableRef) {
      this.childSelectionTableRef.sendKey(ev);
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
