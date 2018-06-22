export const topologicalOrdering = (graph, badNodes) => {
  const graphWithOmissions = {};
  Object.entries(graph).forEach(([iNode, jNodes]) => {
    if (badNodes.has(iNode)) {
      graphWithOmissions[iNode] = [];
    } else {
      graphWithOmissions[iNode] = jNodes;
    }
  });
  return dfsOrder(graphWithOmissions).filter(id => !badNodes.has(id));
};

export const transitiveClosure = (ids, graph) => {
  let frontier = ids;
  const closure = new Set(frontier);
  while (frontier.length > 0) {
    const newFrontier = [];
    frontier.forEach((id) => {
      const nextNodes = graph[id] || [];
      nextNodes.forEach((nextNode) => {
        if (!closure.has(nextNode)) {
          closure.add(nextNode);
          newFrontier.push(nextNode);
        }
      });
    });
    frontier = newFrontier;
  }
  // Do not include source nodes in transitive closure, we usually want to
  // treat them specially.
  ids.forEach((id) => { closure.delete(id); });
  return closure;
};

export const setIntersection = (setA, setB) => {
  const intersection = new Set();
  setA.forEach((value) => {
    if (setB.has(value)) intersection.add(value);
  });
  return intersection;
};


// Depth first search

const maybeDfsExpand = (graph, node, marked, postOrderCallback, prev) => {
  if (marked.has(node)) return;
  marked.add(node);
  graph[node].forEach((jNode) => {
    maybeDfsExpand(graph, jNode, marked, postOrderCallback, node);
  });
  postOrderCallback(node, prev);
};

const dfs = (graph, order, postOrderCallback) => {
  const marked = new Set();
  order.forEach((node) => {
    maybeDfsExpand(graph, node, marked, postOrderCallback);
  });
};

const dfsOrder = (graph) => {
  const ret = [];
  dfs(graph, Object.keys(graph), node => ret.push(node));
  return ret.reverse();
};

export const nodesInLargeStronglyConnectedComponents = (
  forwardsGraph,
  backwardsGraph,
) => {
  // Kosaraju's algorithm, more or less.
  const forwardsOrder = dfsOrder(forwardsGraph);
  const ret = new Set();
  dfs(
    backwardsGraph,
    forwardsOrder,
    (node, prev) => {
      if (prev !== undefined) {
        ret.add(prev);
        ret.add(node);
      }
    },
  );
  return ret;
};

// digMut(state, ['openDocument', 'data'], newData)
//   ->
//  {
//    ...state,
//    openDocument: {
//      ...state.openDocument,
//      data: newData,
//    },
//  }
export const digMut = (orig, path, replacement, depth = 0) => {
  if (depth === path.length) {
    if (typeof replacement === 'function') return replacement(orig);
    return replacement;
  }
  const key = path[depth];
  return {
    ...orig,
    [key]: digMut(orig[key], path, replacement, depth + 1),
  };
};


export const nameCopy = (existingNames, copiedName) => {
  // Regex is:
  //  - Some text, non-greedy, then
  //  - Maybe a (1) numeric modifier.
  // "asdf" -> "asdf", "asdf_a" -> "asdf_a", "asdf_1" -> ("asdf", "1")
  const regex = /^(.+?)(_(\d+))?$/;
  const match = copiedName.match(regex);
  const baseName = match[1];
  const conflicts = new Set();
  existingNames.forEach((name) => {
    const maybeConflict = name.match(regex);
    if (maybeConflict[1] === baseName) {
      conflicts.add(parseInt(maybeConflict[3], 10));
    }
  });
  let i;
  for (i = 1; conflicts.has(i); ++i);
  return `${baseName}_${i}`;
};
