import React, { Fragment } from 'react';
import { connect } from 'react-redux';

import TableKeysComponent from './TableKeysComponent';
import TableIndicesComponent from './TableIndicesComponent';
import TableContentsComponent from './TableContentsComponent';
import ContentsBaseComponent, { mapDispatchToProps } from './ContentsBaseComponent';
import CellNameComponent from '../CellComponent/CellNameComponent';
import CellSelectionComponent from '../CellComponent/CellSelectionComponent';
import ResizeHandleComponent from '../DragComponents/ResizeHandleComponent';

import { getRefsById } from '../../selectors/formulas/selectors';
import { DRAG_MOVE } from '../../selectors/geom/dragGeom';
import { formulaHasFocus } from '../../selectors/uistate/uistate';


class TableComponent extends ContentsBaseComponent {
  constructor(props) {
    super(props);
    this.onNameDragStart = this.onNameDragStart.bind(this);
    this.setChildScroll = this.setChildScroll.bind(this);
    // Children need to coordinate their scrolling :-/
    this.state = {
      ...this.state,
      linkedScrollX: 0,
      linkedScrollY: 0,
    };
  }

  setChildScroll(update) {
    this.setState(update);
  }

  onNameDragStart(ev) {
    ev.dataTransfer.setData('text/plain', ' ');
    const { id, startDragProp } = this.props;
    startDragProp(id, DRAG_MOVE);
  }

  maybeSelectedCell() {
    const { selY, selX } = this.localSelection();
    const { table } = this.props;
    if (selY === 0 && selX === 0) return table;
    if (selY === 0) return { ...table, keysSelected: true };
    if (selX === 0) return { ...table, indicesSelected: true };
    return { ...table, valuesSelected: true };
  }

  cellPosition(table) {
    const { viewHeight, viewWidth } = this.props;
    if (table.valuesSelected) {
      return { y: 1, x: 1, width: viewWidth - 1, height: 2 * viewHeight - 1 };
    }
    if (table.keysSelected) {
      return { y: 0, x: 1, width: viewWidth - 1, height: 1 };
    }
    if (table.indicesSelected) {
      return { y: 1, x: 0, width: 1, height: 2 * viewHeight - 1 };
    }
    return { y: 0, x: 0, width: 1, height: 1 };
  }

  bounds() {
    const { viewHeight, viewWidth } = this.props;
    return { xLB: 0, yLB: 0, xUB: viewWidth, yUB: 2 * viewHeight };
  }

  localScale() {
    return { y: 2, x: 1 };
  }

  render() {
    const {
      table,
      id,
      tableData,
      draggable,
      startDragProp,
      clearDragProp,
      pushViewStack,
      readOnly,
      toggleElementSize,
      viewSelected,
      viewHeight,
      viewWidth,
      viewOffsetX,
      viewOffsetY,
      viewSelX,
      viewSelY,
      setViewSelection,
    } = this.props;
    const { linkedScrollX, linkedScrollY } = this.state;
    const selectedCell = this.maybeSelectedCell();

    const commonChildProps = {
      contextId: id,
      pushViewStack,
      popViewStack: this.props.popViewStack,
      readOnly,
      tableData,
      viewSelX,
      viewSelY,
      setViewSelection,
      updateScroll: this.setChildScroll,
      parentMove: this.move,
      parentRelativeScroll: this.relativeScroll,
    };

    const keysSelected = viewSelected && selectedCell.keysSelected;
    const indicesSelected = viewSelected && selectedCell.indicesSelected;
    const valuesSelected = viewSelected && selectedCell.valuesSelected;
    const wholeTableSelected = viewSelected
      && !keysSelected
      && !indicesSelected
      && !valuesSelected;
    return (
      <Fragment>
        {wholeTableSelected && (
          <CellSelectionComponent
            x={viewOffsetX}
            y={viewOffsetY}
            width={viewWidth}
            height={viewHeight}
            selection={this.selectedCellId()}
          />
        )}
        <ResizeHandleComponent
          y={viewOffsetY + viewHeight - 1}
          x={viewOffsetX + viewWidth - 1}
          resizeRefId={id}
          selected={viewSelected}
          startDragCallback={startDragProp}
          endDragCallback={clearDragProp}
          onClick={toggleElementSize}
        >
          <CellNameComponent
            clickExpr={{ ref: id }}
            name={table.name}
            x={viewOffsetX}
            y={viewOffsetY}
            width={1}
            height={0.5}
            setSelection={this.setViewSelection}
            onDragStart={!readOnly && draggable && this.onNameDragStart}
            onDragEnd={clearDragProp}
          />
          <TableContentsComponent
            {...commonChildProps}
            ref={valuesSelected && this.setChildSelectionTableRef}
            viewHeight={viewHeight - 0.5}
            viewWidth={viewWidth - 1}
            viewOffsetX={viewOffsetX + 1}
            viewOffsetY={viewOffsetY + 0.5}
            viewSelected={valuesSelected}
            linkedScrollX={linkedScrollX}
            linkedScrollY={linkedScrollY}
          />
          <TableKeysComponent
            {...commonChildProps}
            ref={keysSelected && this.setChildSelectionTableRef}
            viewHeight={1}
            viewWidth={viewWidth - 1}
            viewOffsetX={viewOffsetX + 1}
            viewOffsetY={viewOffsetY}
            viewSelected={keysSelected}
            linkedScrollX={linkedScrollX}
            outerViewHeight={viewHeight}
          />
          <TableIndicesComponent
            {...commonChildProps}
            ref={indicesSelected && this.setChildSelectionTableRef}
            viewHeight={viewHeight - 0.5}
            viewWidth={1}
            viewOffsetX={viewOffsetX}
            viewOffsetY={viewOffsetY + 0.5}
            viewSelected={indicesSelected}
            linkedScrollY={linkedScrollY}
            outerViewWidth={viewWidth}
          />
        </ResizeHandleComponent>
      </Fragment>
    );
  }
}

const mapStateToProps = (state, ownProps) => ({
  table: getRefsById(state)[ownProps.id],
  draggable: !formulaHasFocus(state),
});

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  null, // mergeProps
  { withRef: true },
)(TableComponent);
