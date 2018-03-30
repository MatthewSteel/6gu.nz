import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import {
  getCellsByTableIdHelper,
  getCellValuesById,
  getTables,
} from '../../selectors/formulas/selectors';
import {
  deleteCell,
  loadFile,
  setFormula,
} from '../../redux/store';
import TableComponent from '../TableComponent/TableComponent';
import FileComponent from '../FileComponent/FileComponent';

const mapStateToProps = state => ({
  cellValuesById: getCellValuesById(state),
  tables: getTables(state),
  cellsByTableId: getCellsByTableIdHelper(state),
});

const mapDispatchToProps = dispatch => ({
  deleteCellProp: cellId => dispatch(deleteCell(cellId)),
  setCellFormula: (tableId, cellId, formula) => dispatch(setFormula(tableId, cellId, formula)),
  loadFileProp: () => dispatch(loadFile()),
});

class BookComponent extends PureComponent {
  constructor(props) {
    super(props);
    this.setTableSelection = this.setTableSelection.bind(this);
    this.state = { selectedTableId: props.tables[0].id };
  }

  setTableSelection(tableId) {
    this.setState({ selectedTableId: tableId });
  }

  render() {
    const {
      cellsByTableId,
      cellValuesById,
      tables,
      setCellFormula,
      deleteCellProp,
      loadFileProp,
    } = this.props;
    const { selectedTableId } = this.state;

    const tableComponents = tables.map((table) => {
      const tableCells = cellsByTableId[table.id] || [];
      return (
        <TableComponent
          key={table.id}
          table={table}
          cells={tableCells}
          cellValuesById={cellValuesById[table.id].byId}
          selected={selectedTableId === table.id}
          deleteCell={deleteCellProp}
          setCellFormula={setCellFormula}
          setTableSelection={this.setTableSelection}
        />
      );
    });

    return (
      <div>
        {tableComponents}
        <FileComponent
          loadFile={loadFileProp}
        />
      </div>
    );
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(BookComponent);
