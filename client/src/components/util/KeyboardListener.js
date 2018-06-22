import { PureComponent } from 'react';
import uuidv4 from 'uuid-v4';

let listenerStack = [];

class KeyboardListenerComponent extends PureComponent {
  constructor(props) {
    super(props);
    this.callback = this.callback.bind(this);
    this.id = uuidv4();
  }

  componentDidMount() {
    document.addEventListener('keydown', this.callback);
    listenerStack.push(this.id);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.callback);
    listenerStack = listenerStack.filter(id => id !== this.id);
  }

  callback(ev) {
    if (this.id === listenerStack[listenerStack.length - 1]) {
      return this.props.callback(ev);
    }
    return false;
  }

  render() { return false; }
}

export default KeyboardListenerComponent;
