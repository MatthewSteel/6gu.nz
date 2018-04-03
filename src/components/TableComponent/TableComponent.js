import React, { Component } from 'react';
import { connect } from 'react-redux';

import CellComponent from '../CellComponent/CellComponent';
import FormulaComponent from '../FormulaComponent/FormulaComponent';
import KeyboardListenerComponent from '../KeyboardListenerComponent/KeyboardListenerComponent';

import {
  getCellsByTableId,
  getTablesById,
} from '../../selectors/formulas/selectors';
import { deleteCell, setFormula } from '../../redux/store';

import './TableComponent.css';

const isWithin = (selY, selX, cell) => {
  const { x, y, width, height } = cell;
  return (
    y <= selY && selY < y + height &&
    x <= selX && selX < x + width
  );
};

const defaultFormatter = (value, pushStack) => {
  if (typeof value === 'string') return value;
  if (value instanceof Array) {
    return `[${value.length}]`;
  }
  if (typeof value === 'object' && value.constructor === Object) {
    const contentsStr = `{${Object.keys(value.byName).length}}`;
    if (value.template) {
      return (
        <div style={{ position: 'relative', zIndex: 0 }}>
          {contentsStr}
          <button onClick={pushStack} className="StackButton">+</button>
        </div>
      );
    }
    return contentsStr;
  }
  if (typeof value === 'number') return value.toString();
  return JSON.stringify(value);
};

class TableComponent extends Component {
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
    this.updateSelection = this.updateSelection.bind(this);
    this.popStack = this.popStack.bind(this);

    this.formulaRef = null;
    this.state = {
      formulaHasFocus: false,
      selY: 0,
      selX: 0,
      selection: this.selectedCellId(0, 0),
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

  setSelection(selY, selX) {
    this.setState({
      selY,
      selX,
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
    const { deleteCellProp, table, setCellFormula, readOnly } = this.props;
    const { selection } = this.state;
    if (readOnly) return;
    if (stringFormula === '') {
      deleteCellProp(selection);
    } else {
      setCellFormula(table.id, selection, stringFormula);
    }
    this.setState({ selection: null });
  }

  selectedCellId(selY, selX) {
    const { cells } = this.props;
    const selectedCell = cells.find(cell => isWithin(selY, selX, cell));
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
    const { width, height } = this.props.table;
    const newSelY = Math.min(height - 1, Math.max(0, selY + dy));
    const newSelX = Math.min(width - 1, Math.max(0, selX + dx));
    this.setSelection(newSelY, newSelX);
  }

  cellKeys(ev) {
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
        if (this.props.readOnly) {
          this.move(1, 0);
        } else {
          // Enter selects the formula box
          this.formulaRef.focus();
        }
        ev.preventDefault();
      }
    }
    if (ev.key === 'Tab') {
      // Enter selects the formula box
      const xMove = ev.shiftKey ? -1 : 1;
      this.move(0, xMove);
      ev.preventDefault();
    }

    // Modification actions
    if (this.props.readOnly) return;
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
      table,
    } = this.props;
    const { formulaHasFocus, selection } = this.state;
    const style = {
      gridTemplateColumns: 'auto '.repeat(table.width).trim(),
      gridTemplateRows: 'auto '.repeat(table.height).trim(),
    };

    const drawnCells = new Set();
    let err;

    const filledCells = cells.map((cell) => {
      const { id, x, y, width, height, name } = cell;

      for (let dy = 0; dy < height; ++dy) {
        for (let dx = 0; dx < width; ++dx) {
          drawnCells.add(`${y + dy},${x + dx}`);
        }
      }
      const cellSelected = selected && selection === cell.id;
      if (cellSelected) err = cellValuesById[id].error;
      return (
        <CellComponent
          key={id}
          id={id}
          x={x}
          width={width}
          y={y}
          height={height}
          name={name}
          value={cellValuesById[id]}
          fmt={defaultFormatter}
          pushViewStack={pushViewStack}
          viewId={viewId}
          selected={cellSelected}
          setSelection={this.setSelection}
        />
      );
    });

    const emptyCells = [];
    for (let cy = 0; cy < table.height; ++cy) {
      for (let cx = 0; cx < table.width; ++cx) {
        const place = `${cy},${cx}`;
        if (drawnCells.has(place)) continue;
        const cellSelected = selected && place === selection;
        emptyCells.push((
          <CellComponent
            key={place}
            id={place}
            x={cx}
            width={1}
            y={cy}
            height={1}
            name=""
            value="&nbsp;"
            fmt={defaultFormatter}
            selected={cellSelected}
            setSelection={this.setSelection}
          />
        ));
      }
    }
    return (
      <div className="TableContainer">
        <div className="TableTitle">
          {path}
          {isChild && (
            <button onClick={this.popStack} className="StackButton">&times;</button>
          )}
        </div>
        <div
          className="Table"
          style={style}
        >
          {filledCells}
          {emptyCells}
        </div>
        <div className="TableViewInputRow">
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
        <span className="TableErrorText">{err}&nbsp;</span>
      </div>
    );
  }
}

const mapStateToProps = (state, ownProps) => ({
  table: getTablesById(state)[ownProps.tableId],
  cells: getCellsByTableId(state, ownProps.tableId),
});

const mapDispatchToProps = dispatch => ({
  deleteCellProp: cellId => dispatch(deleteCell(cellId)),
  setCellFormula: (tableId, cellId, formula) => dispatch(setFormula(tableId, cellId, formula)),
});

export default connect(mapStateToProps, mapDispatchToProps)(TableComponent);
