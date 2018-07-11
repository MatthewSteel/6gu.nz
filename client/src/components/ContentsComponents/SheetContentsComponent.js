import React, { Fragment } from 'react';
import { connect } from 'react-redux';

import KeyboardListener from '../util/KeyboardListener';
import SheetCellComponent from '../CellComponent/SheetCellComponent';
import EmptyCellComponent from '../CellComponent/EmptyCellComponent';
import CellSelectionComponent from '../CellComponent/CellSelectionComponent';
import DragOverCellComponent from '../DragComponents/DragOverCellComponent';
import DragOutlineComponent from '../DragComponents/DragOutlineComponent';
import ContentsBaseComponent, { mapDispatchToProps } from './ContentsBaseComponent';
import ArrayComponent from './ArrayComponent';
import ObjectComponent from './ObjectComponent';
import TableComponent from './TableComponent';
import CreateMenu from '../CreateMenu/CreateMenu';

import { getChildrenOfRef, getRefsById, sheetPlacedCellLocs } from '../../selectors/formulas/selectors';
import { overlaps, truncateOverlap } from '../../selectors/geom/geom';
import getDragGeom, {
  canPlaceWithoutConflict,
  getDragRefId,
  getDragState,
} from '../../selectors/geom/dragGeom';
import { getType } from '../../selectors/formulas/tables';
import { TABLE } from '../../redux/stateConstants';


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

  startDragForRef(refId, type) {
    this.props.startDragProp(refId, type);
  }

  dragOver(ev, dragY, dragX) {
    const {
      contextId,
      dragRefId,
      dragGeom,
      placedCellLocs,
      updateDragProp,
    } = this.props;
    const { scrollY, scrollX } = this.state;
    updateDragProp(contextId, dragY + scrollY, dragX + scrollX);
    if (canPlaceWithoutConflict(dragRefId, dragGeom, placedCellLocs)) {
      ev.preventDefault();
    }
  }

  drop() {
    const {
      contextId,
      dragRefId,
      dragGeom,
      placedCellLocs,
      moveCell,
      clearDragProp,
    } = this.props;
    if (!dragGeom) {
      clearDragProp();
      return;
    }
    const { y, x, height, width } = dragGeom;
    if (canPlaceWithoutConflict(dragRefId, dragGeom, placedCellLocs)) {
      // Maybe later: Prompt for overwrite.
      moveCell(dragRefId, contextId, y, x, height, width);
      this.setSelection(y, x);
    }
    // Just in case -- the dragged thing might cease to exist or something.
    clearDragProp();
  }

  finishDrag() {
    this.props.clearDragProp();
  }

  render() {
    const {
      cells,
      cellValuesById,
      contextId,
      formulaHasFocus,
      placedCellLocs,
      pushViewStack,
      readOnly,
      viewSelected,
      viewWidth,
      viewHeight,
      viewSelY,
      viewSelX,
      setViewSelection,
      dragRefId: dragInProgress,
      dragGeom,
      toggleElementSize,
    } = this.props;
    const {
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
      const contentsType = getType(cellContents.value);

      const commonChildProps = {
        key: id,
        id,
        pushViewStack,
        startDragCallback: !readOnly ? this.startDragForRef : undefined,
        endDragCallback: !readOnly ? this.finishDrag : undefined,
      };

      const commonComplexChildProps = {
        ref: cellSelected && this.setChildSelectionTableRef,
        contextId,
        formulaRef: this.props.formulaRef,
        popViewStack: this.props.popViewStack,
        readOnly,
        setFormulaSelection: this.props.setFormulaSelection,
        tableData: cellContents.value,
        // TODO: should share names with SheetCell so we can specify them
        // once. Most (all?) of the rest are shared...
        viewHeight: truncYLen,
        viewWidth: truncXLen,
        viewOffsetX: truncX - scrollX,
        viewOffsetY: truncY - scrollY,
        viewSelected: cellSelected,
        viewSelX,
        viewSelY,
        setViewSelection,
      };

      if (!cellContents.error && truncXLen > 1) {
        if (['array', 'table'].includes(contentsType)) {
          if (cell.type === TABLE && !cellContents.override) {
            return (
              <TableComponent
                {...commonChildProps}
                {...commonComplexChildProps}
              />
            );
          }
          return (
            <ArrayComponent
              {...commonChildProps}
              {...commonComplexChildProps}
            />
          );
        }
        if (contentsType === 'object') {
          return (
            <ObjectComponent
              {...commonChildProps}
              {...commonComplexChildProps}
            />
          );
        }
      }
      return (
        <SheetCellComponent
          {...commonChildProps}
          x={truncX - scrollX}
          width={truncXLen}
          y={truncY - scrollY}
          height={truncYLen}
          name={name}
          value={cellContents}
          selected={cellSelected}
          setSelection={this.setViewSelection}
          toggleElementSize={toggleElementSize}
        />
      );
    }).filter(Boolean);

    const emptyCells = [];
    for (let cy = 0; cy < viewHeight; ++cy) {
      for (let cx = 0; cx < viewWidth; ++cx) {
        // Do not over-draw empty cells. We *could* draw them, but we don't
        // want to because a half-empty child table may not draw over the
        // top of them.
        const worldPlace = `${cy + scrollY},${cx + scrollX}`;
        if (placedCellLocs[worldPlace]) continue;
        const screenPlace = `${cy},${cx}`;

        const cellSelected = !dragInProgress && viewSelected
          && cy + scrollY === selection.y
          && cx + scrollX === selection.x;
        if (cellSelected) {
          emptyCells.push((<CreateMenu key="menu" selection={selection} />));
          emptyCells.push((
            <CellSelectionComponent
              key={screenPlace}
              x={cx}
              y={cy}
              width={1}
              height={1}
              selected={cellSelected}
            />
          ));
        }
        emptyCells.push((
          <EmptyCellComponent
            key={`empty-${screenPlace}`}
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
        const dragValid = canPlaceWithoutConflict(dragInProgress, dragGeom, placedCellLocs);
        const windowY = dragGeom.y - scrollY;
        const windowX = dragGeom.x - scrollX;
        const maxHeight = viewHeight - windowY + 1;
        const maxWidth = viewWidth - windowX + 1;
        dragOverCells.push((
          <DragOutlineComponent
            key="dragOutline"
            valid={dragValid}
            y={windowY}
            x={windowX}
            height={Math.min(maxHeight, dragGeom.height)}
            width={Math.min(maxWidth, dragGeom.width)}
          />
        ));
      }
    }

    return (
      <Fragment>
        {super.render()}
        {emptyCells}
        {filledCells}
        {dragOverCells}
        {viewSelected && !formulaHasFocus && (
          <KeyboardListener
            callback={this.cellKeys}
          />
        )}
        {viewSelected && formulaHasFocus && (
          <KeyboardListener
            callback={this.formulaKeys}
          />
        )}
      </Fragment>
    );
  }
}

const mapStateToProps = (state, ownProps) => ({
  cells: getChildrenOfRef(state, ownProps.contextId),
  dragRefId: getDragRefId(state),
  dragGeom: !ownProps.readOnly && getDragGeom(
    getDragState(state),
    getRefsById(state),
    ownProps.contextId,
  ),
  placedCellLocs: sheetPlacedCellLocs(state)[ownProps.contextId],
  viewOffsetX: 0,
  viewOffsetY: 0,
});

export default connect(mapStateToProps, mapDispatchToProps)(SheetContentsComponent);
