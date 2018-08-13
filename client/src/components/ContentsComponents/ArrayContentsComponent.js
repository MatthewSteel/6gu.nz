import React from 'react';
import { connect } from 'react-redux';

import ContentsBaseComponent, { mapDispatchToProps } from './ContentsBaseComponent';
import CellNameComponent from '../CellComponent/CellNameComponent';
import CellValueComponent from '../CellComponent/CellValueComponent';
import CellSelectionComponent from '../CellComponent/CellSelectionComponent';
import EmptyCellComponent from '../CellComponent/EmptyCellComponent';

import { getRefsById, refsAtPosition } from '../../selectors/formulas/selectors';
import scrollHelper from '../util/ScrollHelper';
import { ARRAY_CELL } from '../../redux/stateConstants';


class ArrayContentsComponent extends ContentsBaseComponent {
  constructor(props) {
    super(props);
    this.ScrollHelper = scrollHelper(this.onScroll);
  }

  maybeSelectedCell() {
    const { cells, context } = this.props;
    const { selY, selX } = this.localSelection();
    if (context.formula) return { ...context, selX, selY };
    const maybeCell = cells[selY];
    // Eww -- we lie so we can write the cell but select it in two ways.
    // See cellPosition below.
    return maybeCell && { ...maybeCell, selX };
  }

  cellPosition(cell) {
    const { context } = this.props;
    if (context.formula) return { y: cell.selY, x: cell.selX, width: 1, height: 1 };
    return { y: cell.index, x: cell.selX, width: 1, height: 1 };
  }

  locationSelected() {
    const { context } = this.props;
    if (context.formula) return undefined;
    const { selY, selX } = this.localSelection();
    if (selX !== 0) return undefined;
    return { type: ARRAY_CELL, index: selY };
  }

  bounds() {
    const { context, readOnly, tableData } = this.props;
    const readOnlyExtraCell = (readOnly || context.formula) ? 0 : 1;
    return {
      xLB: 0,
      yLB: 0,
      xUB: 2,
      yUB: tableData.arr.length + readOnlyExtraCell,
    };
  }

  localScale() {
    return { y: 2, x: 1 };
  }

  render() {
    const {
      cells,
      contextId,
      readOnly,
      setCellFormula,
      tableData,
      viewSelected,
      viewHeight,
      viewWidth,
      viewOffsetX,
      viewOffsetY,
    } = this.props;
    const children = [];
    const { selY, selX } = this.localSelection();
    const { scrollY, scrollX } = this.state;
    const bounds = this.bounds();
    const numVisibleCells = viewHeight * 2;
    for (
      let row = scrollY;
      row - scrollY < numVisibleCells && row < bounds.yUB;
      ++row
    ) {
      const worldRow = viewOffsetY + (row - scrollY) / 2;

      let cellReadOnly = true;
      let clickExpr = { lookupIndex: { value: row }, on: { ref: contextId } };
      if (cells && cells[row]) {
        clickExpr = { ref: cells[row].id };
        cellReadOnly = readOnly;
      }
      // labels
      if (scrollX === 0) {
        const cellSelected = viewSelected && selX === 0 && selY === row;
        if (cellSelected) {
          children.push((
            <CellSelectionComponent
              x={viewOffsetX}
              width={viewWidth}
              y={worldRow}
              height={0.5}
              key="selection"
              selection={this.selectedCellId()}
            />
          ));
        }
        children.push((
          <CellNameComponent
            x={viewOffsetX}
            width={1}
            y={worldRow}
            height={0.5}
            clickExpr={clickExpr}
            name={`${row}`}
            setSelection={this.setViewSelection}
            key={`name-${row}`}
          />
        ));
      }

      // values + blanks
      const contentsX = 1 - scrollX;
      if (contentsX >= viewWidth) continue;
      const cellSelected = viewSelected && selX === 1 && selY === row;
      const maybeValue = tableData.arr[row];
      const geomProps = {
        x: viewOffsetX + contentsX,
        width: 1,
        y: worldRow,
        height: 0.5,
      };

      if (cellSelected) {
        children.push((
          <CellSelectionComponent
            {...geomProps}
            selection={this.selectedCellId()}
            key="selection"
          />
        ));
      }
      children.push(maybeValue ? (
        <CellValueComponent
          {...geomProps}
          clickExpr={clickExpr}
          setCellFormula={!cellReadOnly && setCellFormula}
          value={maybeValue}
          setSelection={this.setViewSelection}
          key={`cell-${row}`}
        />
      ) : (
        <EmptyCellComponent
          {...geomProps}
          clickExpr={clickExpr}
          setSelection={this.setViewSelection}
          key={`cell-${row}`}
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
)(ArrayContentsComponent);
