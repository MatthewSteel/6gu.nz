import React, { Fragment } from 'react';
import { connect } from 'react-redux';

import CellNameComponent from '../CellComponent/CellNameComponent';
import CellSelectionComponent from '../CellComponent/CellSelectionComponent';
import ContentsBaseComponent, { mapDispatchToProps } from './ContentsBaseComponent';

import { getRefsById, refsAtPosition } from '../../selectors/formulas/selectors';
import { TABLE_ROW } from '../../redux/stateConstants';


class TableIndicesComponent extends ContentsBaseComponent {
  static getDerivedStateFromProps(nextProps) {
    return { scrollY: nextProps.linkedScrollY };
  }

  maybeSelectedCell() {
    const { rows, context } = this.props;
    const { selY } = this.localSelection();
    if (rows) return rows[selY];
    return { ...context, selY };
  }

  scroll(coords) {
    const { scrollY } = coords;
    const { updateScroll } = this.props;
    updateScroll({ linkedScrollY: scrollY });
  }

  // eslint-disable-next-line class-methods-use-this
  cellPosition(cell) {
    const { rows } = this.props;
    if (rows) return { x: 0, y: cell.index, width: 1, height: 1 };
    return { x: 0, y: cell.selY, width: 1, height: 1 };
  }

  // eslint-disable-next-line class-methods-use-this
  locationSelected() {
    const { context } = this.props;
    if (context.formula) return undefined;
    const { selY } = this.localSelection();
    return { type: TABLE_ROW, index: selY };
  }

  bounds() {
    const { tableData, context, readOnly } = this.props;
    const appendExtraCell = (readOnly || context.formula) ? 0 : 1;
    return {
      xLB: 0,
      yLB: 0,
      xUB: 1,
      yUB: tableData.arr.length + appendExtraCell,
    };
  }

  // eslint-disable-next-line class-methods-use-this
  localScale() {
    return { y: 2, x: 1 };
  }

  render() {
    const {
      viewSelected,
      viewHeight,
      viewOffsetX,
      viewOffsetY,
      outerViewWidth,
    } = this.props;
    const children = [];
    const { selY } = this.localSelection();
    const { scrollY } = this.state;
    const bounds = this.bounds();
    const numVisibleCells = 2 * viewHeight;
    for (
      let row = scrollY;
      row - scrollY < numVisibleCells && row < bounds.yUB;
      ++row
    ) {
      const worldRow = viewOffsetY + (row - scrollY) / 2;

      // labels
      const nameSelected = viewSelected && selY === row;
      if (nameSelected) {
        children.push((
          <CellSelectionComponent
            x={viewOffsetX}
            height={0.5}
            y={worldRow}
            width={outerViewWidth}
            selected={nameSelected}
            key="selection"
          />
        ));
      }
      children.push((
        <CellNameComponent
          x={viewOffsetX}
          width={1}
          y={worldRow}
          height={0.5}
          name={row}
          setSelection={this.setViewSelection}
          key={`name-${row}`}
        />
      ));
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
  const { rows } = !context.formula && refsAtPosition(state)[ownProps.contextId];
  return { context, rows };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  null, // mergeProps
  { withRef: true },
)(TableIndicesComponent);
