import React, { PureComponent } from 'react';

export default class FireWhenClickedOutside extends PureComponent {
  constructor(props) {
    super(props);
    this.handleClick = this.handleClick.bind(this);
    this.setRef = this.setRef.bind(this);
  }

  setRef(ref) {
    this.ref = ref;
  }

  componentDidMount() {
    document.addEventListener('mousedown', this.handleClick);
  }

  componentWillUnmount() {
    document.removeEventListener('mousedown', this.handleClick);
  }

  handleClick(ev) {
    if (this.ref && !this.ref.contains(ev.target)) {
      this.props.callback(ev);
    }
  }

  render() {
    return (
      <div style={{ display: 'contents' }} ref={this.setRef}>
        {this.props.children}
      </div>
    );
  }
}
