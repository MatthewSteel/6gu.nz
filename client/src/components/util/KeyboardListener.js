import { PureComponent } from 'react';
import uuidv4 from 'uuid-v4';

export const FALL_THROUGH = undefined;
export const CAPTURE = true;

let listenerStack = [];
const processKey = (ev) => {
  let seenGreedyHandler = false;
  listenerStack.forEach(({ callback, greedy }) => {
    if (ev.defaultPrevented || seenGreedyHandler) return;
    const captureGreedily = callback(ev);
    const captured = captureGreedily === CAPTURE;
    seenGreedyHandler = seenGreedyHandler || greedy || captured;
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
