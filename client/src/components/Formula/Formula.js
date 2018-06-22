import React, { Component } from 'react';
import { connect } from 'react-redux';
import equal from 'fast-deep-equal';

import { stringFormula } from '../../selectors/formulas/unparser';
import { deleteThing, setFormula } from '../../redux/documentEditing';
import './Formula.css';


class Formula extends Component {
  constructor(props) {
    super(props);
    this.inputRef = null;
    this.state = { value: props.initialValue };

    this.handleChange = this.handleChange.bind(this);
    this.handleOnBlur = this.handleOnBlur.bind(this);
    this.handleOnFocus = this.handleOnFocus.bind(this);
    this.submit = this.submit.bind(this);
    this.setFormula = this.setFormula.bind(this);
    this.setRef = this.setRef.bind(this);
  }

  componentWillReceiveProps(nextProps) {
    if (
      nextProps.initialValue !== this.props.initialValue ||
      !equal(nextProps.selection, this.props.selection)
    ) {
      this.setState({ value: nextProps.initialValue });
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

  resetValue() {
    this.setState({ value: this.props.initialValue });
  }

  blur() {
    this.resetValue();
    this.inputRef.blur();
  }

  focus() {
    // Called by Sheet component only
    this.inputRef.focus();
    const { length } = this.state.value;
    this.inputRef.setSelectionRange(length, length);
  }

  sendKey(key) {
    // Called by Sheet component only
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
    this.resetValue();
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

const mapStateToProps = (state, ownProps) => {
  const selectedCellId = ownProps.selection && ownProps.selection.cellId;
  return {
    initialValue: selectedCellId ?
      stringFormula(state, selectedCellId) :
      '',
  };
};

const mapDispatchToProps = dispatch => ({
  deleteCell: cellId => dispatch(deleteThing(cellId)),
  setCellFormula: (context, cellId, formula) => dispatch(setFormula(context, cellId, formula)),
});

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  null, // mergeProps
  { withRef: true }, // so we can access member functions
)(Formula);
