import React from 'react';
import { connect } from 'react-redux';

import CellValueComponent from '../CellComponent/CellValueComponent';
import EmptyCellComponent from '../CellComponent/EmptyCellComponent';
import CellSelectionComponent from '../CellComponent/CellSelectionComponent';
import ContentsBaseComponent, { mapDispatchToProps } from './ContentsBaseComponent';
import scrollHelper from '../util/ScrollHelper';

import { foreignKeyClickTargets, getRefsById, refsAtPosition } from '../../selectors/formulas/selectors';
import { COMPUTED_TABLE_COLUMN } from '../../redux/stateConstants';


class TableContentsComponent extends ContentsBaseComponent {
  constructor(props) {
    super(props);
    this.ScrollHelper = scrollHelper(this.onScroll);
  }

  static getDerivedStateFromProps(nextProps) {
    return {
      scrollY: nextProps.linkedScrollY,
      scrollX: nextProps.linkedScrollX,
    };
  }

  scroll(coords) {
    const { scrollY, scrollX } = coords;
    const { updateScroll } = this.props;
    updateScroll({ linkedScrollY: scrollY, linkedScrollX: scrollX });
  }

  maybeSelectedCell() {
    const { cells, columns, context } = this.props;
    const { selY, selX } = this.localSelection();
    if (!cells) return { ...context, selY, selX };

    const maybeCol = columns && columns[selX];
    if (maybeCol && maybeCol.type === COMPUTED_TABLE_COLUMN) {
      return { ...maybeCol, selX, selY };
    }
    const cell = cells[`${selY},${selX}`];
    return cell && { ...cell, selY, selX };
  }

  cellPosition(cell) {
    return { y: cell.selY, x: cell.selX, width: 1, height: 1 };
  }

  locationSelected() {
    const { columns } = this.props;
    const { selX } = this.localSelection();
    const maybeCol = columns[selX];
    if (maybeCol && maybeCol.type === COMPUTED_TABLE_COLUMN) {
      return { type: COMPUTED_TABLE_COLUMN, index: selX };
    }
    return undefined;
  }

  bounds() {
    const { tableData, context, readOnly } = this.props;
    const appendExtraCell = (readOnly || context.formula) ? 0 : 1;
    return {
      xLB: 0,
      yLB: 0,
      yUB: tableData.arr.length + appendExtraCell,
      xUB: tableData.keys.length + appendExtraCell,
    };
  }

  localScale() {
    return { y: 2, x: 1 };
  }

  render() {
    const {
      cells,
      columns,
      contextId,
      foreignKeyTargets,
      readOnly,
      setCellFormula,
      tableData,
      viewSelected,
      viewHeight,
      viewWidth,
      viewOffsetX,
      viewOffsetY,
      writeLoc,
    } = this.props;
    const children = [];
    const { selY, selX } = this.localSelection();
    const { scrollY, scrollX } = this.state;
    const bounds = this.bounds();
    const visibleWidth = viewWidth;
    const visibleHeight = viewHeight * 2;
    for (
      let col = scrollX;
      col - scrollX < visibleWidth && col < bounds.xUB;
      ++col
    ) {
      const worldCol = viewOffsetX + (col - scrollX);
      for (
        let row = scrollY;
        row - scrollY < visibleHeight && row < bounds.yUB;
        ++row
      ) {
        const worldRow = viewOffsetY + (row - scrollY) / 2;
        const clickLoc = `${row},${col}`;
        const columnName = tableData.keys[col];
        let cellReadOnly = true;
        let clickExpr = { ref: contextId };
        const fkList = (columns && columns[col] && columns[col].foreignKey)
          || undefined;
        if (columnName) {
          clickExpr = {
            lookup: columnName,
            on: { lookupIndex: { value: row }, on: { ref: contextId } },
          };
        }
        if (columns && columns[col]) {
          const on = { ref: columns[col].id };
          clickExpr = { lookupIndex: { value: row }, on };
        }
        if (cells && cells[clickLoc]) {
          const cell = cells[clickLoc];
          clickExpr = { ref: cell.id };
          if (foreignKeyTargets[cell.arrayId]) {
            const right = { ref: foreignKeyTargets[cell.arrayId] };
            clickExpr = { binary: '->', left: clickExpr, right };
          }
          cellReadOnly = readOnly;
        }

        // labels
        const cellSelected = viewSelected && selX === col && selY === row;
        const maybeRowData = tableData.arr[row];
        let maybeCellData;
        if (maybeRowData) {
          if (maybeRowData.error) {
            maybeCellData = maybeRowData;
          } else {
            maybeCellData = maybeRowData.value.byName[columnName];
          }
        }

        const geomProps = {
          x: worldCol,
          y: worldRow,
          height: 0.5,
          width: 1,
        };
        if (cellSelected) {
          children.push((
            <CellSelectionComponent
              {...geomProps}
              key="selection"
              selection={this.selectedCellId()}
            />
          ));
        }
        children.push(maybeCellData ? (
          <CellValueComponent
            {...geomProps}
            clickExpr={clickExpr}
            setCellFormula={!cellReadOnly && setCellFormula}
            value={maybeCellData}
            setSelection={this.setViewSelection}
            key={`name-${col},${row}`}
            writable={!cellReadOnly && cellSelected}
            fkList={fkList}
          />
        ) : (
          <EmptyCellComponent
            {...geomProps}
            clickExpr={clickExpr}
            setSelection={this.setViewSelection}
            key={`name-${col},${row}`}
            writable={!readOnly && cellSelected}
            writeLocValue={writeLoc}
            fkList={fkList}
          />
        ));
      }
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
  const { contextId } = ownProps;
  const context = getRefsById(state)[contextId];
  const { cells, columns } = !context.formula && refsAtPosition(state)[contextId];
  const foreignKeyTargets = foreignKeyClickTargets(state)[contextId];
  return { context, cells, columns, foreignKeyTargets };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  null, // mergeProps
  { withRef: true },
)(TableContentsComponent);
