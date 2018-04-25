import React, { Fragment } from 'react';
import { connect } from 'react-redux';

import KeyboardListenerComponent from '../KeyboardListenerComponent/KeyboardListenerComponent';
import CellComponent from '../CellComponent/CellComponent';
import EmptyCellComponent from '../CellComponent/EmptyCellComponent';
import ContentsBaseComponent from './ContentsBaseComponent';

import { getChildrenByParentId } from '../../selectors/formulas/selectors';
import { overlaps, truncateOverlap } from '../../selectors/geom/geom';
import { deleteCell } from '../../redux/store';

import './SheetComponent.css';


class SheetContentsComponent extends ContentsBaseComponent {
  selectedCellId() {
    const { selY, selX } = this.state;
    const selectedCell = this.maybeSelectedCell();
    const { sheetId } = this.props;
    return selectedCell ?
      { context: sheetId, cellId: selectedCell.id } : // A real item
      { context: sheetId, y: selY, x: selX }; // a blank cell
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
    const { viewY, viewX } = this.state;
    const selection = this.selectedCellId();

    const filledCells = cells.map((cell) => {
      if (!overlaps(viewY, viewHeight, viewX, viewWidth, cell)) {
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

      const cellSelected = viewSelected && selection.cellId === cell.id;
      const {
        x: truncX,
        length: truncXLen,
      } = truncateOverlap(x, cellWidth, viewX, viewWidth);
      const {
        x: truncY,
        length: truncYLen,
      } = truncateOverlap(y, cellHeight, viewY, viewHeight);
      return (
        <CellComponent
          key={id}
          id={id}
          x={truncX - viewX}
          width={truncXLen}
          y={truncY - viewY}
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
        const place = `${cy + viewY},${cx + viewX}`;
        const cellSelected = viewSelected &&
          cy + viewY === selection.y &&
          cx + viewX === selection.x;
        emptyCells.push((
          <EmptyCellComponent
            key={place}
            x={cx}
            y={cy}
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
  cells: getChildrenByParentId(state)[ownProps.sheetId],
  yLowerBound: 0,
  yUpperBound: Infinity,
  xLowerBound: 0,
  xUpperBound: Infinity,
});

const mapDispatchToProps = dispatch => ({
  deleteCellProp: cellId => dispatch(deleteCell(cellId)),
});

export default connect(mapStateToProps, mapDispatchToProps)(SheetContentsComponent);
