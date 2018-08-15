import React, { Component } from 'react';
import classNames from 'classnames';
import BaseCellComponent, { shouldCellComponentUpdate } from './BaseCellComponent';
import EditableLabel from '../util/EditableLabel';
import { getType } from '../../selectors/formulas/tables';
import './CellComponent.css';

const defaultFormatter = (value, pushStack, setCellValue, setCheckbox, writable) => {
  if (typeof value === 'string') {
    return (
      <EditableLabel
        label={value}
        fn={writable ? setCellValue : undefined}
        extraClasses="CenterContent"
      />
    );
  }
  if (typeof value === 'number') {
    let str = value.toString();
    const afterDecimal = str.split('.')[1];
    if (afterDecimal && afterDecimal.length > 6) str = value.toFixed(6);
    return (
      <EditableLabel
        label={str}
        fn={writable ? setCellValue : undefined}
        type="number"
        extraClasses="CenterContent"
      />
    );
  }
  if (typeof value === 'boolean') {
    // "writable" is "selected and not readonly". Not relevant here.
    return (
      <input
        key={value}
        type="checkbox"
        checked={value}
        disabled={!setCellValue}
        onChange={setCheckbox}
      />
    );
  }
  const ourType = getType(value);
  const ellipsis = '\u22ef';
  const vertEllipsis = '\u22ee';
  if (ourType === 'array') return `[${vertEllipsis}]`;
  if (ourType === 'object') {
    const contentsStr = `{${ellipsis}}`;
    if (!pushStack || !value.template) return contentsStr;
    return (
      <div style={{ position: 'relative', zIndex: 0 }}>
        {contentsStr}
        <button onClick={pushStack} className="StackButton" type="button">
          +
        </button>
      </div>
    );
  }
  if (ourType === 'table') return `[{${ellipsis}}]`;
  return JSON.stringify(value);
};


export default class CellValueComponent extends Component {
  constructor(props) {
    super(props);
    this.pushStack = this.pushStack.bind(this);
    this.setValue = this.setValue.bind(this);
    this.setCheckbox = this.setCheckbox.bind(this);
  }

  getCellContents() {
    const { pushViewStack, value, writable } = this.props;
    if (!value) return { error: 'Value missing' }; // ???
    if (value.error) return { error: value.error };
    return {
      formattedValue: defaultFormatter(
        value.value,
        pushViewStack && this.pushStack,
        this.props.setCellFormula ? this.setValue : undefined,
        this.props.setCellFormula ? this.setCheckbox : undefined,
        writable,
      ),
      override: value.override,
    };
  }

  setCheckbox(ev) {
    ev.preventDefault();
    return this.setValue(ev.target.checked);
  }

  setValue(value) {
    if (Number.isNaN(value)) return;

    const { setCellFormula } = this.props;
    const { ref } = this.props.clickExpr;
    if (!ref) throw new Error('Trying to edit non-ref cell value...');
    const selection = { cellId: ref, context: ref };
    if (!['boolean', 'string', 'number'].includes(typeof value)) {
      throw new Error('Trying to set cell value to bad type.');
    }
    const formula = JSON.stringify(value);
    setCellFormula(selection, formula);
  }

  pushStack(ev) {
    const { clickExpr, pushViewStack } = this.props;
    pushViewStack(clickExpr.ref);
    ev.preventDefault();
  }

  shouldComponentUpdate(nextProps) {
    return shouldCellComponentUpdate(this.props, nextProps);
  }

  render() {
    const { clickExpr, x, y, width, height, setSelection } = this.props;
    const { error, formattedValue, override } = this.getCellContents();
    const className = classNames(
      'CellValue', { CellValueError: error, CellValueOverride: override },
    );
    const title = override ? 'Value overridden in call' : error;
    return (
      <BaseCellComponent
        x={x}
        y={y}
        clickExpr={clickExpr}
        width={width}
        height={height}
        className={className}
        setSelection={setSelection}
        title={title}
      >
        {formattedValue}
      </BaseCellComponent>
    );
  }
}
