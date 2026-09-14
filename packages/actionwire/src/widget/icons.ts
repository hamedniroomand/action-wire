const NS = 'http://www.w3.org/2000/svg';

type Shape = readonly [tag: 'path' | 'circle' | 'rect', attrs: Readonly<Record<string, string>>];

function icon(shapes: readonly Shape[], className = ''): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  if (className !== '') svg.setAttribute('class', className);
  for (const [tag, attrs] of shapes) {
    const node = document.createElementNS(NS, tag);
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
    svg.append(node);
  }
  return svg;
}

export function wireIcon(): SVGSVGElement {
  return icon([
    ['path', { d: 'M1 8h14' }],
    ['circle', { cx: '8', cy: '8', r: '3', fill: 'currentColor', stroke: 'none' }],
  ]);
}
export function checkIcon(): SVGSVGElement {
  return icon([['path', { d: 'M3 8.5l3 3 7-7', 'stroke-width': '1.8' }]]);
}
export function warnIcon(): SVGSVGElement {
  return icon([
    ['path', { d: 'M8 2.5L14.5 13.5H1.5L8 2.5z' }],
    ['path', { d: 'M8 7v3M8 11.5v.2' }],
  ]);
}
export function errorIcon(): SVGSVGElement {
  return icon([
    ['circle', { cx: '8', cy: '8', r: '6' }],
    ['path', { d: 'M8 5v3.5M8 10.8v.2' }],
  ]);
}
export function stopIcon(): SVGSVGElement {
  return icon([
    [
      'rect',
      { x: '4', y: '4', width: '8', height: '8', rx: '1.5', fill: 'currentColor', stroke: 'none' },
    ],
  ]);
}
export function upIcon(): SVGSVGElement {
  return icon([['path', { d: 'M4 10l4-4 4 4' }]]);
}
export function closeIcon(): SVGSVGElement {
  return icon([['path', { d: 'M4 4l8 8M12 4l-8 8' }]]);
}
export function sendIcon(): SVGSVGElement {
  return icon([['path', { d: 'M8 13V3M3.5 7.5L8 3l4.5 4.5' }]]);
}
export function spinnerIcon(): SVGSVGElement {
  return icon(
    [
      ['circle', { cx: '8', cy: '8', r: '6', 'stroke-width': '2', opacity: '.25' }],
      ['path', { d: 'M8 2a6 6 0 0 1 6 6', 'stroke-width': '2' }],
    ],
    'spin',
  );
}
