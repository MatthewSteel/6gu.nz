import React, { Component } from 'react';
import { stringFormula } from '../../selectors/formulas/formulas';


class FormulaComponent extends Component {
  constructor(props) {
    super(props);
    this.state = { value: stringFormula(props.selection) };

    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.selection !== this.props.selection) {
      this.setState({ value: stringFormula(nextProps.selection) });
    }
  }

  handleChange(ev) {
    this.setState({ value: ev.target.value });
  }

  handleSubmit(ev) {
    ev.preventDefault();
    const { selection, setFormula } = this.props;
    if (!selection) return;
    setFormula(this.state.value);
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
        />
        <input
          type="submit"
          value="Go"
        />
      </form>
    );
  }
}

export default FormulaComponent;
