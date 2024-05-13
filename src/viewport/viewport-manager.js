/**
 * This code is adapted from the XYFlow library (https://github.com/xyflow/xyflow)
 */
import {getD3Transition, isWrappedWithClass, viewportToTransform, wheelDelta} from "./utils";
import {pointer, select} from "d3-selection";
import {zoom, zoomTransform} from "d3-zoom";
import {clamp} from "../util";
import {
    createPanOnScrollHandler, createPanZoomEndHandler,
    createPanZoomHandler,
    createPanZoomStartHandler,
    createZoomOnScrollHandler
} from "./events";


export function createFilter({
  zoomActivationKeyPressed,
  zoomOnScroll,
  zoomOnPinch,
  panOnDrag,
  panOnScroll,
  zoomOnDoubleClick,
  userSelectionActive,
  noWheelClassName,
  noPanClassName,
}) {
  return (event) => {
    const zoomScroll = zoomActivationKeyPressed || zoomOnScroll;
    const pinchZoom = zoomOnPinch && event.ctrlKey;

    // if all interactions are disabled, we prevent all zoom events
    if (!panOnDrag && !zoomScroll && !panOnScroll && !zoomOnDoubleClick && !zoomOnPinch) {
      return false;
    }

    // during a selection we prevent all other interactions
    if (userSelectionActive) {
      return false;
    }

    // if the target element is inside an element with the nowheel class, we prevent zooming
    if (isWrappedWithClass(event, noWheelClassName) && event.type === 'wheel') {
      return false;
    }

    // if the target element is inside an element with the nopan class, we prevent panning
    if (
      isWrappedWithClass(event, noPanClassName) &&
      (event.type !== 'wheel' || (panOnScroll && event.type === 'wheel' && !zoomActivationKeyPressed))
    ) {
      return false;
    }

    if (!zoomOnPinch && event.ctrlKey && event.type === 'wheel') {
      return false;
    }

    // when there is no scroll handling enabled, we prevent all wheel events
    if (!zoomScroll && !panOnScroll && !pinchZoom && event.type === 'wheel') {
      return false;
    }

    // if the pane is not movable, we prevent dragging it with mousestart or touchstart
    if (!panOnDrag && (event.type === 'mousedown' || event.type === 'touchstart')) {
      return false;
    }

    // if the pane is only movable using allowed clicks
    if (Array.isArray(panOnDrag) && !panOnDrag.includes(event.button) && event.type === 'mousedown') {
      return false;
    }

    // We only allow right clicks if pan on drag is set to right click
    const buttonAllowed =
      (Array.isArray(panOnDrag) && panOnDrag.includes(event.button)) || !event.button || event.button <= 1;

    // default filter for d3-zoom
    return (!event.ctrlKey || event.type === 'wheel') && buttonAllowed;
  };
}

