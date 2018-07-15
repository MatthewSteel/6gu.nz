import React from 'react';
import { connect } from 'react-redux';

import CellNameComponent from '../CellComponent/CellNameComponent';
import CellValueComponent from '../CellComponent/CellValueComponent';
import CellSelectionComponent from '../CellComponent/CellSelectionComponent';
import EmptyCellComponent from '../CellComponent/EmptyCellComponent';
import ContentsBaseComponent, { mapDispatchToProps } from './ContentsBaseComponent';
import scrollHelper from '../util/ScrollHelper';

import { getRefsById, refsAtPosition } from '../../selectors/formulas/selectors';
import { OBJECT_CELL } from '../../redux/stateConstants';


class ObjectContentsComponent extends ContentsBaseComponent {
  constructor(props) {
    super(props);
    this.ScrollHelper = scrollHelper(this.onScroll);
  }

  static getDerivedStateFromProps(nextProps) {
    const { cells, tableData } = nextProps;
    if (cells) return { colsByIndex: cells.map(({ name }) => name) };
    const colsByIndex = [];
    Object.keys(tableData.byName).forEach((key) => { colsByIndex.push(key); });
    return { colsByIndex };
  }

  maybeSelectedCell() {
    const { cells, context } = this.props;
    const { selY, selX } = this.localSelection();
    if (context.formula) return { ...context, selX, selY };
    const maybeCell = cells[selX];
    return maybeCell && { ...maybeCell, selY };
  }

  cellPosition(cell) {
    const { context } = this.props;
    if (context.formula) return { y: cell.selY, x: cell.selX, width: 1, height: 1 };
    return { y: cell.selY, x: cell.index, width: 1, height: 1 };
  }

  locationSelected() {
    const { context } = this.props;
    if (context.formula) return undefined;
    const { selY, selX } = this.localSelection();
    if (selY !== 0) return undefined;
    return { type: OBJECT_CELL, index: selX };
  }

  bounds() {
    const { context, readOnly, tableData } = this.props;
    const appendExtraCell = (readOnly || context.formula) ? 0 : 1;
    return {
      xLB: 0,
      yLB: 0,
      yUB: 2,
      xUB: Object.keys(tableData.byName).length + appendExtraCell,
    };
  }

  localScale() {
    return { y: 2, x: 1 };
  }

  render() {
    const {
      tableData,
      viewSelected,
      viewWidth,
      viewOffsetX,
      viewOffsetY,
    } = this.props;
    const children = [];
    const { selY, selX } = this.localSelection();
    const { colsByIndex, scrollX } = this.state;
    const bounds = this.bounds();
    const numVisibleCells = viewWidth;
    for (
      let col = scrollX;
      col - scrollX < numVisibleCells && col < bounds.xUB;
      ++col
    ) {
      const worldCol = viewOffsetX + (col - scrollX);

      // labels
      const nameSelected = viewSelected && selY === 0 && selX === col;
      if (nameSelected) {
        children.push((
          <CellSelectionComponent
            x={worldCol}
            height={1}
            y={viewOffsetY}
            width={1}
            key="selection"
          />
        ));
      }
      children.push((
        <CellNameComponent
          x={worldCol}
          width={1}
          y={viewOffsetY}
          height={0.5}
          name={colsByIndex[col]}
          setSelection={this.setViewSelection}
          key={`name-${col}`}
        />
      ));

      // values + blanks
      const cellSelected = viewSelected && selY === 1 && selX === col;
      const maybeValue = tableData.byName[colsByIndex[col]];
      const geomProps = {
        x: worldCol,
        y: viewOffsetY + 0.5,
        width: 1,
        height: 0.5,
      };

      if (cellSelected) {
        children.push((
          <CellSelectionComponent
            {...geomProps}
            key="selection"
          />
        ));
      }
      children.push(maybeValue ? (
        <CellValueComponent
          {...geomProps}
          value={maybeValue}
          setSelection={this.setViewSelection}
          key={`cell-${col}`}
        />
      ) : (
        <EmptyCellComponent
          {...geomProps}
          setSelection={this.setViewSelection}
          key={`cell-${col}`}
        />
      ));
    }

    return (
      <this.ScrollHelper>
        {super.render()}
        {children}
      </this.ScrollHelper>
    );
  }
}

const mapStateToProps = (state, ownProps) => {
  const context = getRefsById(state)[ownProps.contextId];
  const cells = !context.formula && refsAtPosition(state)[ownProps.contextId];
  return { context, cells };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  null, // mergeProps
  { withRef: true },
)(ObjectContentsComponent);
