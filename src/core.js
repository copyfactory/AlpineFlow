import { getCompleteNode } from './node';
import { getFirstItemOrNull } from './util';
import * as dagre from '@dagrejs/dagre';
import { getSmoothStepPath } from './edges/smooth-edge';
import { getCompleteEdge } from './edges/edge';
import { injectCanvasToEle } from './canvas-html';
import { panZoomManager } from './viewport/viewport-manager';
import { PanOnScrollMode } from './viewport/events';

/**
 * Represents the parameters for initializing the flow editor.
 * @typedef {Object} FlowEditorParams
 * @property {Object} [nodeTypes=null] - The types of nodes available in the editor.
 * @property {Array} [nodes=[]] - The initial nodes to populate the editor.
 * @property {Array} [edges=[]] - The initial edges to populate the editor.
 * @property {Object} [viewport={x:0, y:0,zoom:1}] - The viewport positioning to set.
 * @property {boolean} [zoomOnWheelScroll=false] - Whether to enable zooming on wheel scroll.
 * @property {boolean} [zoomOnPinch=true] - Whether to enable zooming on pinch gestures.
 * @property {boolean} [panOnScroll=true] - Whether to enable panning on scroll.
 * @property {number} [panOnScrollSpeed=0.5] - The speed of panning on scroll.
 * @property {boolean} [panOnDrag=true] - Whether to enable panning on drag.
 * @property {number} [minZoom=0.5] - The minimum allowed zoom level.
 * @property {number} [maxZoom=2] - The maximum allowed zoom level.
 * @property {number} [zoomDuration=100] - The duration of zoom animation in milliseconds.
 * @property {string} [toolbarClasses='bottom left'] - The CSS classes for toolbar positioning.
 * @property {string} [toolbarBtnClasses=''] - The CSS classes for the toolbar buttons.
 * @property {string} [backgroundClasses='dots'] - The CSS classes for the background.

 */

/**
 * Represents a flow editor for creating and manipulating a graph.
 * @param {FlowEditorParams} params - The parameters for initializing the flow editor.
 * @returns {Object} - The flow editor object.
 */