export function panZoomManager({
  domNode,
  minZoom,
  maxZoom,
  viewport,
  onPanZoom,
  onPanZoomStart,
  onPanZoomEnd,
  onTransformChange,
  onDraggingChange,
}) {
  let translateExtent = [[-Infinity,-Infinity], [+Infinity,+Infinity]]

  const zoomPanValues = {
    isZoomingOrPanning: false,
    usedRightMouseButton: false,
    prevViewport: { x: 0, y: 0, zoom: 0 },
    mouseButton: 0,
    timerId: undefined,
    panScrollTimeout: undefined,
    isPanScrolling: false,
  };
  const bbox = domNode.getBoundingClientRect();
  const d3ZoomInstance = zoom().scaleExtent([minZoom, maxZoom])
  const d3Selection = select(domNode).call(d3ZoomInstance);


  setViewportConstrained(
    {
      x: viewport.x,
      y: viewport.y,
      zoom: clamp(viewport.zoom, minZoom, maxZoom),
    },
    [
      [0, 0],
      [bbox.width, bbox.height],
    ],
    translateExtent
  );

  const d3ZoomHandler = d3Selection.on('wheel.zoom')
  const d3DblClickZoomHandler = d3Selection.on('dblclick.zoom')
  d3ZoomInstance.wheelDelta(wheelDelta);

  function setTransform(transform, options) {
    if (d3Selection) {
      d3ZoomInstance?.transform(getD3Transition(d3Selection, options?.duration), transform);
    }
  }

  function update({
    noWheelClassName,
    noPanClassName,
    onPaneContextMenu,
    userSelectionActive,
    panOnScroll,
    panOnDrag,
    panOnScrollMode,
    panOnScrollSpeed,
    preventScrolling,
    zoomOnPinch,
    zoomOnScroll,
    zoomOnDoubleClick,
    zoomActivationKeyPressed,
  }) {
    if (userSelectionActive && !zoomPanValues.isZoomingOrPanning) {
      destroy();
    }

    const isPanOnScroll = panOnScroll && !zoomActivationKeyPressed && !userSelectionActive;

    const wheelHandler = isPanOnScroll
      ? createPanOnScrollHandler({
          zoomPanValues,
          noWheelClassName,
          d3Selection,
          d3Zoom: d3ZoomInstance,
          panOnScrollMode,
          panOnScrollSpeed,
          zoomOnPinch,
          onPanZoomStart,
          onPanZoom,
          onPanZoomEnd,
        })
      : createZoomOnScrollHandler({
          noWheelClassName,
          preventScrolling,
          d3ZoomHandler,
        });

    d3Selection.on('wheel.zoom', wheelHandler, { passive: false });

    if (!userSelectionActive) {
      // pan zoom start
      const startHandler = createPanZoomStartHandler({
        zoomPanValues,
        onDraggingChange,
        onPanZoomStart,
      });
      d3ZoomInstance.on('start', startHandler);

      // pan zoom
      const panZoomHandler = createPanZoomHandler({
        zoomPanValues,
        panOnDrag,
        onPaneContextMenu: !!onPaneContextMenu,
        onPanZoom,
        onTransformChange,
      });
      d3ZoomInstance.on('zoom', panZoomHandler);

      // pan zoom end
      const panZoomEndHandler = createPanZoomEndHandler({
        zoomPanValues,
        panOnDrag,
        panOnScroll,
        onPaneContextMenu,
        onPanZoomEnd,
        onDraggingChange,
      });
      d3ZoomInstance.on('end', panZoomEndHandler);
    }

    const filter = createFilter({
      zoomActivationKeyPressed,
      panOnDrag,
      zoomOnScroll,
      panOnScroll,
      zoomOnDoubleClick,
      zoomOnPinch,
      userSelectionActive,
      noPanClassName,
      noWheelClassName,
    });
    d3ZoomInstance.filter(filter);

    // We cannot add zoomOnDoubleClick to the filter above because
    // double tapping on touch screens circumvents the filter and
    // dblclick.zoom is fired on the selection directly
    if (zoomOnDoubleClick) {
      d3Selection.on('dblclick.zoom', d3DblClickZoomHandler);
    } else {
      d3Selection.on('dblclick.zoom', null);
    }
  }

  function destroy() {
    d3ZoomInstance.on('zoom', null);
  }

  function setViewportConstrained(
    viewport,
    extent,
    translateExtent
  ){

    const nextTransform = viewportToTransform(viewport);
    const contrainedTransform = d3ZoomInstance?.constrain()(nextTransform, extent, translateExtent);

    if (contrainedTransform) {
      setTransform(contrainedTransform);
    }

    return contrainedTransform;
  }

  function setViewport(viewport, options) {
    const nextTransform = viewportToTransform(viewport);

    setTransform(nextTransform, options);

    return nextTransform;
  }

  function syncViewport(viewport) {
    if (d3Selection) {
      const nextTransform = viewportToTransform(viewport);
      const currentTransform = d3Selection.property('__zoom');

      if (
        currentTransform.k !== viewport.zoom ||
        currentTransform.x !== viewport.x ||
        currentTransform.y !== viewport.y
      ) {

        d3ZoomInstance?.transform(d3Selection, nextTransform, null, { sync: true });
      }
    }
  }

  function getViewport() {
    const transform = d3Selection ? zoomTransform(d3Selection.node()) : { x: 0, y: 0, k: 1 };
    return { x: transform.x, y: transform.y, zoom: transform.k };
  }

  function scaleTo(zoom, options) {
    if (d3Selection) {
      d3ZoomInstance?.scaleTo(getD3Transition(d3Selection, options?.duration), zoom);
    }
  }

  function scaleBy(factor, options) {
    if (d3Selection) {
      d3ZoomInstance?.scaleBy(getD3Transition(d3Selection, options?.duration), factor);
    }
  }

  function setScaleExtent(scaleExtent) {
    d3ZoomInstance?.scaleExtent(scaleExtent);
  }

  function setTranslateExtent(translateExtent) {
    d3ZoomInstance?.translateExtent(translateExtent);
  }

  return {
    update,
    destroy,
    setViewport,
    setViewportConstrained,
    getViewport,
    scaleTo,
    scaleBy,
    setScaleExtent,
    setTranslateExtent,
    syncViewport,
  };
}