import React, { Fragment } from 'react';
import { connect } from 'react-redux';

import CellNameComponent from '../CellComponent/CellNameComponent';
import CellValueComponent from '../CellComponent/CellValueComponent';
import CellSelectionComponent from '../CellComponent/CellSelectionComponent';
import EmptyCellComponent from '../CellComponent/EmptyCellComponent';
import ContentsBaseComponent from './ContentsBaseComponent';

import { getRefsById, getChildrenOfRef } from '../../selectors/formulas/selectors';
import { OBJECT, deleteLoc, deleteThing } from '../../redux/store';


class ObjectContentsComponent extends ContentsBaseComponent {
  static getDerivedStateFromProps(nextProps) {
    const { cells, context, tableData } = nextProps;
    const colsByIndex = [];
    if (context.formula) {
      Object.keys(tableData.byName).forEach((key) => { colsByIndex.push(key); });
      return { colsByIndex };
    }
    cells.forEach(({ index, name }) => { colsByIndex[index] = name; });
    return { colsByIndex };
  }

  maybeSelectedCell() {
    const { cells, context } = this.props;
    const { selY, selX } = this.localSelection();
    if (context.formula) return { ...context, selX, selY };
    const maybeCell = cells.find(({ index }) => index === selX);
    // Eww -- we lie so we can write the cell but select it in two ways.
    // See cellPosition below.
    if (maybeCell) return { ...maybeCell, selY };
    return undefined;
  }

  // eslint-disable-next-line class-methods-use-this
  cellPosition(cell) {
    const { context } = this.props;
    if (context.formula) return { y: cell.selY, x: cell.selX, width: 1, height: 1 };
    return { y: cell.selY, x: cell.index, width: 1, height: 1 };
  }

  // eslint-disable-next-line class-methods-use-this
  locationSelected(cell) {
    const { selY } = this.localSelection();
    return selY === 0;
  }

  bounds() {
    const { context, readOnly } = this.props;
    const { colsByIndex } = this.state;
    const appendExtraCell = (readOnly || context.type !== OBJECT) ? 0 : 1;
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
      children.push((
        <CellSelectionComponent
          x={worldCol}
          width={1}
          y={viewOffsetY + 0.5}
          height={0.5}
          selected={cellSelected}
          key={`cell-${col}`}
        >
          {(maybeValue) ? (
            <CellValueComponent
              x={worldCol}
              width={1}
              y={viewOffsetY + 0.5}
              height={0.5}
              value={maybeValue}
              setSelection={this.setViewSelection}
            />
          ) : (
            <EmptyCellComponent
              key="empty"
              x={worldCol}
              width={1}
              y={viewOffsetY + 0.5}
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
        {super.render()}
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
)(ObjectContentsComponent);
