/**
 * This code is adapted from the XYFlow library (https://github.com/xyflow/xyflow)
 */
import { pointer } from 'd3-selection';
import {
    isMacOs,
    isRightClickPan,
    isWrappedWithClass,
    transformToViewport,
    viewChanged,
    wheelDelta,
} from './utils';

export let PanOnScrollMode = {
    Free: 'free',
    Vertical: 'vertical',
    Horizontal: 'horizontal',
};

export function createPanOnScrollHandler({
    zoomPanValues,
    noWheelClassName,
    d3Selection,
    d3Zoom,
    panOnScrollMode,
    panOnScrollSpeed,
    zoomOnPinch,
    onPanZoomStart,
    onPanZoom,
    onPanZoomEnd,
}) {
    return (event) => {
        if (isWrappedWithClass(event, noWheelClassName)) {
            return false;
        }
        event.preventDefault();
        event.stopImmediatePropagation();

        const currentZoom = d3Selection.property('__zoom').k || 1;

        // macos sets ctrlKey=true for pinch gesture on a trackpad
        if (event.ctrlKey && zoomOnPinch) {
            const point = pointer(event);
            const pinchDelta = wheelDelta(event);
            const zoom = currentZoom * Math.pow(2, pinchDelta);
            d3Zoom.scaleTo(d3Selection, zoom, point, event);

            return;
        }

        // increase scroll speed in firefox
        // firefox: deltaMode === 1; chrome: deltaMode === 0
        const deltaNormalize = event.deltaMode === 1 ? 20 : 1;
        let deltaX =
            panOnScrollMode === PanOnScrollMode.Vertical
                ? 0
                : event.deltaX * deltaNormalize;
        let deltaY =
            panOnScrollMode === PanOnScrollMode.Horizontal
                ? 0
                : event.deltaY * deltaNormalize;

        // this enables vertical scrolling with shift + scroll on windows
        if (
            !isMacOs() &&
            event.shiftKey &&
            panOnScrollMode !== PanOnScrollMode.Vertical
        ) {
            deltaX = event.deltaY * deltaNormalize;
            deltaY = 0;
        }

        d3Zoom.translateBy(
            d3Selection,
            -(deltaX / currentZoom) * panOnScrollSpeed,
            -(deltaY / currentZoom) * panOnScrollSpeed,
            { internal: true },
        );

        const nextViewport = transformToViewport(
            d3Selection.property('__zoom'),
        );

        clearTimeout(zoomPanValues.panScrollTimeout);

        // for pan on scroll we need to handle the event calls on our own
        // we can't use the start, zoom and end events from d3-zoom
        // because start and move gets called on every scroll event and not once at the beginning
        if (!zoomPanValues.isPanScrolling) {
            zoomPanValues.isPanScrolling = true;

            onPanZoomStart?.(event, nextViewport);
        }

        if (zoomPanValues.isPanScrolling) {
            onPanZoom?.(event, nextViewport);

            zoomPanValues.panScrollTimeout = setTimeout(() => {
                onPanZoomEnd?.(event, nextViewport);

                zoomPanValues.isPanScrolling = false;
            }, 150);
        }
    };
}

export function createZoomOnScrollHandler({
    noWheelClassName,
    preventScrolling,
    d3ZoomHandler,
}) {
    return function (event, d) {
        // we still want to enable pinch zooming even if preventScrolling is set to false
        const preventZoom =
            !preventScrolling && event.type === 'wheel' && !event.ctrlKey;

        if (preventZoom || isWrappedWithClass(event, noWheelClassName)) {
            return null;
        }

        event.preventDefault();

        d3ZoomHandler.call(this, event, d);
    };
}

export function createPanZoomStartHandler({
    zoomPanValues,
    onDraggingChange,
    onPanZoomStart,
}) {
    return (event) => {
        if (event.sourceEvent?.internal) {
            return;
        }

        const viewport = transformToViewport(event.transform);

        // we need to remember it here, because it's always 0 in the "zoom" event
        zoomPanValues.mouseButton = event.sourceEvent?.button || 0;
        zoomPanValues.isZoomingOrPanning = true;
        zoomPanValues.prevViewport = viewport;

        if (event.sourceEvent?.type === 'mousedown') {
            onDraggingChange(true);
        }

        if (onPanZoomStart) {
            onPanZoomStart?.(event.sourceEvent, viewport);
        }
    };
}

export function createPanZoomHandler({
    zoomPanValues,
    panOnDrag,
    onPaneContextMenu,
    onTransformChange,
    onPanZoom,
}) {
    return (event) => {
        zoomPanValues.usedRightMouseButton = !!(
            onPaneContextMenu &&
            isRightClickPan(panOnDrag, zoomPanValues.mouseButton ?? 0)
        );

        if (!event.sourceEvent?.sync) {
            onTransformChange([
                event.transform.x,
                event.transform.y,
                event.transform.k,
            ]);
        }

        if (onPanZoom && !event.sourceEvent?.internal) {
            onPanZoom?.(
                event.sourceEvent,
                transformToViewport(event.transform),
            );
        }
    };
}

export function createPanZoomEndHandler({
    zoomPanValues,
    panOnDrag,
    panOnScroll,
    onDraggingChange,
    onPanZoomEnd,
    onPaneContextMenu,
}) {
    return (event) => {
        if (event.sourceEvent?.internal) {
            return;
        }

        zoomPanValues.isZoomingOrPanning = false;

        if (
            onPaneContextMenu &&
            isRightClickPan(panOnDrag, zoomPanValues.mouseButton ?? 0) &&
            !zoomPanValues.usedRightMouseButton &&
            event.sourceEvent
        ) {
            onPaneContextMenu(event.sourceEvent);
        }
        zoomPanValues.usedRightMouseButton = false;

        onDraggingChange(false);

        if (
            onPanZoomEnd &&
            viewChanged(zoomPanValues.prevViewport, event.transform)
        ) {
            const viewport = transformToViewport(event.transform);
            zoomPanValues.prevViewport = viewport;

            clearTimeout(zoomPanValues.timerId);
            zoomPanValues.timerId = setTimeout(
                () => {
                    onPanZoomEnd?.(event.sourceEvent, viewport);
                },
                // we need a setTimeout for panOnScroll to supress multiple end events fired during scroll
                panOnScroll ? 150 : 0,
            );
        }
    };
}
