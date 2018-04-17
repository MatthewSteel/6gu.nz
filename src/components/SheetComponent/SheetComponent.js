import React, { Component } from 'react';
import { connect } from 'react-redux';

import CellComponent from '../CellComponent/CellComponent';
import EmptyCellComponent from '../CellComponent/EmptyCellComponent';
import FormulaComponent from '../FormulaComponent/FormulaComponent';
import KeyboardListenerComponent from '../KeyboardListenerComponent/KeyboardListenerComponent';

import { getCellsBySheetId } from '../../selectors/formulas/selectors';
import { clampOverlap, overlaps } from '../../selectors/geom/geom';
import { deleteCell, setFormula } from '../../redux/store';

import './SheetComponent.css';

class SheetComponent extends Component {
  constructor(props) {
    super(props);
    this.cellKeys = this.cellKeys.bind(this);
    this.formulaKeys = this.formulaKeys.bind(this);
    this.getFocus = this.getFocus.bind(this);
    this.move = this.move.bind(this);
    this.selectedCellId = this.selectedCellId.bind(this);
    this.setSelection = this.setSelection.bind(this);
    this.setFormula = this.setFormula.bind(this);
    this.setFormulaFocus = this.setFormulaFocus.bind(this);
    this.setFormulaRef = this.setFormulaRef.bind(this);
    this.setSelectionRef = this.setSelectionRef.bind(this);
    this.updateSelection = this.updateSelection.bind(this);
    this.popStack = this.popStack.bind(this);

    this.formulaRef = null;
    this.selectionRef = null;
    this.state = {
      formulaHasFocus: false,
      selY: 0,
      selX: 0,
      selection: this.selectedCellId(0, 0),
      viewX: 0,
      viewY: 0,
    };
  }

  componentDidUpdate() {
    if (!this.state.selection) {
      this.updateSelection();
    }
  }

  getFocus() {
    const { setViewSelection, viewId } = this.props;
    setViewSelection(viewId);
  }

  setFormulaRef(ref) {
    this.formulaRef = ref;
  }

  setSelectionRef(ref) {
    this.selectionRef = ref;
  }

  setSelection(selY, selX) {
    const { viewX, viewY } = this.state;
    const { width, height } = this.props;
    const newViewY = clampOverlap(viewY, height, selY, selY + 1);
    const newViewX = clampOverlap(viewX, width, selX, selX + 1);
    this.setState({
      selY,
      selX,
      viewY: newViewY,
      viewX: newViewX,
      selection: this.selectedCellId(selY, selX),
    });
    this.getFocus();
  }

  setFormulaFocus(formulaHasFocus) {
    // callback used by formula component
    this.setState({ formulaHasFocus });
    if (formulaHasFocus) {
      this.getFocus();
    }
  }

  setFormula(stringFormula) {
    this.getFocus();
    const { deleteCellProp, sheetId, setCellFormula, readOnly } = this.props;
    const { selection } = this.state;
    if (readOnly) return;
    if (stringFormula === '') {
      deleteCellProp(selection);
    } else {
      setCellFormula(sheetId, selection, stringFormula);
    }
    this.setState({ selection: null });
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
    const { selY, selX } = this.state;
    this.setState({ selection: this.selectedCellId(selY, selX) });
  }

  move(dy, dx) {
    const { selY, selX } = this.state;
    this.setSelection(
      clampOverlap(selY + dy, 1, 0, Infinity),
      clampOverlap(selX + dx, 1, 0, Infinity),
    );
  }

  cellKeys(ev) {
    const { readOnly } = this.props; // TODO: sheets, for a bit.
    if (this.selectionRef) {
      this.selectionRef.sendKey(ev);
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
        } else {
          // Enter selects the formula box when editable
          this.formulaRef.focus();
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
      this.popStack(ev);
      ev.preventDefault();
    }

    // Modification actions
    if (readOnly) return;
    if (ev.key === 'Backspace' || ev.key === 'Delete') {
      const { selection } = this.state;
      const { deleteCellProp } = this.props;
      deleteCellProp(selection);
      this.setState({ selection: null });
      this.formulaRef.resetValue();
      ev.preventDefault();
    }
    if (ev.key.length === 1) {
      // User just starts typing :-)
      this.formulaRef.sendKey(ev.key);
      ev.preventDefault();
    }
  }

