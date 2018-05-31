import React, { Fragment } from 'react';
import { connect } from 'react-redux';

import CellValueComponent from '../CellComponent/CellValueComponent';
import EmptyCellComponent from '../CellComponent/EmptyCellComponent';
import CellSelectionComponent from '../CellComponent/CellSelectionComponent';
import ContentsBaseComponent from './ContentsBaseComponent';

import { getRefsById, refsAtPosition } from '../../selectors/formulas/selectors';
import { deleteLoc, deleteThing } from '../../redux/store';


class TableContentsComponent extends ContentsBaseComponent {
  static getDerivedStateFromProps(nextProps) {
    return {
      scrollY: nextProps.linkedScrollY,
      scrollX: nextProps.linkedScrollX,
    };
  }

  scroll(coords) {
    const { scrollY, scrollX } = coords;
    const { updateScroll } = this.props;
    updateScroll({ linkedScrollY: scrollY, linkedScrollX: scrollX });
  }

  maybeSelectedCell() {
    const { cells, context } = this.props;
    const { selY, selX } = this.localSelection();
    if (!cells) return { ...context, selY, selX };

    const cell = cells[`${selY},${selX}`];
    return cell && { ...cell, selY, selX };
  }

  // eslint-disable-next-line class-methods-use-this
  cellPosition(cell) {
    return { y: cell.selY, x: cell.selX, width: 1, height: 1 };
  }

  bounds() {
    const { tableData, context, readOnly } = this.props;
    const appendExtraCell = (readOnly || context.formula) ? 0 : 1;
    return {
      xLB: 0,
      yLB: 0,
      yUB: tableData.arr.length + appendExtraCell,
      xUB: tableData.keys.length + appendExtraCell,
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
    const visibleWidth = viewWidth;
    const visibleHeight = viewHeight * 2;
    for (
      let col = scrollX;
      col - scrollX < visibleWidth && col < bounds.xUB;
      ++col
    ) {
      const worldCol = viewOffsetX + (col - scrollX);
      for (
        let row = scrollY;
        row - scrollY < visibleHeight && row < bounds.yUB;
        ++row
      ) {
        const worldRow = viewOffsetY + (row - scrollY) / 2;

        // labels
        const cellSelected = viewSelected && selX === col && selY === row;
        const maybeRowData = tableData.arr[row];
        let maybeCellData;
        if (maybeRowData) {
          if (maybeRowData.error) {
            maybeCellData = maybeRowData;
          } else {
            maybeCellData = maybeRowData.value.byName[tableData.keys[col]];
          }
        }

        const geomProps = {
          x: worldCol,
          y: worldRow,
          height: 0.5,
          width: 1,
        };
        children.push((
          <CellSelectionComponent
            {...geomProps}
            selected={cellSelected}
            key={`name-${col},${row}`}
          >
            {maybeCellData ? (
              <CellValueComponent
                {...geomProps}
                value={maybeCellData}
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
  const { cells } = !context.formula && refsAtPosition(state)[ownProps.contextId];
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
)(TableContentsComponent);