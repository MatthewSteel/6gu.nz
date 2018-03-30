import React, { Component } from 'react';
import { stringFormula } from '../../selectors/formulas/parser';


class FormulaComponent extends Component {
  constructor(props) {
    super(props);
    this.inputRef = null;
    this.state = { value: stringFormula(props.selection) };

    this.handleChange = this.handleChange.bind(this);
    this.handleOnBlur = this.handleOnBlur.bind(this);
    this.handleOnFocus = this.handleOnFocus.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.resetValue = this.resetValue.bind(this);
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

  resetValue(selection) {
    this.setState({ value: stringFormula(selection) });
  }

  blur() {
    this.resetValue(this.props.selection);
    this.inputRef.blur();
  }

  focus() {
    // Called by TableComponent only
    this.inputRef.focus();
    const { length } = this.state.value;
    this.inputRef.setSelectionRange(length, length);
  }

  sendKey(key) {
    // Called by TableComponent only
    this.setState({ value: key });
    this.inputRef.setSelectionRange(1, 1);
    this.inputRef.focus();
  }

  handleChange(ev) {
    this.setState({ value: ev.target.value });
  }

  handleSubmit(ev) {
    ev.preventDefault();
    const { selection, setFormula } = this.props;
    if (!selection) return;
    setFormula(this.state.value);
    if (this.inputRef) {
      this.inputRef.blur();
    }
  }

  handleOnBlur() {
    this.props.setFormulaHasFocus(false);
  }

  handleOnFocus() {
    this.props.setFormulaHasFocus(true);
  }

  render() {
    return (
      <form
        id="myform"
        onSubmit={this.handleSubmit}
        autoComplete="off"
      >
        <input
          type="text"
          value={this.state.value}
          onChange={this.handleChange}
          onBlur={this.handleOnBlur}
          onFocus={this.handleOnFocus}
          ref={this.setRef}
        />
        <input
          type="submit"
          value="OK"
        />
      </form>
    );
  }
}

export default FormulaComponent;
