import React, { Component, Fragment } from 'react';
import { connect } from 'react-redux';
import equal from 'fast-deep-equal';

import KeyboardListener from '../util/KeyboardListener';
import { stringFormula } from '../../selectors/formulas/unparser';
import { deleteLoc, deleteThing, setFormula } from '../../redux/documentEditing';
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
    this.keys = this.keys.bind(this);

    this.hasFocus = false; // Not for display, just for keeping track.
  }

  componentWillReceiveProps(nextProps) {
    if (
      nextProps.initialValue !== this.props.initialValue
      || !equal(nextProps.selection, this.props.selection)
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
    } = this.props;
    if (selection.readOnly) return;
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
    if (this.inputRef) this.inputRef.blur();
  }

  handleOnBlur() {
    this.hasFocus = false;
  }

  handleOnFocus() {
    this.hasFocus = true;
  }

  keys(ev) {
    if (this.hasFocus) return this.formulaKeys(ev);
    return this.cellKeys(ev);
  }

  formulaKeys(ev) {
    if (ev.key === 'Escape') {
      // Enter selects the formula box
      this.blur();
      ev.preventDefault();
    }
    // I'm not over the moon about submitting on shift-enter -- it could be
    // useful for entering multiline, rich text etc...
    // Maybe if/when we do that, that entry can suppress this behaviour?
    if (ev.key === 'Enter' || ev.key === 'Tab') {
      this.submit();
      // Don't prevent default, just let the selection move naturally :-)
    }
  }

  cellKeys(ev) {
    const { deleteCell, deleteLocation, selection } = this.props;
    if (selection.readOnly) return;
    if (ev.key === 'Enter') {
      this.focus();
      ev.preventDefault();
    }
    if (ev.key === 'Backspace' || ev.key === 'Delete') {
      ev.preventDefault();
      if (selection.locationSelected) {
        const { type, index } = selection.locationSelected;
        deleteLocation(selection.context, type, index);
      } else {
        deleteCell(selection.cellId);
      }
    }
    if (ev.key.length === 1) {
      ev.preventDefault();
      this.sendKey(ev.key);
    }
  }

  render() {
    const selection = this.props;
    const readOnly = !selection || selection.readOnly;
    return (
      <Fragment>
        <input
          type="text"
          className="FormulaInput"
          disabled={readOnly}
          value={this.state.value}
          onChange={this.handleChange}
          onBlur={this.handleOnBlur}
          onFocus={this.handleOnFocus}
          ref={this.setRef}
        />
        <KeyboardListener callback={this.keys} priority={6} />
      </Fragment>
    );
  }
}

const mapStateToProps = (state) => {
  const { selection } = state;
  const selectedCellId = selection && selection.cellId;
  return {
    selection,
    initialValue: selectedCellId
      ? stringFormula(state, selectedCellId)
      : '',
  };
};

const mapDispatchToProps = dispatch => ({
  deleteCell: cellId => dispatch(deleteThing(cellId)),
  deleteLocation: (context, y, x) => dispatch(deleteLoc(context, y, x)),
  setCellFormula: (context, cellId, formula) => dispatch(setFormula(context, cellId, formula)),
});

export default connect(mapStateToProps, mapDispatchToProps)(Formula);
