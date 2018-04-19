import React, { Component, Fragment } from 'react';
import { connect } from 'react-redux';

import KeyboardListenerComponent from '../KeyboardListenerComponent/KeyboardListenerComponent';
import CellComponent from '../CellComponent/CellComponent';
import EmptyCellComponent from '../CellComponent/EmptyCellComponent';

import { getCellsBySheetId } from '../../selectors/formulas/selectors';
import { clampOverlap, overlaps } from '../../selectors/geom/geom';
import { deleteCell } from '../../redux/store';

import './SheetComponent.css';

class SheetContentsComponent extends Component {
  constructor(props) {
    super(props);
    this.cellKeys = this.cellKeys.bind(this);
    this.formulaKeys = this.formulaKeys.bind(this);
    this.move = this.move.bind(this);
    this.selectedCellId = this.selectedCellId.bind(this);
    this.setSelection = this.setSelection.bind(this);
    this.setViewSelection = this.setViewSelection.bind(this);
    this.setChildSelectionTableRef = this.setChildSelectionTableRef.bind(this);
    this.updateSelection = this.updateSelection.bind(this);

    this.childSelectionTableRef = null;
    this.state = {
      selY: 0,
      selX: 0,
      viewX: 0,
      viewY: 0,
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
    const { viewY, viewX } = this.state;
    const selY = viewSelY + viewY;
    const selX = viewSelX + viewX;
    this.setSelection(selY, selX);
  }

  setSelection(selY, selX) {
    const { viewX, viewY } = this.state;
    const { getViewFocus, viewWidth, viewHeight } = this.props;
    const newViewY = clampOverlap(viewY, viewHeight, selY, selY + 1);
    const newViewX = clampOverlap(viewX, viewWidth, selX, selX + 1);
    this.setState({
      selY,
      selX,
      viewY: newViewY,
      viewX: newViewX,
    });
    getViewFocus();
    this.updateSelection();
  }

  selectedCellId(selY, selX) {
    const { cells } = this.props;
    const selectedCell = cells.find(cell =>
      overlaps(selY, 1, selX, 1, cell));
    return selectedCell ?
      selectedCell.id :
      `${selY},${selX}`;
  }

  updateSelection() {
    const { setFormulaSelectionId } = this.props;
    const { selY, selX } = this.state;
    setFormulaSelectionId(this.selectedCellId(selY, selX));
  }

  move(dy, dx) {
    const { selY, selX } = this.state;
    this.setSelection(
      clampOverlap(selY + dy, 1, 0, Infinity),
      clampOverlap(selX + dx, 1, 0, Infinity),
    );
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
      this.move(...moves[ev.key]);
      ev.preventDefault();
    }
    if (ev.key === 'Enter') {
      if (ev.shiftKey) {
        this.move(-1, 0);
        ev.preventDefault();
      } else {
        if (readOnly) {
          this.move(1, 0);
        } else if (realFormulaRef) {
          // Enter selects the formula box when editable
          realFormulaRef.focus();
        }
        ev.preventDefault();
      }
    }
    if (ev.key === 'Tab') {
      const xMove = ev.shiftKey ? -1 : 1;
      this.move(0, xMove);
      ev.preventDefault();
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
        const { selY, selX } = this.state;
        const selection = this.selectedCellId(selY, selX);
        const { deleteCellProp } = this.props;
        deleteCellProp(selection);
        if (realFormulaRef) realFormulaRef.resetValue();
      }
    }
    if (ev.key.length === 1) {
      // User just starts typing.
      // Careful: swallow the event so a parent doesn't get it.
      ev.preventDefault();
      if (!readOnly) {
        if (realFormulaRef) realFormulaRef.sendKey(ev.key);
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
      this.move(yMove, 0);
      ev.preventDefault();
    }
    if (ev.key === 'Tab') {
      if (realFormulaRef) realFormulaRef.submit(ev);
      const xMove = ev.shiftKey ? -1 : 1;
      this.move(0, xMove);
      ev.preventDefault();
    }
  }

  render() {
    const {
      cells,
      cellValuesById,
      formulaHasFocus,
      pushViewStack,
      viewSelected,
      viewWidth,
      viewHeight,
    } = this.props;
    const { selY, selX, viewY, viewX } = this.state;
    const selection = this.selectedCellId(selY, selX);

    const filledCells = cells.map((cell) => {
      if (!overlaps(viewY, viewHeight, viewX, viewWidth, cell)) {
        return false;
      }
      const {
        id,
        x,
        y,
        width: cellWidth,
        height: cellHeight,
        name,
      } = cell;

      const cellSelected = viewSelected && selection === cell.id;

      return (
        <CellComponent
          key={id}
          id={id}
          x={x - viewX}
          width={cellWidth}
          y={y - viewY}
          height={cellHeight}
          name={name}
          value={cellValuesById[id]}
          pushViewStack={pushViewStack}
          selected={cellSelected}
          setSelection={this.setViewSelection}
        />
      );
    }).filter(Boolean);

    const emptyCells = [];
    for (let cy = 0; cy < viewHeight; ++cy) {
      for (let cx = 0; cx < viewWidth; ++cx) {
        const place = `${cy + viewY},${cx + viewX}`;
        const cellSelected = viewSelected && place === selection;
        emptyCells.push((
          <EmptyCellComponent
            key={place}
            x={cx}
            y={cy}
            selected={cellSelected}
            setSelection={this.setViewSelection}
          />
        ));
      }
    }
    return (
      <Fragment>
        {emptyCells}
        {filledCells}
        {viewSelected && !formulaHasFocus &&
          <KeyboardListenerComponent
            callback={this.cellKeys}
          />
        }
        {viewSelected && formulaHasFocus &&
          <KeyboardListenerComponent
            callback={this.formulaKeys}
          />
        }
      </Fragment>
    );
  }
}

const mapStateToProps = (state, ownProps) => ({
  cells: getCellsBySheetId(state, ownProps.sheetId),
});

const mapDispatchToProps = dispatch => ({
  deleteCellProp: cellId => dispatch(deleteCell(cellId)),
});

export default connect(mapStateToProps, mapDispatchToProps)(SheetContentsComponent);
