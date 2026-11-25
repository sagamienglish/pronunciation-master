export const SIZE = 5;
export const TURN_MS = 20000;

export function neighbors(index) {
  const row = Math.floor(index / SIZE);
  const column = index % SIZE;
  const diagonal = row % 2 ? 1 : -1;
  return [[row, column - 1], [row, column + 1],
    [row - 1, column], [row - 1, column + diagonal],
    [row + 1, column], [row + 1, column + diagonal]]
    .filter(([r, c]) => r >= 0 && r < SIZE && c >= 0 && c < SIZE)
    .map(([r, c]) => r * SIZE + c);
}

export function winningPath(owners, team) {
  const axis = team === 'blue' ? index => index % SIZE : index => Math.floor(index / SIZE);
  const queue = owners.flatMap((owner, index) => owner === team && axis(index) === 0 ? [index] : []);
  const previous = new Map(queue.map(index => [index, null]));
  for (const index of queue) {
    if (axis(index) === SIZE - 1) {
      const path = [];
      for (let tile = index; tile !== null; tile = previous.get(tile)) path.unshift(tile);
      return path;
    }
    for (const next of neighbors(index)) {
      if (owners[next] !== team || previous.has(next)) continue;
      previous.set(next, index);
      queue.push(next);
    }
  }
  return [];
}
