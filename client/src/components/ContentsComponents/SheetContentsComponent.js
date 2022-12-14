import React from 'react';
import { connect } from 'react-redux';

import KeyboardListener from '../util/KeyboardListener';
import HoveredParent from '../util/HoveredParent';
import scrollHelper from '../util/ScrollHelper';
import SheetCellComponent from '../CellComponent/SheetCellComponent';
import EmptyCellComponent from '../CellComponent/EmptyCellComponent';
import CellSelectionComponent from '../CellComponent/CellSelectionComponent';
import DragOverCellComponent from '../DragComponents/DragOverCellComponent';
import DragOutlineComponent from '../DragComponents/DragOutlineComponent';
import ContentsBaseComponent, { mapDispatchToProps } from './ContentsBaseComponent';
import ArrayComponent from './ArrayComponent';
import ObjectComponent from './ObjectComponent';
import TableComponent from './TableComponent';
import CreateMenu from '../ContextMenu/CreateMenu';

import { getChildrenOfRef, getRefsById, sheetPlacedCellLocs } from '../../selectors/formulas/selectors';
import { overlaps, truncateOverlap } from '../../selectors/geom/geom';
import getDragGeom, {
  canPlaceWithoutConflict,
  getDragRefId,
  getDragState,
} from '../../selectors/geom/dragGeom';
import { formulaHasFocus } from '../../selectors/uistate/uistate';
import { getType } from '../../selectors/formulas/tables';
import { TABLE } from '../../redux/stateConstants';


class SheetContentsComponent extends ContentsBaseComponent {
  constructor(props) {
    super(props);
    this.ScrollHelper = scrollHelper(this.onScroll);
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

  cellPosition(cell) {
    const { x, y, width, height } = cell;
    return { x, y, width, height };
  }

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
      placedCellLocs,
      pushViewStack,
      readOnly,
      setCellFormula,
      viewSelected,
      viewWidth,
      viewHeight,
      viewSelY,
      viewSelX,
      setViewSelection,
      formulaHasFocusProp,
      dragRefId: dragInProgress,
      dragGeom,
      toggleElementSize,
      writeForeignKey,
      writeLoc,
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
      };

      const commonComplexChildProps = {
        ref: cellSelected && this.setChildSelectionTableRef,
        contextId,
        popViewStack: this.props.popViewStack,
        readOnly,
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
        parentMove: this.move,
        parentRelativeScroll: this.relativeScroll,
      };

      if (!cellContents.error && truncXLen > 1) {
        if (['array', 'table'].includes(contentsType)) {
          if (cell.type === TABLE && !cellContents.override) {
            return (
              <TableComponent
                writeForeignKey={writeForeignKey}
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
      const draggable = !readOnly && !formulaHasFocusProp;
      return (
        <SheetCellComponent
          {...commonChildProps}
          x={truncX - scrollX}
          width={truncXLen}
          y={truncY - scrollY}
          height={truncYLen}
          name={name}
          value={cellContents}
          setCellFormula={!readOnly && setCellFormula}
          selected={cellSelected && selection}
          setSelection={this.setViewSelection}
          toggleElementSize={toggleElementSize}
          startDragCallback={draggable ? this.startDragForRef : undefined}
          endDragCallback={draggable ? this.finishDrag : undefined}
          writeLocValue={!readOnly && cellSelected && writeLoc}
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
          emptyCells.push((
            <CellSelectionComponent
              key={screenPlace}
              x={cx}
              y={cy}
              width={1}
              height={1}
              selection={selection}
            />
          ));
        }
        const emptyCell = (
          <EmptyCellComponent
            key={`empty-${screenPlace}`}
            x={cx}
            y={cy}
            width={1}
            height={1}
            selected={cellSelected}
            setSelection={this.setViewSelection}
            writable={cellSelected && !readOnly}
            writeLocValue={writeLoc}
          />
        );
        if (cellSelected) {
          emptyCells.push((
            <HoveredParent key="menu">
              <CreateMenu x={cx} y={cy} />
              {emptyCell}
            </HoveredParent>
          ));
        } else {
          emptyCells.push(emptyCell);
        }
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
      <this.ScrollHelper>
        {super.render()}
        {emptyCells}
        {filledCells}
        {dragOverCells}
        {viewSelected && (
          <KeyboardListener callback={this.cellKeys} priority={5} />
        )}
      </this.ScrollHelper>
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
  formulaHasFocusProp: formulaHasFocus(state),
  placedCellLocs: sheetPlacedCellLocs(state)[ownProps.contextId],
  viewOffsetX: 0,
  viewOffsetY: 0,
});

export default connect(mapStateToProps, mapDispatchToProps)(SheetContentsComponent);
