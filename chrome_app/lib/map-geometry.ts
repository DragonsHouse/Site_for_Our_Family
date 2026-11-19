export function catmullRomPath(points: Array<{ x: number; y: number }>, scale: number): string {
  if (points.length < 2) return '';
  const pts = points.map((p) => ({ x: p.x * scale, y: p.y * scale }));
  const closed = true;
  const res: Array<{ x: number; y: number }> = [];
  const total = pts.length;
  const get = (i: number) => pts[(i + total) % total];
  for (let i = 0; i < total; i += 1) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    const cp1 = {
      x: p1.x + (p2.x - p0.x) / 6,
      y: p1.y + (p2.y - p0.y) / 6
    };
    const cp2 = {
      x: p2.x - (p3.x - p1.x) / 6,
      y: p2.y - (p3.y - p1.y) / 6
    };
    res.push(p1, cp1, cp2, p2);
  }
  const [start] = pts;
  let d = `M ${start.x} ${start.y}`;
  for (let i = 0; i < res.length; i += 4) {
    const [, cp1, cp2, p2] = res.slice(i, i + 4);
    if (!p2) continue;
    d += ` C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${p2.x} ${p2.y}`;
  }
  if (closed) d += ' Z';
  return d;
}

export function pointInPolygon(point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function getPolygonBoundsCenter(points: Array<{ x: number; y: number }>) {
  if (!points.length) return { x: 0, y: 0 };
  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }
  return {
    x: Math.round((minX + maxX) / 2),
    y: Math.round((minY + maxY) / 2)
  };
}
