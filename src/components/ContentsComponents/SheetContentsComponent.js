import React, { Fragment } from 'react';
import { connect } from 'react-redux';

import KeyboardListenerComponent from '../KeyboardListenerComponent/KeyboardListenerComponent';
import SheetCellComponent from '../CellComponent/SheetCellComponent';
import EmptyCellComponent from '../CellComponent/EmptyCellComponent';
import ContentsBaseComponent from './ContentsBaseComponent';

import { getChildrenByParentId } from '../../selectors/formulas/selectors';
import { overlaps, truncateOverlap } from '../../selectors/geom/geom';
import { deleteCell } from '../../redux/store';


class SheetContentsComponent extends ContentsBaseComponent {
  maybeSelectedCell() {
    const { cells } = this.props;
    const { selY, selX } = this.state;
    return cells.find(cell => overlaps(selY, 1, selX, 1, cell));
  }

  // eslint-disable-next-line class-methods-use-this
  cellPosition(cell) {
    const { x, y, width, height } = cell;
    return { x, y, width, height };
  }

  // eslint-disable-next-line class-methods-use-this
  bounds() {
    return { xLB: 0, yLB: 0, xUB: Infinity, yUB: Infinity };
  }

  render() {
    const {
      cells,
      cellValuesById,
      formulaHasFocus,
      pushViewStack,
      viewSelected,
      viewWidth,
      viewHeight,
    } = this.props;
    const { scrollY, scrollX } = this.state;
    const selection = this.selectedCellId();

    const placedCellLocs = new Set();
    const filledCells = cells.map((cell) => {
      if (!overlaps(scrollY, viewHeight, scrollX, viewWidth, cell)) {
        return false;
      }
      const {
        id,
        x,
        y,
        width: cellWidth,
        height: cellHeight,
        name,
      } = cell;

      // Say "we have seen all of these locations" so we don't draw empty
      // cells there. Coords in table-space.
      for (let cx = x; cx < x + cellWidth; ++cx) {
        for (let cy = y; cy < y + cellHeight; ++cy) {
          placedCellLocs.add(`${cy},${cx}`);
        }
      }

      const cellSelected = viewSelected && selection.cellId === cell.id;
      const {
        x: truncX,
        length: truncXLen,
      } = truncateOverlap(x, cellWidth, scrollX, viewWidth);
      const {
        x: truncY,
        length: truncYLen,
      } = truncateOverlap(y, cellHeight, scrollY, viewHeight);
      return (
        <SheetCellComponent
          key={id}
          id={id}
          x={truncX - scrollX}
          width={truncXLen}
          y={truncY - scrollY}
          height={truncYLen}
          name={name}
          value={cellValuesById[id]}
          pushViewStack={pushViewStack}
          selected={cellSelected}
          setSelection={this.setViewSelection}
        />
      );
    }).filter(Boolean);

    const emptyCells = [];
    for (let cy = 0; cy < viewHeight; ++cy) {
      for (let cx = 0; cx < viewWidth; ++cx) {
        // Do not over-draw empty cells. We *could* draw them, but we don't
        // want to because a half-empty child table may not draw over the
        // top of them.
        const place = `${cy + scrollY},${cx + scrollX}`;
        if (placedCellLocs.has(place)) continue;

        const cellSelected = viewSelected &&
          cy + scrollY === selection.y &&
          cx + scrollX === selection.x;
        emptyCells.push((
          <EmptyCellComponent
            key={place}
            x={cx}
            y={cy}
            width={1}
            height={1}
            selected={cellSelected}
            setSelection={this.setViewSelection}
          />
        ));
      }
    }
    return (
      <Fragment>
        {emptyCells}
        {filledCells}
        {viewSelected && !formulaHasFocus &&
          <KeyboardListenerComponent
            callback={this.cellKeys}
          />
        }
        {viewSelected && formulaHasFocus &&
          <KeyboardListenerComponent
            callback={this.formulaKeys}
          />
        }
      </Fragment>
    );
  }
}

const mapStateToProps = (state, ownProps) => ({
  cells: getChildrenByParentId(state)[ownProps.contextId],
  viewOffsetX: 0,
  viewOffsetY: 0,
});

const mapDispatchToProps = dispatch => ({
  deleteCellProp: cellId => dispatch(deleteCell(cellId)),
});

export default connect(mapStateToProps, mapDispatchToProps)(SheetContentsComponent);
