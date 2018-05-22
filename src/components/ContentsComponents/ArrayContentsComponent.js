import React, { Fragment } from 'react';
import { connect } from 'react-redux';

import CellNameComponent from '../CellComponent/CellNameComponent';
import CellValueComponent from '../CellComponent/CellValueComponent';
import CellSelectionComponent from '../CellComponent/CellSelectionComponent';
import EmptyCellComponent from '../CellComponent/EmptyCellComponent';
import ContentsBaseComponent from './ContentsBaseComponent';

import { getRefsById, getChildrenOfRef } from '../../selectors/formulas/selectors';
import { ARRAY, deleteLoc, deleteThing } from '../../redux/store';


class ArrayContentsComponent extends ContentsBaseComponent {
  maybeSelectedCell() {
    const { cells, context } = this.props;
    const { selY, selX } = this.localSelection();
    if (context.formula) return { ...context, selX, selY };
    const maybeCell = cells.find(({ index }) => index === selY);
    // Eww -- see cellPosition below.
    if (maybeCell) return { ...maybeCell, selX };
    return maybeCell;
  }

  // eslint-disable-next-line class-methods-use-this
  cellPosition(cell) {
    const { context } = this.props;
    if (context.formula) return { y: cell.selY, x: cell.selX, width: 1, height: 1 };
    return { y: cell.index, x: cell.selX, width: 1, height: 1 };
  }

  bounds() {
    const { context, readOnly, tableData } = this.props;
    const readOnlyExtraCell = (readOnly || context.type !== ARRAY) ? 0 : 1;
    return {
      xLB: 0,
      yLB: 0,
      xUB: 2,
      yUB: tableData.arr.length + readOnlyExtraCell,
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
      viewHeight,
      viewWidth,
      viewOffsetX,
      viewOffsetY,
    } = this.props;
    const children = [];
    const { selY, selX } = this.localSelection();
    const { scrollY, scrollX } = this.state;
    const bounds = this.bounds();
    const numVisibleCells = viewHeight * 2;
    for (
      let row = scrollY;
      row - scrollY < numVisibleCells && row < bounds.yUB;
      ++row
    ) {
      const worldRow = viewOffsetY + (row - scrollY) / 2;

      // labels
      if (scrollX === 0) {
        const cellSelected = viewSelected && selX === 0 && selY === row;
        children.push((
          <CellSelectionComponent
            x={viewOffsetX}
            width={viewWidth}
            y={worldRow}
            height={0.5}
            selected={cellSelected}
            key={`name-${row}`}
          >
            <CellNameComponent
              x={viewOffsetX}
              width={1}
              y={worldRow}
              height={0.5}
              name={`${row}`}
              setSelection={this.setViewSelection}
            />
          </CellSelectionComponent>
        ));
      }

      // values + blanks
      const contentsX = 1 - scrollX;
      if (contentsX >= viewWidth) continue;
      const cellSelected = viewSelected && selX === 1 && selY === row;
      const maybeValue = tableData.arr[row];
      children.push((
        <CellSelectionComponent
          x={viewOffsetX + contentsX}
          width={1}
          y={worldRow}
          height={0.5}
          selected={cellSelected}
          key={`cell-${row}`}
        >
          {(maybeValue) ? (
            <CellValueComponent
              x={viewOffsetX + contentsX}
              width={1}
              y={worldRow}
              height={0.5}
              value={maybeValue}
              setSelection={this.setViewSelection}
            />
          ) : (
            <EmptyCellComponent
              key="empty"
              x={viewOffsetX + contentsX}
              width={1}
              y={worldRow}
              height={0.5}
              selected={cellSelected}
              setSelection={this.setViewSelection}
            />
          )}
        </CellSelectionComponent>
      ));
    }

    return (
      <Fragment>
        {children}
      </Fragment>
    );
  }
}

const mapStateToProps = (state, ownProps) => ({
  context: getRefsById(state)[ownProps.contextId],
  cells: getChildrenOfRef(state, ownProps.contextId),
});

const mapDispatchToProps = dispatch => ({
  deleteCell: cellId => dispatch(deleteThing(cellId)),
  deleteLocation: (context, y, x) => dispatch(deleteLoc(context, y, x)),
});

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  null, // mergeProps
  { withRef: true },
)(ArrayContentsComponent);
