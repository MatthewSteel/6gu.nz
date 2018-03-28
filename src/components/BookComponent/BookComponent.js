import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import {
  getCellsByTableIdHelper,
  getCellValuesById,
  getTables,
} from '../../selectors/formulas/selectors';
import { deleteCell, setFormula } from '../../redux/store';
import TableComponent from '../TableComponent/TableComponent';

const mapStateToProps = state => ({
  cellValuesById: getCellValuesById(state),
  tables: getTables(state),
  cellsByTableId: getCellsByTableIdHelper(state),
});

const mapDispatchToProps = dispatch => ({
  deleteCellProp: cellId => dispatch(deleteCell(cellId)),
  setCellFormula: (tableId, cellId, formula) => dispatch(setFormula(tableId, cellId, formula)),
});

class BookComponent extends PureComponent {
  render() {
    const {
      cellsByTableId,
      cellValuesById,
      tables,
      setCellFormula,
      deleteCellProp,
    } = this.props;


    const tableComponents = tables.map((table) => {
      const tableCells = cellsByTableId[table.id] || [];
      return (
        <TableComponent
          key={table.id}
          table={table}
          cells={tableCells}
          cellValuesById={cellValuesById[table.id].byId}
          deleteCell={deleteCellProp}
          setCellFormula={setCellFormula}
        />
      );
    });

    return (
      <div>
        {tableComponents}
      </div>
    );
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(BookComponent);
