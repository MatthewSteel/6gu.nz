import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import {
  getCellsByTableIdHelper,
  getCellValuesById,
  getTables,
  getTablesById,
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
  tablesById: getTablesById(state),
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
    this.setViewSelection = this.setViewSelection.bind(this);
    this.changeTableViewTable = this.changeTableViewTable.bind(this);
    this.state = {
      selectedViewId: '0',
      views: [{
        id: '0',
        tableId: props.tables[0].id,
      }, {
        id: '1',
        tableId: props.tables[1].id,
      }],
    };
  }

  setViewSelection(viewId) {
    this.setState({ selectedViewId: viewId });
  }

  changeTableViewTable(ev) {
    const { views } = this.state;
    const targetTableId = ev.target.value;
    this.setState({
      selectedViewId: ev.target.name,
      views: [...views.map((view) => {
        if (view.id !== ev.target.name) return view;
        return { ...view, tableId: targetTableId };
      })],
    });
  }

  render() {
    const {
      cellsByTableId,
      cellValuesById,
      tables,
      tablesById,
      setCellFormula,
      deleteCellProp,
      loadFileProp,
    } = this.props;
    const { selectedViewId, views } = this.state;

    const tableComponents = views.map(({ id, tableId }) => {
      const tableCells = cellsByTableId[tableId] || [];
      return (
        <TableComponent
          key={id}
          viewId={id}
          table={tablesById[tableId]}
          cells={tableCells}
          cellValuesById={cellValuesById[tableId].byId}
          selected={selectedViewId === id}
          deleteCell={deleteCellProp}
          setCellFormula={setCellFormula}
          setViewSelection={this.setViewSelection}
        >
          <select
            className="ViewSelect"
            name={id}
            value={tableId}
            onChange={this.changeTableViewTable}
          >
            {tables.map(table => (
              <option
                key={table.id}
                value={table.id}
              >
                {table.name}
              </option>
            ))}
          </select>
        </TableComponent>
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
