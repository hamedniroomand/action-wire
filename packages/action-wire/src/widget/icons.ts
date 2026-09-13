const NS = 'http://www.w3.org/2000/svg';

const SPARK =
  'M12 3l1.9 5.4a3 3 0 0 0 1.7 1.7L21 12l-5.4 1.9a3 3 0 0 0-1.7 1.7L12 21l-1.9-5.4a3 3 0 0 0-1.7-1.7L3 12l5.4-1.9a3 3 0 0 0 1.7-1.7z';

const SEND =
  'M3.4 20.4l17.45-7.48a1 1 0 0 0 0-1.84L3.4 3.6a1 1 0 0 0-1.4.92V9.5a1 1 0 0 0 .8.98L14 12 2.8 13.52a1 1 0 0 0-.8.98v4.98a1 1 0 0 0 1.4.92z';

export function sparkIcon(): SVGSVGElement {
  return icon(SPARK);
}

export function sendIcon(): SVGSVGElement {
  return icon(SEND);
}

function icon(d: string): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', d);
  svg.append(path);
  return svg;
}
