import React, { Fragment } from 'react';
import { connect } from 'react-redux';

import ObjectContentsComponent from './ObjectContentsComponent';
import ContentsBaseComponent, { mapDispatchToProps } from './ContentsBaseComponent';
import CellNameComponent from '../CellComponent/CellNameComponent';
import CellSelectionComponent from '../CellComponent/CellSelectionComponent';
import ResizeHandleComponent from '../DragComponents/ResizeHandleComponent';

import { getRefsById } from '../../selectors/formulas/selectors';
import { DRAG_MOVE } from '../../selectors/geom/dragGeom';
import { formulaHasFocus } from '../../selectors/uistate/uistate';


class ObjectComponent extends ContentsBaseComponent {
  constructor(props) {
    super(props);
    this.onNameDragStart = this.onNameDragStart.bind(this);
  }

  onNameDragStart(ev) {
    ev.dataTransfer.setData('text/plain', ' ');
    const { id, startDragProp } = this.props;
    startDragProp(id, DRAG_MOVE);
  }

  maybeSelectedCell() {
    const { selX } = this.localSelection();
    const { object } = this.props;
    if (selX === 0) return object;
    return { ...object, childSelected: true }; // eww, see below
  }

  cellPosition(obj) {
    const { viewWidth } = this.props;
    if (!obj.childSelected) return { y: 0, x: 0, width: 1, height: 1 };

    // Kinda "virtual child" :-(
    return { y: 0, x: 1, width: viewWidth - 1, height: 1 };
  }

  bounds() {
    // does not scroll -- header always in view.
    const { viewWidth } = this.props;
    return { xLB: 0, yLB: 0, xUB: viewWidth, yUB: 1 };
  }

  localScale() {
    return { y: 2, x: 1 };
  }

  render() {
    const {
      object,
      id,
      tableData,
      draggable,
      startDragProp,
      clearDragProp,
      pushViewStack,
      readOnly,
      viewSelected,
      viewHeight,
      viewWidth,
      viewOffsetX,
      viewOffsetY,
      viewSelX,
      viewSelY,
      setViewSelection,
      toggleElementSize,
    } = this.props;
    const selectedCell = this.maybeSelectedCell();
    const contentsSelected = viewSelected && selectedCell.childSelected;

    return (
      <Fragment>
        {viewSelected && !selectedCell.childSelected && (
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
            name={object.name}
            x={viewOffsetX}
            y={viewOffsetY}
            width={1}
            height={1}
            setSelection={this.setViewSelection}
            onDragStart={!readOnly && draggable && this.onNameDragStart}
            onDragEnd={clearDragProp}
          />
          <ObjectContentsComponent
            ref={contentsSelected && this.setChildSelectionTableRef}
            contextId={id}
            pushViewStack={pushViewStack}
            popViewStack={this.props.popViewStack}
            readOnly={readOnly}
            tableData={tableData}
            viewHeight={1}
            viewWidth={viewWidth - 1}
            viewOffsetX={viewOffsetX + 1}
            viewOffsetY={viewOffsetY}
            viewSelected={contentsSelected}
            viewSelX={viewSelX}
            viewSelY={viewSelY}
            setViewSelection={setViewSelection}
            parentMove={this.move}
            parentRelativeScroll={this.relativeScroll}
          />
        </ResizeHandleComponent>
      </Fragment>
    );
  }
}

const mapStateToProps = (state, ownProps) => ({
  object: getRefsById(state)[ownProps.id],
  draggable: !formulaHasFocus(state),
});

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  null, // mergeProps
  { withRef: true },
)(ObjectComponent);
