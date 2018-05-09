import React, { Fragment } from 'react';
import { connect } from 'react-redux';

import KeyboardListenerComponent from '../KeyboardListenerComponent/KeyboardListenerComponent';
import SheetCellComponent from '../CellComponent/SheetCellComponent';
import EmptyCellComponent from '../CellComponent/EmptyCellComponent';
import DragOverCellComponent from '../CellComponent/DragOverCellComponent';
import DragOutlineComponent from '../CellComponent/DragOutlineComponent';
import ContentsBaseComponent from './ContentsBaseComponent';
import ArrayContentsComponent from './ArrayContentsComponent';

import { getChildrenByParentId } from '../../selectors/formulas/selectors';
import { overlaps, truncateOverlap } from '../../selectors/geom/geom';
import getDragGeom, { getDragRefId } from '../../selectors/geom/dragGeom';
import { getType } from '../../selectors/formulas/tables';
import { clearDrag, startDrag, updateDrag, deleteThing, moveThing } from '../../redux/store';


class SheetContentsComponent extends ContentsBaseComponent {
  constructor(props) {
    super(props);
    this.startDragForRef = this.startDragForRef.bind(this);
    this.dragOver = this.dragOver.bind(this);
    this.drop = this.drop.bind(this);
    this.finishDrag = this.finishDrag.bind(this);
  }

