import React, { Fragment } from 'react';
import { connect } from 'react-redux';

import CellNameComponent from '../CellComponent/CellNameComponent';
import CellValueComponent from '../CellComponent/CellValueComponent';
import CellSelectionComponent from '../CellComponent/CellSelectionComponent';
import EmptyCellComponent from '../CellComponent/EmptyCellComponent';
import ContentsBaseComponent from './ContentsBaseComponent';

import { getRefsById, refsAtPosition } from '../../selectors/formulas/selectors';
import { OBJECT_CELL, deleteLoc, deleteThing } from '../../redux/store';


class ObjectContentsComponent extends ContentsBaseComponent {
  static getDerivedStateFromProps(nextProps) {
    const { cells, tableData } = nextProps;
    if (cells) return { colsByIndex: cells.map(({ name }) => name) };
    const colsByIndex = [];
    Object.keys(tableData.byName).forEach((key) => { colsByIndex.push(key); });
    return { colsByIndex };
  }

  maybeSelectedCell() {
    const { cells, context } = this.props;
    const { selY, selX } = this.localSelection();
    if (context.formula) return { ...context, selX, selY };
    const maybeCell = cells[selX];
    return maybeCell && { ...maybeCell, selY };
  }

  // eslint-disable-next-line class-methods-use-this
  cellPosition(cell) {
    const { context } = this.props;
    if (context.formula) return { y: cell.selY, x: cell.selX, width: 1, height: 1 };
    return { y: cell.selY, x: cell.index, width: 1, height: 1 };
  }

  // eslint-disable-next-line class-methods-use-this
  locationSelected() {
    const { selY, selX } = this.localSelection();
    if (selY !== 0) return undefined;
    return { typeToDelete: OBJECT_CELL, indexToDelete: selX };
  }

  bounds() {
    const { context, readOnly } = this.props;
    const { colsByIndex } = this.state;
    const appendExtraCell = (readOnly || context.formula) ? 0 : 1;
    return {
      xLB: 0,
      yLB: 0,
      yUB: 2,
      xUB: colsByIndex.length + appendExtraCell,
    };
  }

  // eslint-disable-next-line class-methods-use-this
  localScale() {
    return { y: 2, x: 1 };
  }

  render() {
    const {
      tableData,
      viewSelected,
      viewWidth,
      viewOffsetX,
      viewOffsetY,
    } = this.props;
    const children = [];
    const { selY, selX } = this.localSelection();
    const { colsByIndex, scrollX } = this.state;
    const bounds = this.bounds();
    const numVisibleCells = viewWidth;
    for (
      let col = scrollX;
      col - scrollX < numVisibleCells && col < bounds.xUB;
      ++col
    ) {
      const worldCol = viewOffsetX + (col - scrollX);

      // labels
      const nameSelected = viewSelected && selY === 0 && selX === col;
      children.push((
        <CellSelectionComponent
          x={worldCol}
          height={1}
          y={viewOffsetY}
          width={1}
          selected={nameSelected}
          key={`name-${col}`}
        >
          <CellNameComponent
            x={worldCol}
            width={1}
            y={viewOffsetY}
            height={0.5}
            name={colsByIndex[col]}
            setSelection={this.setViewSelection}
          />
        </CellSelectionComponent>
      ));

      // values + blanks
      const cellSelected = viewSelected && selY === 1 && selX === col;
      const maybeValue = tableData.byName[colsByIndex[col]];
      const geomProps = {
        x: worldCol,
        y: viewOffsetY + 0.5,
        width: 1,
        height: 0.5,
      };

      children.push((
        <CellSelectionComponent
          {...geomProps}
          selected={cellSelected}
          key={`cell-${col}`}
        >
          {(maybeValue) ? (
            <CellValueComponent
              {...geomProps}
              value={maybeValue}
              setSelection={this.setViewSelection}
            />
          ) : (
            <EmptyCellComponent
              {...geomProps}
              setSelection={this.setViewSelection}
            />
          )}
        </CellSelectionComponent>
      ));
    }

    return (
      <Fragment>
        {super.render()}
        {children}
      </Fragment>
    );
  }
}

const mapStateToProps = (state, ownProps) => {
  const context = getRefsById(state)[ownProps.contextId];
  const cells = !context.formula && refsAtPosition(state)[ownProps.contextId];
  return { context, cells };
};

const mapDispatchToProps = dispatch => ({
  deleteCell: cellId => dispatch(deleteThing(cellId)),
  deleteLocation: (context, y, x) => dispatch(deleteLoc(context, y, x)),
});

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  null, // mergeProps
  { withRef: true },
)(ObjectContentsComponent);
