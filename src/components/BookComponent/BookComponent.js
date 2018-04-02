import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import {
  getCellValuesById,
  getTables,
} from '../../selectors/formulas/selectors';
import { loadFile } from '../../redux/store';
import TableComponent from '../TableComponent/TableComponent';
import FileComponent from '../FileComponent/FileComponent';

const mapStateToProps = state => ({
  cellValuesById: getCellValuesById(state),
  tables: getTables(state),
});

const mapDispatchToProps = dispatch => ({
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
        stack: [],
        tableId: props.tables[0].id,
      }, {
        id: '1',
        stack: ['t0ref'],
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
      cellValuesById,
      tables,
      loadFileProp,
    } = this.props;
    const { selectedViewId, views } = this.state;

    const tableComponents = views.map(({ id, stack, tableId }) => {
      const viewData = [{
        ...cellValuesById[tableId],
        path: '',
      }];
      stack.forEach((name) => {
        const lastViewData = viewData[viewData.length - 1];
        viewData.push({
          ...lastViewData.byName[name],
          path: `${lastViewData.path}.${name}`,
        });
      });

      const tableViews = viewData.map(({ template, byId, path }, i) => (
        <TableComponent
          key={path}
          viewId={id}
          tableId={template}
          cellValuesById={byId}
          readOnly={i !== 0}
          selected={selectedViewId === id && i === viewData.length - 1}
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
      ));
      return (
        <div style={{ display: 'grid' }}>
          {tableViews}
        </div>
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
