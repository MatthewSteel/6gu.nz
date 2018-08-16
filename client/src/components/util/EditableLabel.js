import React, { Fragment, Component } from 'react';
import classNames from 'classnames';

import KeyboardListener from './KeyboardListener';
import FireWhenClickedOutside from './FireWhenClickedOutside';
import './EditableLabel.css';

const selectTarget = (ev) => {
  ev.target.select();
};

const defaultContents = ({ defaultName, label }) => (
  defaultName === undefined ? label : defaultName);

export default class EditableLabel extends Component {
  constructor(props) {
    super(props);
    this.reset = this.reset.bind(this);
    this.keys = this.keys.bind(this);

    this.submit = this.submit.bind(this);
    this.startEditing = this.startEditing.bind(this);
    this.update = this.update.bind(this);

    this.state = { state: 'blank', name: defaultContents(props) };
  }

  componentDidUpdate(prevProps) {
    if (defaultContents(prevProps) !== defaultContents(this.props)) {
      this.reset();
    }
  }

  update(ev) {
    this.setState({ name: ev.target.value });
  }

  reset() {
    this.setState({ state: 'blank', name: defaultContents(this.props) });
  }

  keys(ev) {
    if (ev.key === 'Escape') this.reset();
  }

  startEditing(ev) {
    if (!this.props.fn) return;
    this.setState({ state: 'editing' });
    ev.stopPropagation();
  }

  submit(ev) {
    ev.preventDefault();
    const { type } = this.props;
    const { name } = this.state;
    this.reset();
    let value = name;
    if (type === 'number') value = (name === '') ? NaN : Number(name);
    this.props.fn(value);
  }

  render() {
    const { label, type, extraClasses, fkList } = this.props;
    const { state, name } = this.state;
    const className = classNames(
      'FullSizeContents',
      extraClasses,
    );

    if (state !== 'editing') {
      return (
        <div className={className} onClick={this.startEditing}>
          {label}
        </div>
      );
    }
    const typeProps = (type === 'number')
      ? { type: 'number', step: 'any' } : {};
    return (
      <Fragment>
        <KeyboardListener callback={this.keys} priority={10} greedy />
        <FireWhenClickedOutside callback={this.reset}>
          <form onSubmit={this.submit}>
            <input
              className={className}
              autoFocus
              onBlur={this.reset}
              onChange={this.update}
              onFocus={selectTarget}
              value={name}
              list={fkList}
              {...typeProps}
            />
          </form>
        </FireWhenClickedOutside>
      </Fragment>
    );
  }
}
