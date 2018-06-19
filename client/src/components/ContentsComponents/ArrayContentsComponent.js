import React, { Fragment } from 'react';
import { connect } from 'react-redux';

import ContentsBaseComponent from './ContentsBaseComponent';
import CellNameComponent from '../CellComponent/CellNameComponent';
import CellValueComponent from '../CellComponent/CellValueComponent';
import CellSelectionComponent from '../CellComponent/CellSelectionComponent';
import EmptyCellComponent from '../CellComponent/EmptyCellComponent';

import { getRefsById, refsAtPosition } from '../../selectors/formulas/selectors';
import { ARRAY_CELL } from '../../redux/stateConstants';
import { deleteLoc, deleteThing } from '../../redux/documentEditing';


class ArrayContentsComponent extends ContentsBaseComponent {
  maybeSelectedCell() {
    const { cells, context } = this.props;
    const { selY, selX } = this.localSelection();
    if (context.formula) return { ...context, selX, selY };
    const maybeCell = cells[selY];
    // Eww -- we lie so we can write the cell but select it in two ways.
    // See cellPosition below.
    return maybeCell && { ...maybeCell, selX };
  }

  // eslint-disable-next-line class-methods-use-this
  cellPosition(cell) {
    const { context } = this.props;
    if (context.formula) return { y: cell.selY, x: cell.selX, width: 1, height: 1 };
    return { y: cell.index, x: cell.selX, width: 1, height: 1 };
  }

  // eslint-disable-next-line class-methods-use-this
  locationSelected() {
    const { context } = this.props;
    if (context.formula) return undefined;
    const { selY, selX } = this.localSelection();
    if (selX !== 0) return undefined;
    return { type: ARRAY_CELL, index: selY };
  }

  bounds() {
    const { context, readOnly, tableData } = this.props;
    const readOnlyExtraCell = (readOnly || context.formula) ? 0 : 1;
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
        if (cellSelected) {
          children.push((
            <CellSelectionComponent
              x={viewOffsetX}
              width={viewWidth}
              y={worldRow}
              height={0.5}
              selected={cellSelected}
              key="selection"
            />
          ));
        }
        children.push((
          <CellNameComponent
            x={viewOffsetX}
            width={1}
            y={worldRow}
            height={0.5}
            name={`${row}`}
            setSelection={this.setViewSelection}
            key={`name-${row}`}
          />
        ));
      }

      // values + blanks
      const contentsX = 1 - scrollX;
      if (contentsX >= viewWidth) continue;
      const cellSelected = viewSelected && selX === 1 && selY === row;
      const maybeValue = tableData.arr[row];
      const geomProps = {
        x: viewOffsetX + contentsX,
        width: 1,
        y: worldRow,
        height: 0.5,
      };

      if (cellSelected) {
        children.push((
          <CellSelectionComponent
            {...geomProps}
            selected={cellSelected}
            key="selection"
          />
        ));
      }
      children.push(maybeValue ? (
        <CellValueComponent
          {...geomProps}
          value={maybeValue}
          setSelection={this.setViewSelection}
          key={`cell-${row}`}
        />
      ) : (
        <EmptyCellComponent
          {...geomProps}
          setSelection={this.setViewSelection}
          key={`cell-${row}`}
        />
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
)(ArrayContentsComponent);
