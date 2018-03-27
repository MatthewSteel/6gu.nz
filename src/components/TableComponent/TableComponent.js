import React, { Component } from 'react';
import { connect } from 'react-redux';
import {
  getCellsByTableId,
  getCellValuesById,
  getTablesById,
} from '../../selectors/formulas/selectors';
import CellComponent from '../CellComponent/CellComponent';
import FormulaComponent from '../FormulaComponent/FormulaComponent';
import { deleteCell, setFormula } from '../../redux/store';
import './TableComponent.css';

const mapStateToProps = (state, ownProps) => {
  const { tableId } = ownProps;
  const ret = {
    cellValuesById: getCellValuesById(state),
    table: getTablesById(state)[tableId],
    cells: getCellsByTableId(state, tableId),
  };
  return ret;
};

const mapDispatchToProps = dispatch => ({
  deleteCellProp: cellId => dispatch(deleteCell(cellId)),
  setCellFormula: (tableId, cellId, formula) => dispatch(setFormula(tableId, cellId, formula)),
});

const isWithin = (selY, selX, cell) => {
  const { x, y, width, height } = cell;
  return (
    y <= selY && selY < y + height &&
    x <= selX && selX < x + width
  );
};

const defaultFormatter = (value) => {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
};

class TableComponent extends Component {
  constructor(props) {
    super(props);
    this.selectedCellId = this.selectedCellId.bind(this);
    this.setSelection = this.setSelection.bind(this);
    this.setFormula = this.setFormula.bind(this);
    this.updateSelection = this.updateSelection.bind(this);

    this.state = {
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

  setSelection(selY, selX) {
    this.setState({
      selY,
      selX,
      selection: this.selectedCellId(selY, selX),
    });
  }

  setFormula(stringFormula) {
    const { deleteCellProp, tableId, setCellFormula } = this.props;
    const { selection } = this.state;
    if (stringFormula === '') {
      deleteCellProp(selection);
    } else {
      setCellFormula(tableId, selection, stringFormula);
    }
    this.setState({ selection: null });
  }

  selectedCellId(selY, selX) {
    const { cells } = this.props;
    const selectedCell = cells.find(cell => isWithin(selY, selX, cell));
    return selectedCell ?
      selectedCell.id :
      `_${selY + 1}_${selX + 1}`;
  }

  updateSelection() {
    const { selY, selX } = this.state;
    this.setState({ selection: this.selectedCellId(selY, selX) });
  }

  render() {
    const { cells, cellValuesById, table } = this.props;
    const { selection } = this.state;
    const style = {
      gridTemplateColumns: 'auto '.repeat(table.width).trim(),
      gridTemplateRows: 'auto '.repeat(table.height).trim(),
    };

    const drawnCells = new Set();

    const filledCells = cells.map((cell) => {
      const { id, x, y, width, height, name } = cell;

      for (let dy = 1; dy <= height; ++dy) {
        for (let dx = 1; dx <= width; ++dx) {
          drawnCells.add(`_${y + dy}_${x + dx}`);
        }
      }
      const selected = selection === cell.id;
      return (
        <CellComponent
          key={id}
          id={id}
          x={x + 1}
          width={width}
          y={y + 1}
          height={height}
          name={name}
          value={cellValuesById[id]}
          fmt={defaultFormatter}
          selected={selected}
          setSelection={this.setSelection}
        />
      );
    });

    const emptyCells = [];
    for (let cy = 1; cy <= table.height; ++cy) {
      for (let cx = 1; cx <= table.width; ++cx) {
        const place = `_${cy}_${cx}`;
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
          selection={selection}
          setFormula={this.setFormula}
        />
      </div>
    );
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(TableComponent);
