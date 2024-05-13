/**
 * This code is adapted from the XYFlow library (https://github.com/xyflow/xyflow)
 */
import { zoomIdentity } from 'd3-zoom';

export const isMacOs = () => typeof navigator !== 'undefined' && navigator?.userAgent?.indexOf('Mac') >= 0;

export const viewChanged = (prevViewport, eventViewport) =>
  prevViewport.x !== eventViewport.x || prevViewport.y !== eventViewport.y || prevViewport.zoom !== eventViewport.k;

export const transformToViewport = (transform) => ({
  x: transform.x,
  y: transform.y,
  zoom: transform.k,
});

export const viewportToTransform = ({ x, y, zoom }) =>
  zoomIdentity.translate(x, y).scale(zoom);

export const isWrappedWithClass = (event, className) => event.target.closest(`.${className}`);

export const isRightClickPan = (panOnDrag, usedButton) =>
  usedButton === 2 && Array.isArray(panOnDrag) && panOnDrag.includes(2);

export const getD3Transition = (selection, duration = 0) =>
  typeof duration === 'number' && duration > 0 ? selection.transition().duration(duration) : selection;

export const wheelDelta = (event) => {
  const factor = event.ctrlKey && isMacOs() ? 10 : 1;

  return -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002) * factor;
};
