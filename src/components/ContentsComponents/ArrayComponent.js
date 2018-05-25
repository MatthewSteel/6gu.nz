import React, { Fragment } from 'react';
import { connect } from 'react-redux';

import ArrayContentsComponent from './ArrayContentsComponent';
import ContentsBaseComponent from './ContentsBaseComponent';
import CellNameComponent from '../CellComponent/CellNameComponent';
import CellSelectionComponent from '../CellComponent/CellSelectionComponent';
import ResizeHandleComponent from '../DragComponents/ResizeHandleComponent';

import { getRefsById } from '../../selectors/formulas/selectors';
import { DRAG_MOVE } from '../../selectors/geom/dragGeom';
import { deleteLoc, deleteThing, toggleMaximiseSheetElem } from '../../redux/store';


class ArrayComponent extends ContentsBaseComponent {
  constructor(props) {
    super(props);
    this.onNameDragStart = this.onNameDragStart.bind(this);
  }

  onNameDragStart(ev) {
    ev.dataTransfer.setData('text/plain', ' ');
    const { id, startDragCallback } = this.props;
    startDragCallback(id, DRAG_MOVE);
  }

  maybeSelectedCell() {
    const { selY } = this.localSelection();
    const { array } = this.props;
    if (selY === 0) return array;
    return { ...array, childSelected: true }; // eww
  }

  // eslint-disable-next-line class-methods-use-this
  cellPosition(arr) {
    const { viewHeight, viewWidth } = this.props;
    const width = Math.min(viewWidth, 2);
    if (!arr.childSelected) return { y: 0, x: 0, width, height: 1 };

    // Kinda "virtual child" :-(
    return { y: 1, x: 0, width, height: 2 * viewHeight - 1 };
  }

  bounds() {
    // does not scroll -- header always in view.
    const { viewHeight, viewWidth } = this.props;
    const width = Math.min(viewWidth, 2);
    return { xLB: 0, yLB: 0, xUB: width, yUB: 2 * viewHeight };
  }

  // eslint-disable-next-line class-methods-use-this
  localScale() {
    return { y: 2, x: 1 };
  }

  render() {
    const {
      array,
      id,
      tableData,
      startDragCallback,
      endDragCallback,
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
    const selectedCell = this.maybeSelectedCell();
    const contentsSelected = viewSelected && selectedCell.childSelected;
    const width = Math.min(viewWidth, 2);

    return (
      <Fragment>
        <ResizeHandleComponent
          y={viewOffsetY + viewHeight - 1}
          x={viewOffsetX + viewWidth - 1}
          resizeRefId={id}
          selected={viewSelected}
          startDragCallback={startDragCallback}
          endDragCallback={endDragCallback}
          onClick={toggleElementSize}
        >
          <CellSelectionComponent
            selected={viewSelected && !selectedCell.childSelected}
            x={viewOffsetX}
            y={viewOffsetY}
            width={viewWidth}
            height={viewHeight}
          >
            <CellNameComponent
              name={array.name}
              x={viewOffsetX}
              y={viewOffsetY}
              width={width}
              height={0.5}
              setSelection={this.setViewSelection}
              onDragStart={this.onNameDragStart}
              onDragEnd={endDragCallback}
            />
          </CellSelectionComponent>
          <ArrayContentsComponent
            ref={contentsSelected && this.setChildSelectionTableRef}
            contextId={id}
            formulaRef={this.props.formulaRef}
            pushViewStack={pushViewStack}
            popViewStack={this.props.popViewStack}
            readOnly={readOnly}
            setFormulaSelection={this.props.setFormulaSelection}
            tableData={tableData}
            viewHeight={viewHeight - 0.5}
            viewWidth={width}
            viewOffsetX={viewOffsetX}
            viewOffsetY={viewOffsetY + 0.5}
            viewSelected={contentsSelected}
            viewSelX={viewSelX}
            viewSelY={viewSelY}
            setViewSelection={setViewSelection}
            startDragCallback={!readOnly ? this.startDragForRef : undefined}
            endDragCallback={!readOnly ? this.finishDrag : undefined}
          />
        </ResizeHandleComponent>
      </Fragment>
    );
  }
}

const mapStateToProps = (state, ownProps) => ({
  array: getRefsById(state)[ownProps.id],
});

const mapDispatchToProps = dispatch => ({
  deleteCell: cellId => dispatch(deleteThing(cellId)),
  deleteLocation: (context, y, x) => dispatch(deleteLoc(context, y, x)),
  toggleElementSize: refId => toggleMaximiseSheetElem(dispatch, refId),
});

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  null, // mergeProps
  { withRef: true },
)(ArrayComponent);
