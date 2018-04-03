import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import {
  getCellValuesById,
  getTables,
  getTablesById,
  getCellsById,
} from '../../selectors/formulas/selectors';
import { loadFile } from '../../redux/store';
import TableComponent from '../TableComponent/TableComponent';
import FileComponent from '../FileComponent/FileComponent';

const mapStateToProps = state => ({
  cellValuesById: getCellValuesById(state),
  cellsById: getCellsById(state),
  tablesById: getTablesById(state),
  tables: getTables(state),
});

const mapDispatchToProps = dispatch => ({
  loadFileProp: () => dispatch(loadFile()),
});

class BookComponent extends PureComponent {
  constructor(props) {
    super(props);
    this.pushStack = this.pushStack.bind(this);
    this.popStack = this.popStack.bind(this);
    this.setViewSelection = this.setViewSelection.bind(this);
    this.changeTableViewTable = this.changeTableViewTable.bind(this);
    this.updateView = this.updateView.bind(this);
    this.normaliseView = this.normaliseView.bind(this);
    this.state = {
      selectedViewId: '0',
      views: [{
        id: '0',
        stack: [],
        tableId: props.tables[0].id,
      }, {
        id: '1',
        stack: [],
        tableId: props.tables[1].id,
      }],
    };
  }

  setViewSelection(viewId) {
    this.setState({ selectedViewId: viewId });
  }

  changeTableViewTable(ev) {
    const targetTableId = ev.target.value;
    this.setState({
      selectedViewId: ev.target.name,
      views: this.updateView(this.state.views, ev.target.name, () => (
        { tableId: targetTableId, stack: [] })),
    });
  }

  pushStack(viewId, cellId) {
    this.setState({
      selectedViewId: viewId,
      views: this.updateView(this.state.views, viewId, view => (
        { stack: [...view.stack, cellId] })),
    });
  }

  popStack(viewId, n = 1) {
    this.setState({
      selectedViewId: viewId,
      views: this.updateView(this.state.views, viewId, view => (
        { stack: view.stack.slice(0, view.stack.length - n) })),
    });
  }

  updateView(views, viewId, f) {
    return [
      ...views.map((view) => {
        if (view.id !== viewId) return view;
        return { ...view, ...f(this.normaliseView(view)) };
      }),
    ];
  }

  normaliseView(view) {
    // A view stack may have invalid entries after some redux state update.
    // The view is robust at the moment (maybe it shouldn't need to be...)
    // but pushing/popping on a broken stack is no good. Fix it up before
    // working on it.
    const { stack, tableId } = view;
    let tableData = this.props.cellValuesById[tableId];
    const newStack = [];
    stack.forEach((stackRef) => {
      if (tableData && tableData.byId[stackRef]) {
        newStack.push(stackRef);
      } else {
        tableData = null;
      }
    });
    return {
      ...view,
      stack: newStack,
    };
  }

  render() {
    const {
      cellsById,
      cellValuesById,
      tables,
      loadFileProp,
      tablesById,
    } = this.props;
    const { selectedViewId, views } = this.state;

    const tableComponents = views.map(({ id, stack, tableId }) => {
      const tableName = tablesById[tableId].name;
      const viewData = [{
        ...cellValuesById[tableId],
        path: tableName,
      }];
      let pathStillValid = true;
      stack.forEach((stackRef) => {
        const lastViewData = viewData[viewData.length - 1];
        const newData = lastViewData.byId[stackRef];
        pathStillValid = pathStillValid && newData;
        if (pathStillValid) {
          const { name } = cellsById[stackRef];
          viewData.push({
            ...newData.value,
            path: `${lastViewData.path}.${name}`,
          });
        }
      });

      const tableViews = viewData.map(({ template, byId, path }, i) => (
        <TableComponent
          key={path}
          path={path}
          viewId={id}
          tableId={template}
          cellValuesById={byId}
          readOnly={i !== 0}
          selected={selectedViewId === id && i === viewData.length - 1}
          setViewSelection={this.setViewSelection}
          isChild={i !== 0}
          popViewStack={this.popStack}
          pushViewStack={this.pushStack}
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
        <div key={id} style={{ display: 'grid' }}>
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
