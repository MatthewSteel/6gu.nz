import React, { Component } from 'react';
import CellComponent from '../CellComponent/CellComponent';
import FormulaComponent from '../FormulaComponent/FormulaComponent';
import KeyboardListenerComponent from '../KeyboardListenerComponent/KeyboardListenerComponent';
import './TableComponent.css';

const isWithin = (selY, selX, cell) => {
  const { x, y, width, height } = cell;
  return (
    y <= selY && selY < y + height &&
    x <= selX && selX < x + width
  );
};

const defaultFormatter = (value) => {
  if (typeof value === 'string') return value;
  if (value instanceof Array) {
    if (value.length === 0) return '[]';
    return '[..]';
  }
  if (typeof value === 'object' && value.constructor === Object) {
    if (Object.keys(value).length === 0) return '{}';
    return '{..}';
  }
  if (typeof value === 'number') return value.toString();
  return JSON.stringify(value);
};

class TableComponent extends Component {
  constructor(props) {
    super(props);
    this.blurFormulaOnEsc = this.blurFormulaOnEsc.bind(this);
    this.handleKey = this.handleKey.bind(this);
    this.getFocus = this.getFocus.bind(this);
    this.move = this.move.bind(this);
    this.selectedCellId = this.selectedCellId.bind(this);
    this.setSelection = this.setSelection.bind(this);
    this.setFormula = this.setFormula.bind(this);
    this.setFormulaFocus = this.setFormulaFocus.bind(this);
    this.setFormulaRef = this.setFormulaRef.bind(this);
    this.updateSelection = this.updateSelection.bind(this);

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
    const { setTableSelection, table } = this.props;
    setTableSelection(table.id);
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
    const { deleteCell, table, setCellFormula } = this.props;
    const { selection } = this.state;
    if (stringFormula === '') {
      deleteCell(selection);
    } else {
      setCellFormula(table.id, selection, stringFormula);
    }
    this.setState({ selection: null });
    this.getFocus();
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

  handleKey(ev) {
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
    const moves = {
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
    };
    if (moves[ev.key]) {
      // Cursor key nav
      this.move(...moves[ev.key]);
      ev.preventDefault();
    }
    if (ev.key === 'Enter' && this.formulaRef) {
      // Enter selects the formula box
      this.formulaRef.focus();
      ev.preventDefault();
    }
    if (ev.key === 'Backspace' || ev.key === 'Delete') {
      const { selection } = this.state;
      const { deleteCell } = this.props;
      deleteCell(selection);
      ev.preventDefault();
    }
    if (ev.key.length === 1) {
      // User just starts typing :-)
      this.formulaRef.sendKey(ev.key);
      ev.preventDefault();
    }
  }

  blurFormulaOnEsc(ev) {
    if (ev.key === 'Escape' && this.formulaRef) {
      // Enter selects the formula box
      this.formulaRef.blur();
      ev.preventDefault();
    }
  }

  render() {
    const { cells, cellValuesById, selected, table } = this.props;
    const { formulaHasFocus, selection } = this.state;
    const style = {
      gridTemplateColumns: 'auto '.repeat(table.width).trim(),
      gridTemplateRows: 'auto '.repeat(table.height).trim(),
    };

    const drawnCells = new Set();

    const filledCells = cells.map((cell) => {
      const { id, x, y, width, height, name } = cell;

      for (let dy = 0; dy < height; ++dy) {
        for (let dx = 0; dx < width; ++dx) {
          drawnCells.add(`${y + dy},${x + dx}`);
        }
      }
      const cellSelected = selection === cell.id;
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
        const cellSelected = place === selection;
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
        <div className="TableTitle">{table.name}</div>
        <div
          className="Table"
          style={style}
        >
          {filledCells}
          {emptyCells}
        </div>
        <FormulaComponent
          ref={this.setFormulaRef}
          selection={selection}
          setFormula={this.setFormula}
          setFormulaHasFocus={this.setFormulaFocus}
        />
        {selected && !formulaHasFocus &&
          <KeyboardListenerComponent
            callback={this.handleKey}
          />
        }
        {selected && formulaHasFocus &&
          <KeyboardListenerComponent
            callback={this.blurFormulaOnEsc}
          />
        }
      </div>
    );
  }
}

export default TableComponent;
