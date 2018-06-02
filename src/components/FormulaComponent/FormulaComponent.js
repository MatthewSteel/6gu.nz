import React, { Component } from 'react';
import { connect } from 'react-redux';
import equal from 'fast-deep-equal';

import { stringFormula } from '../../selectors/formulas/unparser';
import { deleteThing, setFormula } from '../../redux/store';
import './FormulaComponent.css';


class FormulaComponent extends Component {
  constructor(props) {
    super(props);
    this.inputRef = null;
    const selectedCellId = this.props.selection && this.props.selection.cellId;
    const initialValue = selectedCellId ?
      stringFormula(selectedCellId) :
      '';
    this.state = { value: initialValue };

    this.handleChange = this.handleChange.bind(this);
    this.handleOnBlur = this.handleOnBlur.bind(this);
    this.handleOnFocus = this.handleOnFocus.bind(this);
    this.submit = this.submit.bind(this);
    this.resetValue = this.resetValue.bind(this);
    this.setFormula = this.setFormula.bind(this);
    this.setRef = this.setRef.bind(this);
  }

  componentWillReceiveProps(nextProps) {
    if (!equal(nextProps.selection, this.props.selection)) {
      this.resetValue(nextProps.selection.cellId);
    }
  }

  setRef(ref) {
    this.inputRef = ref;
  }

  setFormula(formulaStr) {
    const {
      deleteCell,
      selection,
      setCellFormula,
      readOnly,
    } = this.props;
    if (readOnly) return;
    if (formulaStr !== '') {
      setCellFormula(selection, formulaStr);
    } else if (selection.cellId) {
      deleteCell(selection.cellId);
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
    // Selection often doesn't change when setting the name of an array
    if (selection.cellId) this.resetValue(selection.cellId);
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
  deleteCell: cellId => dispatch(deleteThing(cellId)),
  setCellFormula: (context, cellId, formula) => dispatch(setFormula(context, cellId, formula)),
});

export default connect(
  null, // mapStateToProps
  mapDispatchToProps,
  null, // mergeProps
  { withRef: true }, // so we can access member functions
)(FormulaComponent);
