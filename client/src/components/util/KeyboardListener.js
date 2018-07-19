import { PureComponent } from 'react';
import uuidv4 from 'uuid-v4';

let listenerStack = [];
const processKey = (ev) => {
  let seenGreedyHandler = false;
  listenerStack.forEach(({ callback, greedy }) => {
    if (ev.defaultPrevented || seenGreedyHandler) return;
    callback(ev);
    seenGreedyHandler = seenGreedyHandler || greedy;
  });
};
document.addEventListener('keydown', processKey);

class KeyboardListenerComponent extends PureComponent {
  constructor(props) {
    super(props);
    this.id = uuidv4();
  }

  componentDidMount() {
    const { priority, callback, greedy } = this.props;
    listenerStack.push({ id: this.id, priority, callback, greedy });
    listenerStack.sort((a, b) => b.priority - a.priority);
  }

  componentWillUnmount() {
    listenerStack = listenerStack.filter(({ id }) => id !== this.id);
  }

  render() { return false; }
}

export default KeyboardListenerComponent;
