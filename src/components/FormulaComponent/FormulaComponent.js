import React, { Component } from 'react';
import { connect } from 'react-redux';

import { stringFormula } from '../../selectors/formulas/parser';
import { deleteCell, setFormula } from '../../redux/store';
import './FormulaComponent.css';


class FormulaComponent extends Component {
  constructor(props) {
    super(props);
    this.inputRef = null;
    this.state = { value: stringFormula(props.selection) };

    this.handleChange = this.handleChange.bind(this);
    this.handleOnBlur = this.handleOnBlur.bind(this);
    this.handleOnFocus = this.handleOnFocus.bind(this);
    this.submit = this.submit.bind(this);
    this.resetValue = this.resetValue.bind(this);
    this.setFormula = this.setFormula.bind(this);
    this.setRef = this.setRef.bind(this);
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.selection !== this.props.selection) {
      this.resetValue(nextProps.selection);
    }
  }

  setRef(ref) {
    this.inputRef = ref;
  }

  setFormula(formulaStr) {
    const {
      deleteCellProp,
      selection,
      setCellFormula,
      readOnly,
      sheetId,
    } = this.props;
    if (readOnly) return;
    if (formulaStr === '') {
      deleteCellProp(selection);
    } else {
      setCellFormula(sheetId, selection, formulaStr);
    }
  }

  resetValue(selection) {
    this.setState({ value: stringFormula(selection) });
  }

  blur() {
    this.resetValue(this.props.selection);
    this.inputRef.blur();
  }

  focus() {
    // Called by SheetComponent only
    this.inputRef.focus();
    const { length } = this.state.value;
    this.inputRef.setSelectionRange(length, length);
  }

  sendKey(key) {
    // Called by SheetComponent only
    this.setState({ value: key });
    this.inputRef.setSelectionRange(1, 1);
    this.inputRef.focus();
  }

  handleChange(ev) {
    this.setState({ value: ev.target.value });
  }

  submit() {
    const { selection } = this.props;
    if (!selection) return;
    this.inputRef.focus(); // Make sure view is properly focussed
    this.setFormula(this.state.value);
    this.inputRef.blur();
  }

  handleOnBlur() {
    this.props.setFormulaHasFocus(false);
  }

  handleOnFocus() {
    this.props.setFormulaHasFocus(true);
  }

  render() {
    return (
      <input
        type="text"
        className="FormulaInput"
        disabled={this.props.readOnly}
        value={this.state.value}
        onChange={this.handleChange}
        onBlur={this.handleOnBlur}
        onFocus={this.handleOnFocus}
        ref={this.setRef}
      />
    );
  }
}

const mapDispatchToProps = dispatch => ({
  deleteCellProp: cellId => dispatch(deleteCell(cellId)),
  setCellFormula: (sheetId, cellId, formula) => dispatch(setFormula(sheetId, cellId, formula)),
});

export default connect(
  null, // mapStateToProps
  mapDispatchToProps,
  null, // mergeProps
  { withRef: true }, // so we can access member functions
)(FormulaComponent);