  popStack(ev) {
    const { popViewStack, viewId } = this.props;
    popViewStack(viewId);
    ev.preventDefault();
  }

  formulaKeys(ev) {
    if (ev.key === 'Escape') {
      // Enter selects the formula box
      this.formulaRef.blur();
      ev.preventDefault();
    }
    // I'm not over the moon about intercepting shift-enter and tab --
    // they could be useful for entering multiline, rich text etc...
    // Maybe if/when we do that, that entry can suppress this behaviour?
    if (ev.key === 'Enter') {
      this.formulaRef.submit(ev);
      const yMove = ev.shiftKey ? -1 : 1;
      this.move(yMove, 0);
      ev.preventDefault();
    }
    if (ev.key === 'Tab') {
      this.formulaRef.submit(ev);
      const xMove = ev.shiftKey ? -1 : 1;
      this.move(0, xMove);
      ev.preventDefault();
    }
  }

  render() {
    const {
      children,
      cells,
      cellValuesById,
      path,
      isChild,
      pushViewStack,
      viewId,
      readOnly,
      selected,
      width: viewWidth,
      height: viewHeight,
      depth,
    } = this.props;
    const { formulaHasFocus, selection, viewY, viewX } = this.state;
    const style = {
      gridTemplateColumns: `repeat(${viewWidth}, auto)`,
      gridTemplateRows: `repeat(${viewHeight * 2}, 2.5ex)`,
      zIndex: depth + 1,
    };

    let selectionError;
    let selectionValueOverride;

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

      const cellSelected = selected && selection === cell.id;

      // TODO: Tables etc.
      if (cellSelected) {
        selectionError = cellValuesById[id].error;
        selectionValueOverride = cellValuesById[id].override;
      }
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
          viewId={viewId}
          selected={cellSelected}
          setSelection={this.setSelection}
        />
      );
    }).filter(Boolean);

    const emptyCells = [];
    for (let cy = 0; cy < viewHeight; ++cy) {
      for (let cx = 0; cx < viewWidth; ++cx) {
        const place = `${cy + viewY},${cx + viewX}`;
        const cellSelected = selected && place === selection;
        emptyCells.push((
          <EmptyCellComponent
            key={place}
            x={cx}
            y={cy}
            selected={cellSelected}
            setSelection={this.setSelection}
          />
        ));
      }
    }
    return (
      <div className="SheetContainer">
        <div className="SheetTitle">
          {path}
          {isChild && (
            <button onClick={this.popStack} className="StackButton">&times;</button>
          )}
        </div>
        <div
          className="Sheet"
          style={style}
        >
          {emptyCells}
          {filledCells}
        </div>
        <div className="SheetViewInputRow">
          <FormulaComponent
            readOnly={readOnly}
            ref={this.setFormulaRef}
            selection={selection}
            setFormula={this.setFormula}
            setFormulaHasFocus={this.setFormulaFocus}
          />
          {selected && !formulaHasFocus &&
            <KeyboardListenerComponent
              callback={this.cellKeys}
            />
          }
          {selected && formulaHasFocus &&
            <KeyboardListenerComponent
              callback={this.formulaKeys}
            />
          }
          {children}
        </div>
        <div>
          <span className="SheetErrorText">{selectionError}&nbsp;</span>
          {selectionValueOverride &&
            <span className="SheetOverrideText">Value overridden in call</span>
          }
        </div>
      </div>
    );
  }
}

const mapStateToProps = (state, ownProps) => ({
  cells: getCellsBySheetId(state, ownProps.sheetId),
});

const mapDispatchToProps = dispatch => ({
  deleteCellProp: cellId => dispatch(deleteCell(cellId)),
  setCellFormula: (sheetId, cellId, formula) => dispatch(setFormula(sheetId, cellId, formula)),
});

export default connect(mapStateToProps, mapDispatchToProps)(SheetComponent);
