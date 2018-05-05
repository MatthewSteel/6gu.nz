import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import {
  getCellValuesById,
  getSheets,
  getSheetsById,
  getRefsById,
} from '../../selectors/formulas/selectors';
import store, { createSheet, loadFile } from '../../redux/store';
import SheetComponent from '../SheetComponent/SheetComponent';
import FileComponent from '../FileComponent/FileComponent';

const mapStateToProps = state => ({
  cellValuesById: getCellValuesById(state),
  refsById: getRefsById(state),
  sheetsById: getSheetsById(state),
  sheets: getSheets(state),
});

const mapDispatchToProps = dispatch => ({
  loadFileProp: () => dispatch(loadFile()),
  createSheetProp: () => dispatch(createSheet()),
});

class BookComponent extends PureComponent {
  constructor(props) {
    super(props);
    this.pushStack = this.pushStack.bind(this);
    this.popStack = this.popStack.bind(this);
    this.setViewSelection = this.setViewSelection.bind(this);
    this.changeSheetViewSheet = this.changeSheetViewSheet.bind(this);
    this.updateView = this.updateView.bind(this);
    this.normaliseView = this.normaliseView.bind(this);
    this.state = {
      selectedViewId: '0',
      views: [{
        id: '0',
        stack: [],
        sheetId: props.sheets[0].id,
      }, {
        id: '1',
        stack: [],
        sheetId: props.sheets[1].id,
      }],
    };
  }

  setViewSelection(viewId) {
    this.setState({ selectedViewId: viewId });
  }

  changeSheetViewSheet(ev) {
    const targetSheetId = ev.target.value;
    if (targetSheetId === 'new') {
      const { createSheetProp } = this.props;
      createSheetProp();

      // Is this bad practice? The sheet will not be in our props...
      const allSheets = getSheets(store.getState());
      const createdSheet = allSheets[allSheets.length - 1];
      this.setState({
        selectedViewId: ev.target.name,
        views: this.updateView(this.state.views, ev.target.name, () => (
          { sheetId: createdSheet.id, stack: [] })),
      });
      return;
    }
    this.setState({
      selectedViewId: ev.target.name,
      views: this.updateView(this.state.views, ev.target.name, () => (
        { sheetId: targetSheetId, stack: [] })),
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
    const { stack, sheetId } = view;
    let sheetData = this.props.cellValuesById[sheetId];
    const newStack = [];
    stack.forEach((stackRef) => {
      if (sheetData && sheetData.byId[stackRef]) {
        newStack.push(stackRef);
      } else {
        sheetData = null;
      }
    });
    return {
      ...view,
      stack: newStack,
    };
  }

  render() {
    const {
      refsById,
      cellValuesById,
      sheets,
      loadFileProp,
      sheetsById,
    } = this.props;
    const { selectedViewId, views } = this.state;

    const sheetComponents = views.map(({ id, stack, sheetId }) => {
      const sheetName = sheetsById[sheetId].name;
      const viewData = [{
        ...cellValuesById[sheetId],
        path: sheetName,
      }];
      let pathStillValid = true;
      stack.forEach((stackRef) => {
        const lastViewData = viewData[viewData.length - 1];
        const newData = lastViewData.byId[stackRef];
        pathStillValid = pathStillValid && newData;
        if (pathStillValid) {
          const { name } = refsById[stackRef];
          viewData.push({
            ...newData.value,
            path: `${lastViewData.path}.${name}`,
          });
        }
      });

      const sheetViews = viewData.map(({ template, byId, path }, i) => (
        <SheetComponent
          key={path}
          path={path}
          viewId={id}
          sheetId={template}
          cellValuesById={byId}
          readOnly={i !== 0}
          selected={selectedViewId === id && i === viewData.length - 1}
          setViewSelection={this.setViewSelection}
          isChild={i !== 0}
          popViewStack={this.popStack}
          pushViewStack={this.pushStack}
          height={5}
          width={6}
          depth={i}
        >
          <select
            className="ViewSelect"
            name={id}
            value={sheetId}
            onChange={this.changeSheetViewSheet}
          >
            {sheets.map(sheet => (
              <option
                key={sheet.id}
                value={sheet.id}
              >
                {sheet.name}
              </option>
            ))}
            <option
              key="new"
              value="new"
            >
              {'{New sheet}'}
            </option>
          </select>
        </SheetComponent>
      ));
      return (
        <div key={id} style={{ display: 'grid' }}>
          {sheetViews}
        </div>
      );
    });

    return (
      <div>
        {sheetComponents}
        <FileComponent
          loadFile={loadFileProp}
        />
      </div>
    );
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(BookComponent);
