import { PureComponent } from 'react';

class KeyboardListenerComponent extends PureComponent {
  constructor(props) {
    super(props);
    this.callback = this.callback.bind(this);
  }
  componentDidMount() {
    document.addEventListener('keydown', this.callback);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.callback);
  }

  callback(ev) {
    return this.props.callback(ev);
  }

  render() { return false; }
}

export default KeyboardListenerComponent;