  maybeSelectedCell() {
    const { cells } = this.props;
    const { selY, selX } = this.localSelection();
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

  static getDerivedStateFromProps(nextProps) {
    const placedCellLocs = {};
    nextProps.cells.forEach((cell) => {
      const {
        id,
        x,
        y,
        width: cellWidth,
        height: cellHeight,
      } = cell;
      for (let cx = x; cx < x + cellWidth; ++cx) {
        for (let cy = y; cy < y + cellHeight; ++cy) {
          placedCellLocs[`${cy},${cx}`] = id;
        }
      }
    });
    return { placedCellLocs };
  }

  canPlaceWithoutConflict() {
    const { placedCellLocs } = this.state;
    const { dragRefId, dragGeom } = this.props;
    if (!dragGeom) return false;
    const { x, y, width, height } = dragGeom;
    for (let cx = x; cx < x + width; ++cx) {
      for (let cy = y; cy < y + height; ++cy) {
        const maybePlacedId = placedCellLocs[`${cy},${cx}`];
        if (maybePlacedId && maybePlacedId !== dragRefId) return false;
      }
    }
    return true;
  }

  startDragForRef(refId, type) {
    const { startDragProp, viewId } = this.props;
    startDragProp(viewId, refId, type);
  }

  dragOver(ev, dragY, dragX) {
    const { contextId, updateDragProp, viewId } = this.props;
    const { scrollY, scrollX } = this.state;
    updateDragProp(viewId, contextId, dragY + scrollY, dragX + scrollX);
    if (this.canPlaceWithoutConflict) ev.preventDefault();
  }

  drop() {
    // dragEnd clears the drag state, not us.
    // Not updating drag position with y/x, it's annoying.
    const {
      dragRefId,
      dragGeom,
      moveCell,
    } = this.props;
    if (!dragGeom) return;
    const { y, x, height, width } = dragGeom;
    if (this.canPlaceWithoutConflict()) {
      // Maybe later: Prompt for overwrite.
      moveCell(dragRefId, y, x, height, width);
      this.setSelection(y, x);
    }
  }

  finishDrag() {
    this.props.clearDragProp();
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
      viewSelY,
      viewSelX,
      setViewSelection,
      dragRefId: dragInProgress,
      dragGeom,
    } = this.props;
    const {
      placedCellLocs,
      scrollY,
      scrollX,
    } = this.state;
    const selection = this.selectedCellId();

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

      const cellSelected = !dragInProgress && viewSelected && selection.cellId === cell.id;
      const {
        x: truncX,
        length: truncXLen,
      } = truncateOverlap(x, cellWidth, scrollX, viewWidth);
      const {
        x: truncY,
        length: truncYLen,
      } = truncateOverlap(y, cellHeight, scrollY, viewHeight);

      const cellContents = cellValuesById[id];
      if (truncYLen > 1 && getType(cellContents.value) === 'array') {
        return (
          <ArrayContentsComponent
            key={id}
            ref={cellSelected && this.setChildSelectionTableRef}
            contextId={id}
            formulaRef={this.props.formulaRef}
            pushViewStack={pushViewStack}
            popViewStack={this.props.popViewStack}
            readOnly={this.props.readOnly}
            setFormulaSelection={this.props.setFormulaSelection}
            tableData={cellContents.value}
            viewHeight={truncYLen}
            viewWidth={truncXLen}
            viewOffsetX={truncX - scrollX}
            viewOffsetY={truncY - scrollY}
            viewSelected={cellSelected}
            viewSelX={viewSelX}
            viewSelY={viewSelY}
            setViewSelection={setViewSelection}
          />
        );
      }
      return (
        <SheetCellComponent
          key={id}
          id={id}
          x={truncX - scrollX}
          width={truncXLen}
          y={truncY - scrollY}
          height={truncYLen}
          name={name}
          value={cellContents}
          pushViewStack={pushViewStack}
          selected={cellSelected}
          setSelection={this.setViewSelection}
          startDragCallback={this.startDragForRef}
          endDragCallback={this.finishDrag}
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
        if (placedCellLocs[place]) continue;

        const cellSelected = !dragInProgress && viewSelected &&
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

    const dragOverCells = [];
    if (dragInProgress) {
      for (let cy = 0; cy < viewHeight; ++cy) {
        for (let cx = 0; cx < viewWidth; ++cx) {
          // if (cy === 0 && cx === 0) continue;
          const place = `drag${cy + scrollY},${cx + scrollX}`;
          dragOverCells.push((
            <DragOverCellComponent
              key={place}
              x={cx}
              y={cy}
              width={1}
              height={1}
              dragOverCallback={this.dragOver}
              dropCallback={this.drop}
            />
          ));
        }
      }
      if (dragGeom) {
        const dragValid = this.canPlaceWithoutConflict();
        const maxHeight = viewHeight - dragGeom.y + 1;
        const maxWidth = viewWidth - dragGeom.x + 1;
        dragOverCells.push((
          <DragOutlineComponent
            key="dragOutline"
            valid={dragValid}
            y={dragGeom.y - scrollY}
            x={dragGeom.x - scrollX}
            height={Math.min(maxHeight, dragGeom.height)}
            width={Math.min(maxWidth, dragGeom.width)}
          />
        ));
      }
    }

    return (
      <Fragment>
        {emptyCells}
        {filledCells}
        {dragOverCells}
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
  dragRefId: getDragRefId(state),
  dragGeom: !ownProps.readOnly && getDragGeom(ownProps.contextId),
  viewOffsetX: 0,
  viewOffsetY: 0,
});

// Chrome doesn't like us updating the DOM in the drag start handler...
const asyncStartDrag = (dispatch, viewId, refId, type) => {
  setTimeout(() => dispatch(startDrag(viewId, refId, type)), 0);
};

const mapDispatchToProps = dispatch => ({
  clearDragProp: () => dispatch(clearDrag()),
  startDragProp: (viewId, refId, type) => (
    asyncStartDrag(dispatch, viewId, refId, type)),
  updateDragProp: (viewId, sheetId, dragY, dragX) => (
    dispatch(updateDrag(viewId, sheetId, dragY, dragX))),
  deleteCell: cellId => dispatch(deleteThing(cellId)),
  moveCell: (cellId, y, x, width, height) => (
    dispatch(moveThing(cellId, y, x, width, height))),
});

export default connect(mapStateToProps, mapDispatchToProps)(SheetContentsComponent);
