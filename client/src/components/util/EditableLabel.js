import React, { Fragment, Component } from 'react';
import classNames from 'classnames';

import KeyboardListener from './KeyboardListener';
import './EditableLabel.css';

const selectTarget = (ev) => {
  ev.target.select();
};

export default class EditableLabel extends Component {
  constructor(props) {
    super(props);
    this.reset = this.reset.bind(this);
    this.keys = this.keys.bind(this);

    this.submit = this.submit.bind(this);
    this.startEditing = this.startEditing.bind(this);
    this.update = this.update.bind(this);

    this.state = { state: 'blank', name: this.defaultName(props) };
  }

  defaultName(props) {
    return props.defaultName || props.label;
  }

  update(ev) {
    this.setState({ name: ev.target.value });
  }

  reset() {
    this.setState({ state: 'blank', name: this.defaultName(this.props) });
  }

  keys(ev) {
    if (ev.key === 'Escape') this.reset();
    const { multiline } = this.props;
    if (multiline && ev.key === 'Enter' && !ev.shiftKey) this.submit(ev);
  }

  startEditing(ev) {
    if (!this.props.fn) return;
    this.setState({ state: 'editing' });
    ev.stopPropagation();
  }

  submit(ev) {
    ev.preventDefault();
    const { name } = this.state;
    this.reset();
    this.props.fn(name);
  }

  render() {
    const { label, multiline } = this.props;
    const { state, name } = this.state;
    const className = classNames(
      'FullSizeContents',
      { SingleLineInput: !multiline },
    );

    if (state !== 'editing') {
      return (
        <div className={className} onClick={this.startEditing}>
          {label}
        </div>
      );
    }
    const formProps = {
      className,
      autoFocus: true,
      onBlur: this.reset,
      onChange: this.update,
      onFocus: selectTarget,
    };
    const form = multiline
      ? <textarea {...formProps}>{name}</textarea>
      : (
        <form onSubmit={this.submit}>
          <input {...formProps} value={name} />
        </form>
      );
    return (
      <Fragment>
        <KeyboardListener callback={this.keys} priority={10} greedy />
        {form}
      </Fragment>
    );
  }
}
