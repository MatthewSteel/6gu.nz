import React, { Component } from 'react';
import { connect } from 'react-redux';
import {
  getCellsByTableId,
  getCellValuesById,
  getTablesById,
} from '../../selectors/formulas/formulas';
import CellComponent from '../CellComponent/CellComponent';
import FormulaComponent from '../FormulaComponent/FormulaComponent';
import { setFormula } from '../../redux/store';
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
  setCellFormula: (tableId, cellId, formula) => dispatch(setFormula(tableId, cellId, formula)),
});

const isWithin = (selection, cell) => {
  const [selY, selX] = selection;
  const { x, y, width, height } = cell;
  return (
    y <= selY && selY < y + height &&
    x <= selX && selX < x + width
  );
};

class TableComponent extends Component {
  constructor(props) {
    super(props);
    this.state = { selection: [0, 0] };
    this.selectedCellId = this.selectedCellId.bind(this);
    this.setSelection = this.setSelection.bind(this);
    this.setFormula = this.setFormula.bind(this);
  }

  setSelection(y, x) {
    this.setState({ selection: this.selectedCellId([y, x]) });
  }

  setFormula(stringFormula) {
    const { tableId, setCellFormula } = this.props;
    setCellFormula(tableId, this.state.selection, stringFormula);
  }

  selectedCellId(selection) {
    const { cells } = this.props;
    const selectedCell = cells.find(cell => isWithin(selection, cell));
    return selectedCell ?
      selectedCell.id :
      `_${selection[0] + 1}_${selection[1] + 1}`;
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
          fmt={v => v}
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
            fmt={v => v}
            selected={cellSelected}
            setSelection={this.setSelection}
          />
        ));
      }
    }
    return (
      <div>
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
