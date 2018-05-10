export const topologicalOrdering = (backwardsGraph) => {
  // Count numInArcs
  const numInArcsByNode = {};
  Object.keys(backwardsGraph).forEach((id) => {
    numInArcsByNode[id] = 0;
  });
  Object.values(backwardsGraph).forEach((jIds) => {
    jIds.forEach((jId) => { numInArcsByNode[jId] += 1; });
  });

  // Get all the "leaf" formulas
  const ordering = Object.entries(numInArcsByNode)
    .map(([id, numInArcs]) => numInArcs === 0 && id)
    .filter(Boolean);

  // Append anything only feeds leaf formulas
  for (let i = 0; i < ordering.length; ++i) {
    backwardsGraph[ordering[i]].forEach((jId) => {
      numInArcsByNode[jId] -= 1;
      if (numInArcsByNode[jId] === 0) {
        ordering.push(jId);
      }
    });
  }
  return ordering;
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
