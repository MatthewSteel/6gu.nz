import React from 'react';
import { connect } from 'react-redux';

import CellNameComponent from '../CellComponent/CellNameComponent';
import CellSelectionComponent from '../CellComponent/CellSelectionComponent';
import ContentsBaseComponent, { mapDispatchToProps } from './ContentsBaseComponent';
import ColumnMenu from '../ContextMenu/ColumnMenu';

import { foreignKeyClickTargets, getRefsById, refsAtPosition } from '../../selectors/formulas/selectors';
import scrollHelper from '../util/ScrollHelper';
import { TABLE_COLUMN } from '../../redux/stateConstants';


class TableKeysComponent extends ContentsBaseComponent {
  constructor(props) {
    super(props);
    this.ScrollHelper = scrollHelper(this.onScroll);
  }

  static getDerivedStateFromProps(nextProps) {
    return { scrollX: nextProps.linkedScrollX };
  }

  maybeSelectedCell() {
    const { columns, context } = this.props;
    const { selX } = this.localSelection();
    if (columns) return columns[selX];
    return { ...context, selX };
  }

  scroll(coords) {
    const { scrollX } = coords;
    const { updateScroll } = this.props;
    updateScroll({ linkedScrollX: scrollX });
  }

  cellPosition(cell) {
    const { columns } = this.props;
    if (columns) return { y: 0, x: cell.index, width: 1, height: 1 };
    return { y: 0, x: cell.selX, width: 1, height: 1 };
  }

  locationSelected() {
    const { context } = this.props;
    if (context.formula) return undefined;
    const { selX } = this.localSelection();
    const { columns } = this.props;
    const col = columns[selX];
    if (col) return { type: col.type, index: selX };
    return { type: TABLE_COLUMN, index: selX };
  }

  bounds() {
    const { tableData, context, readOnly } = this.props;
    const appendExtraCell = (readOnly || context.formula) ? 0 : 1;
    return {
      xLB: 0,
      yLB: 0,
      yUB: 1,
      xUB: tableData.keys.length + appendExtraCell,
    };
  }

  localScale() {
    return { y: 2, x: 1 };
  }

  render() {
    const {
      contextId,
      columns,
      foreignKeyTargets,
      readOnly,
      tableData,
      viewSelected,
      viewWidth,
      viewOffsetX,
      viewOffsetY,
      outerViewHeight,
      writeForeignKey,
    } = this.props;
    const children = [];
    const { selX } = this.localSelection();
    const { scrollX } = this.state;
    const bounds = this.bounds();
    const numVisibleCells = viewWidth;
    for (
      let col = scrollX;
      col - scrollX < numVisibleCells && col < bounds.xUB;
      ++col
    ) {
      const worldCol = viewOffsetX + (col - scrollX);

      // labels
      const nameSelected = viewSelected && selX === col;
      const name = tableData.keys[col];
      if (nameSelected) {
        children.push((
          <CellSelectionComponent
            x={worldCol}
            height={outerViewHeight}
            y={viewOffsetY}
            width={1}
            key="selection"
            selection={this.selectedCellId()}
          />
        ));
        if (!readOnly && columns && columns[col]) {
          children.push((
            <ColumnMenu
              column={columns[col]}
              x={worldCol}
              y={viewOffsetY}
              writeForeignKey={writeForeignKey}
              key="shut-up-react"
            />
          ));
        }
      }
      const hasForeignKey = columns && columns[col]
        && columns[col].foreignKey;
      let clickExpr = { ref: contextId };
      if (name) clickExpr = { lookup: name, on: { ref: contextId } };
      if (columns && columns[col]) clickExpr = { ref: columns[col].id };
      if (hasForeignKey) {
        const tableRef = { ref: foreignKeyTargets[columns[col].id] };
        clickExpr = { binary: '->', left: clickExpr, right: tableRef };
      }
      children.push((
        <CellNameComponent
          clickExpr={clickExpr}
          x={worldCol}
          width={1}
          y={viewOffsetY}
          height={0.5}
          name={name}
          setSelection={this.setViewSelection}
          key={`name-${col}`}
          isLookup={hasForeignKey}
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
  const refsById = getRefsById(state);
  const { contextId } = ownProps;
  const context = refsById[contextId];
  const { columns } = !context.formula && refsAtPosition(state)[contextId];
  const foreignKeyTargets = foreignKeyClickTargets(state)[contextId];
  return { context, columns, foreignKeyTargets };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  null, // mergeProps
  { withRef: true },
)(TableKeysComponent);
