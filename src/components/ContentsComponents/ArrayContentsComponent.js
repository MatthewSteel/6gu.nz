import React, { Fragment } from 'react';
import { connect } from 'react-redux';

import CellNameComponent from '../CellComponent/CellNameComponent';
import CellValueComponent from '../CellComponent/CellValueComponent';
import CellSelectionComponent from '../CellComponent/CellSelectionComponent';
import EmptyCellComponent from '../CellComponent/EmptyCellComponent';
import ContentsBaseComponent from './ContentsBaseComponent';

import { getRefsById, getChildrenByParentId } from '../../selectors/formulas/selectors';
import { rangesOverlap } from '../../selectors/geom/geom';
import { deleteCell } from '../../redux/store';


class ArrayContentsComponent extends ContentsBaseComponent {
  maybeSelectedCell() {
    const { cells } = this.props;
    const { selY } = this.localSelection();
    return cells.find(({ index }) => index === selY);
  }

  // eslint-disable-next-line class-methods-use-this
  cellPosition(cell) {
    return { y: cell.index, x: 0, width: 1, height: 1 };
  }

  bounds() {
    const { cells } = this.props;
    return { xLB: 0, yLB: 0, xUB: 1, yUB: cells.length + 1 };
  }

  // eslint-disable-next-line class-methods-use-this
  localScale() {
    return { y: 2, x: 1, yOffset: 1, xOffset: 0 };
  }

  render() {
    const {
      name,
      cells,
      tableData,
      pushViewStack,
      viewSelected,
      viewHeight,
      viewOffsetX,
      viewOffsetY,
    } = this.props;
    const { scrollY } = this.state;
    const selection = this.selectedCellId();

    const children = new Array(viewHeight);
    const numVisibleCells = viewHeight * 2 - 1;
    cells.forEach((cell) => {
      const { id, index } = cell;
      const visibleIndex = index - scrollY;
      if (!rangesOverlap(0, numVisibleCells, visibleIndex, 1)) return;

      const cellSelected = viewSelected && selection.cellId === id;
      const extraClasses = [];
      if (visibleIndex === 0 && index !== 0) {
        extraClasses.push('FirstArrayCell');
      }
      if (visibleIndex === numVisibleCells - 1 && index !== cells.length - 1) {
        extraClasses.push('LastArrayCell');
      }
      children[visibleIndex] = (
        <CellSelectionComponent
          x={viewOffsetX}
          width={1}
          y={viewOffsetY + 0.5 + visibleIndex / 2}
          height={0.5}
          selected={cellSelected}
          key={id}
        >
          <CellValueComponent
            id={id}
            x={viewOffsetX}
            width={1}
            y={viewOffsetY + 0.5 + visibleIndex / 2}
            height={0.5}
            value={tableData.arr[index]}
            pushViewStack={pushViewStack}
            setSelection={this.setViewSelection}
            extraClasses={extraClasses}
          />
        </CellSelectionComponent>
      );
    });

    const lastIndex = cells.length;
    const visibleIndex = lastIndex - scrollY;
    if (rangesOverlap(0, numVisibleCells, visibleIndex, 1)) {
      const cellSelected = viewSelected && selection.y === lastIndex;
      children.push((
        <EmptyCellComponent
          key="blankCell"
          x={viewOffsetX}
          width={1}
          y={viewOffsetY + 0.5 + visibleIndex / 2}
          height={0.5}
          selected={cellSelected}
          setSelection={this.setViewSelection}
        />
      ));
    }

    return (
      <Fragment>
        <CellNameComponent
          name={name}
          x={viewOffsetX}
          y={viewOffsetY}
          width={1}
          height={0.5}
          setSelection={this.setViewSelection}
        />
        {children}
      </Fragment>
    );
  }
}

const mapStateToProps = (state, ownProps) => ({
  name: getRefsById(state)[ownProps.contextId].name,
  cells: getChildrenByParentId(state)[ownProps.contextId],
});

const mapDispatchToProps = dispatch => ({
  deleteCellProp: cellId => dispatch(deleteCell(cellId)),
});

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  null, // mergeProps
  { withRef: true },
)(ArrayContentsComponent);