export function flowEditor(params) {
    /**
     * The flow editor object.
     */
    const defaultConfig = {
        nodeTypes: null,
        nodes: [],
        edges: [],
        zoomOnWheelScroll: false,
        zoomOnPinch: true,
        panOnScroll: true,
        panOnScrollSpeed: 0.5,
        panOnDrag: true,
        minZoom: 0.5,
        maxZoom: 2,
        zoomDuration: 100,
        backgroundClasses: 'dots',
        toolbarClasses: 'bottom left',
        toolbarBtnClasses: '',
    };

    const internalProps = {
        areNodesReady: false,
        hasInit: false,
        canvasPosition: { x: 0, y: 0 },
        zoom: 1,
        grabbing: false,

        // Set on Dagre layout based on nodes + edges.
        edgesWithPath: [],
        height: 0,
        width: 0,

        // These are $refs. elements that are set once the diagram is init.
        canvas: null,
        toolbar: null,
        panZoomInstance: null,
        lastGraphResult: null,

        // Node lookup for doing {nodeId: {nodeId: '': type: ''...} }
        nodeLookupCacheMap: {},
    };

    if (!params) {
        params = {};
    }
    let { viewport } = params;
    if (viewport) {
        let { x, y, zoom } = viewport;
        internalProps.canvasPosition = { x: x, y: y };
        internalProps.zoom = zoom;
    }

    const newConfig = {
        ...defaultConfig,
        ...Object.keys(defaultConfig).reduce((acc, key) => {
            if (params.hasOwnProperty(key)) {
                acc[key] = params[key];
            }
            return acc;
        }, {}),
        ...internalProps,
    };

    return {
        ...newConfig,
        /**
         * Initializes the flow editor with provided parameters.
         */
        init() {
            if (!this.nodeTypes) {
                this.nodeTypes = this.$nodes.default;
            }
            injectCanvasToEle(this.$el);

            this.nodes = this.nodes.map((incompleteNode) => {
                let nodeConfig = this.getNodeConfig(incompleteNode.type);
                incompleteNode = { ...nodeConfig, ...incompleteNode };
                return getCompleteNode(incompleteNode);
            });
            this.edges = this.edges.map((edge) => getCompleteEdge(edge));

            this.areNodesReady = true;

            this.$nextTick(() => {
                let viewportEle = this.$refs.viewportEle;
                this.panZoomInstance = this.setupPanZoomInstance(viewportEle);
                this.hasInit = true;
                this.dispatchEvent('init', { data: true });
            });
            this.$watch('nodes', (value) =>
                this.dispatchEvent('nodes-updated', { data: value }),
            );
        },

        /**
         * Dispatch events
         * @param {string} EventName - The name of the event.
         * @param {Object} data - The data you want to emmit.
         */
        dispatchEvent(EventName, data = null) {
            this.$dispatch(`flow-${EventName}`, data);
        },
        getNodeConfig(nameName) {
            return this.nodeTypes[nameName].nodeConfig;
        },
        /**
         * Checks if the flow editor has nodes.
         * @returns {boolean} - True if there are nodes, otherwise false.
         */
        hasNodes() {
            return this.nodes.length > 0;
        },

        /**
         * Checks if the flow editor has no nodes.
         * @returns {boolean} - True if there are no nodes, otherwise false.
         */
        hasNoNodes() {
            return this.nodes.length <= 0;
        },

        /**
         * Get the parent nodes of a given nodeId.
         * @returns {Array} - A list of nodes that are a parent to the give nodeId.
         */
        findParents(nodeId) {
            let parents = this.lastGraphResult
                .inEdges(nodeId)
                .map((edge) => edge.v);
            if (parents) {
                return parents.map((nodeId) => this.getNodeById(nodeId));
            }
            return [];
        },

        /**
         * Get the children nodes of a given nodeId.
         * @returns {Array} - A list of nodes that are a children to the give nodeId.
         */
        findChildren(nodeId) {
            let children = this.lastGraphResult
                .outEdges(nodeId)
                .map((edge) => edge.w);
            if (children) {
                return children.map((nodeId) => this.getNodeById(nodeId));
            }
            return [];
        },

        hasChildren(nodeId) {
            return this.lastGraphResult.outEdges(nodeId).length > 0;
        },
        /**
         * Checks if node can be added based on the node config and provided node relationship.
         * @param {Object} completeNode - The node to check.
         * @param {Array|null} dependsOn - The nodes on which the new node depends.
         * @returns {boolean} - True if the node can be added, False otherwise.
         */
        canAddNode(completeNode, dependsOn) {
            if (!dependsOn) return true;
            for (const nodeId of dependsOn) {
                const node = this.getNodeById(nodeId);
                if (
                    !node ||
                    node.allowChildren === false ||
                    (!node.allowBranching &&
                        this.findChildren(nodeId).length > 0)
                ) {
                    return false;
                }
            }
            return true;
        },
        /**
         * Adds a node to the flow editor.
         * @param {Object} incompleteNode - The incomplete node to be added.
         * @param {Array|null} dependsOn - The nodes on which the new node depends.
         */
        addNode(incompleteNode, dependsOn = null) {
            if (!this.nodeTypes.hasOwnProperty(incompleteNode.type)) {
                console.warn(
                    `'${incompleteNode.type}' does not exists in the registry.`,
                );
                return;
            }
            let nodeConfig = this.getNodeConfig(incompleteNode.type);
            incompleteNode = { ...nodeConfig, ...incompleteNode };
            // Allow setting of any node params
            let completeNode = getCompleteNode(incompleteNode);
            if (!this.canAddNode(completeNode, dependsOn)) {
                return;
            }

            dependsOn = dependsOn ? dependsOn : [];
            let newEdges = dependsOn.map((depNodeId) => {
                return getCompleteEdge({
                    source: depNodeId,
                    target: completeNode.id,
                });
            });
            this.nodes = this.nodes.concat([completeNode]);
            this.edges = this.edges.concat(newEdges);
        },

        /**
         * Recursively searches the editor for descendents of a given nodeId.
         * @param {string} nodeId - The nodeId.
         * @return {Array} - List of node IDs.
         */
        findDescendantsOfNode(nodeId) {
            const descendants = new Set();
            const visited = new Set();
            const queue = [nodeId]; // Use a queue for BFS traversal

            visited.add(nodeId);

            while (queue.length > 0) {
                const currentId = queue.shift();
                const children = this.edges.filter(
                    (edge) => edge.source === currentId,
                );

                children.forEach((child) => {
                    descendants.add(child.target);
                    if (!visited.has(child.target)) {
                        visited.add(child.target);
                        queue.push(child.target);
                    }
                });
            }

            return Array.from(descendants);
        },
        /**
         * Deletes a node from the flow editor.
         * @param {Object} completeNode - The complete node to be deleted.
         * @param {string} [strategy='preserve'] - `preserve` tries to
         * keep as many nodes as possible while deleting. `all` removes all descendants of the input node.
         */
        deleteNode(completeNode, strategy = 'preserve') {
            if (!completeNode.deletable) {
                return;
            }
            const strategyOptions = ['preserve', 'all'];
            if (!strategyOptions.includes(strategy)) {
                return [];
            }
            let childrenOfNode = this.lastGraphResult
                .outEdges(completeNode.id)
                .map((edge) => edge.w);

            let deletedNodes = [completeNode.id];

            // if preserve set the next child to being new target.
            if (strategy === 'preserve') {
                if (childrenOfNode.length === 1) {
                    let matchingEdge = getFirstItemOrNull(
                        this.edges.filter(
                            (edge) => edge.target === completeNode.id,
                        ),
                    );
                    if (matchingEdge) {
                        matchingEdge.target = childrenOfNode[0];
                    }
                }
                if (childrenOfNode.length > 1) {
                    deletedNodes = deletedNodes.concat(
                        this.findDescendantsOfNode(completeNode.id),
                    );
                }
            }
            // if not preserve we remove all descendants.
            else {
                deletedNodes = deletedNodes.concat(
                    this.findDescendantsOfNode(completeNode.id),
                );
            }

            // Cleanup edges.
            this.nodes = this.nodes.filter(
                (node) => !deletedNodes.includes(node.id),
            );
            this.edges = this.edges.filter(
                (edge) => !deletedNodes.includes(edge.source),
            );
            this.edges = this.edges.filter(
                (edge) => !deletedNodes.includes(edge.target),
            );
            this.edgesWithPath = [];
            this.layoutGraph();
            this.dispatchEvent('nodes-deleted', {
                data: Array.from(deletedNodes),
            });
        },

        /**
         * Gets a node by its ID.
         * @param {string} nodeId - The ID of the node.
         * @returns {Object|null} - The node with the given ID, or null if not found.
         */
        getNodeById(nodeId) {
            if (this.nodeLookupCacheMap.hasOwnProperty(nodeId)) {
                return this.nodeLookupCacheMap[nodeId];
            }
            let item = getFirstItemOrNull(
                this.nodes.filter((node) => node.id === nodeId),
            );
            if (item) {
                this.nodeLookupCacheMap[nodeId] = item;
            }
            return item;
        },

        /**
         * Gets a cloned element type from the registry.
         * @param {Object} completeNode - The complete node to be cloned.
         * @returns {HTMLElement | null} - The cloned element.
         */
        getClonedEleTypeWithProps(completeNode) {
            let elToClone = this.nodeTypes[completeNode.type];
            if (!elToClone) {
                console.warn(`${completeNode.type} not found in registry.`);
                return null;
            }
            return elToClone.ele.cloneNode(true);
        },

        /**
         * Gets the HTML to render for a node.
         * @param {Object} completeNode - The complete node to be rendered.
         * @returns {string} - The HTML representation of the node.
         */
        getNodeHTMLToRender(completeNode) {
            // Returns a cloned Ele from the node type to render in the diagram.
            let clonedNodeEle = this.getClonedEleTypeWithProps(completeNode);
            if (!clonedNodeEle) {
                return '';
            }
            clonedNodeEle.classList.add('flow__node');
            clonedNodeEle.removeAttribute('x-ignore');
            const childrenWithXIgnore =
                clonedNodeEle.querySelectorAll('[x-ignore]');
            childrenWithXIgnore.forEach((child) => {
                child.removeAttribute('x-ignore');
            });

            clonedNodeEle.setAttribute('x-show', 'true');
            clonedNodeEle.setAttribute(
                'id',
                'flow__node_id-' + completeNode.id,
            );
            clonedNodeEle.setAttribute(':class', "node.selected && 'selected'");
            clonedNodeEle.setAttribute(
                ':style',
                `
                { 
                    transform: 'translate(' + node.position.x + 'px, ' + node.position.y + 'px)' 
                }
            `,
            );
            // Eval the template x-data that was set and merge it with the node.data value.
            clonedNodeEle.setAttribute(
                'x-init',
                `
                $nextTick(() => { 
                    node.data = {...props, ...node.data};
                    props = node.data;
                    node.setComputedWidthHeight($el); 
                    layoutGraph(); 
                });
                $watch('props', value => {
                    node.data = value; 
                    node.setComputedWidthHeight($el); 
                    layoutGraph();
                });
            `,
            );
            return clonedNodeEle.outerHTML;
        },

        /**
         * Builds the graph using the Dagre layout.
         * @returns {Object} - The constructed graph.
         */
        buildDagre() {
            let g = new dagre.graphlib.Graph();
            g.setGraph({});
            g.setDefaultEdgeLabel(function () {
                return {};
            });
            this.nodes.forEach((node) => {
                g.setNode(node.id, node);
            });

            this.edges.forEach((edge) => g.setEdge(edge.source, edge.target));

            dagre.layout(g);
            return g;
        },
        /**
         * Layouts the graph based on the current state and renders the diagram.
         */
        layoutGraph() {
            // Only render AFTER props are done doing their inner dom things.
            this.$nextTick(() => {
                let g = this.buildDagre();
                if (!g) {
                    return;
                }

                let { width, height } = g.graph();
                this.setWidthAndHeight(width, height);

                this.nodes.forEach((node) => {
                    const { x, y } = g.node(node.id);
                    const { width, height } = node;
                    this.getNodeById(node.id).position = {
                        x: x - width / 2,
                        y: y - height / 2,
                    };
                });

                this.edgesWithPath = this.edges.map((edge) => {
                    let source = this.getNodeById(edge.source);
                    let target = this.getNodeById(edge.target);
                    let sourcePos = {
                        x: source.x,
                        y: source.y + source.height / 2,
                    };
                    let targetPos = {
                        x: target.x,
                        y: target.y - target.height / 2,
                    };
                    const [path, labelX, labelY, offsetX, offsetY] =
                        getSmoothStepPath({
                            sourceX: sourcePos.x,
                            sourceY: sourcePos.y,
                            targetX: targetPos.x,
                            targetY: targetPos.y,
                        });
                    return { edge: edge, path: path };
                });
                this.lastGraphResult = g;
            });
        },
        /**
         * Sets the with and height to the canvas in order to compute various viewports.
         * This is set automatically whenever the diagram is rendered.
         *
         * @param {number} w - The new width.
         * @param {number} h - The new height.
         */
        setWidthAndHeight(w, h) {
            // we need to dispatch to the canvas-html element which sets it.
            this.dispatchEvent('set-h-w', { height: h, width: w });
        },
        /**
         * Creates the D3 instance to pan and zoom the editor.
         * @param {HTMLElement} ele - the D3 instance to pan and zoom the editor.
         */
        setupPanZoomInstance(ele) {
            let newZoom = panZoomManager({
                domNode: ele,
                minZoom: this.minZoom,
                maxZoom: this.maxZoom,
                viewport: this.getViewport(),
                onTransformChange: (transform) => {
                    if (this.hasNoNodes()) {
                        return;
                    }
                    this.canvasPosition = { x: transform[0], y: transform[1] };
                    this.zoom = transform[2];
                },
                onDraggingChange: (paneDragging) => {
                    this.grabbing = paneDragging;
                },
            });
            newZoom.update({
                zoomOnScroll: this.zoomOnWheelScroll,
                zoomOnPinch: this.zoomOnPinch,
                panOnScroll: this.panOnScroll,
                panOnScrollSpeed: this.panOnScrollSpeed,
                panOnScrollMode: PanOnScrollMode.Free,
                panOnDrag: this.panOnDrag,
                defaultViewport: { x: 0, y: 0, zoom: 1 },
                minZoom: this.minZoom,
                maxZoom: this.maxZoom,
                preventScrolling: true,
            });
            return newZoom;
        },
        /**
         * Zooms out the viewport.
         * @param {number} [zoomStep=1 / 1.2] - The factor to zoom out.
         */
        zoomOut(zoomStep = 1 / 1.2) {
            this.panZoomInstance.scaleBy(zoomStep, {
                duration: this.zoomDuration,
            });
        },

        /**
         * Zooms in the viewport.
         * @param {number} [zoomStep=1.2] - The factor to zoom in.
         */
        zoomIn(zoomStep = 1.2) {
            this.panZoomInstance.scaleBy(zoomStep, {
                duration: this.zoomDuration,
            });
        },

        /**
         * Sets the viewport of the canvas to center the content with optional padding.
         *
         * @param {number} [paddingY=0.1] - The vertical padding as a fraction of canvas height. Defaults to 0.1.
         * @param {number} [paddingX=0.3] - The horizontal padding as a fraction of canvas width. Defaults to 0.3.
         * @returns {Object} - The plain object representation of the viewport.
         */
        setViewportToCenter(paddingY = 0.1, paddingX = 0.3) {
            // Calculate the actual padding to ensure it's within [0, 1].
            let heightPadding = Math.min(paddingY, 1);
            let widthPadding = Math.min(paddingX, 1);

            // Get the dimensions of the canvas.
            let canvasRect = this.canvas.getBoundingClientRect();

            // Calculate the center of the canvas.
            let centerX = canvasRect.width / 2;
            let centerY = canvasRect.height / 2;

            // Calculate the zoom level to fit the content within the canvas with padding.
            let zoom = Math.min(
                canvasRect.width / (this.width * (1 + widthPadding)),
                canvasRect.height / (this.height * (1 + heightPadding)),
                this.maxZoom,
            );

            // Calculate the coordinates of the top-left corner of the viewport.
            let viewportX = centerX - (this.width * zoom) / 2;
            let viewportY = centerY - (this.height * zoom) / 2;

            // Set the viewport using the calculated values.
            this.panZoomInstance.setViewport({
                x: viewportX,
                y: viewportY,
                zoom: zoom,
            });
        },

        /**
         * Sets the viewport based on X/Y and zoom level.
         * @param {number} x - The new X coordinate.
         * @param {number} y - The new Y coordinate.
         * @param {number} zoom - The new zoom level.
         * @returns {Object} - The plain object representation of the viewport.
         */
        setViewPort(x = 0, y = 0, zoom = 1) {
            this.panZoomInstance.setViewport(
                { x: x, y: y, zoom: zoom },
                { duration: this.zoomDuration },
            );
            return this.getViewport();
        },
        /**
         * Gets the current viewport as an object.
         * @returns {Object} - The plain object representation of the viewport.
         */
        getViewport() {
            return {
                zoom: this.zoom,
                x: this.canvasPosition.x,
                y: this.canvasPosition.y,
            };
        },
        /**
         * Converts the flow editor object to a plain object.
         * @returns {Object} - The plain object representation of the flow editor.
         */
        toObject() {
            return {
                nodes: this.nodes.map((node) => node.toObject()),
                edges: this.edges.map((edge) => edge.toObject()),
                viewport: this.getViewport(),
            };
        },
    };
}
