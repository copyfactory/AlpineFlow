import { getCompleteNode } from './node';
import { getFirstItemOrNull } from './util';
import * as dagre from '@dagrejs/dagre';
import { getSmoothStepPath, Position } from './edges/smooth-edge';
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
 * @property {Object} [dagreConfig={rankdir:'TB', nodesep:50, ranksep:50}] - The config to use with Dagre.
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
    const dagreConfig = {
        rankdir: 'TB',
        nodesep: 50,
        ranksep: 50,
    };
    const defaultConfig = {
        dagreConfig,
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
        transformationQueue: [],
        callbackQueue: [],
        debouncedLayoutGraph: null,
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

        // Node lookup for doing {nodeId: {nodeId: '': type: ''...} }
        lastGraphState: { nodes: [], edges: [], graph: null },
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
            this._layoutGraph = this._layoutGraph.bind(this);
            this.debouncedLayoutGraph = Alpine.debounce(this._layoutGraph, 25);
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
        },

        _setupPanZoom() {
            let viewportEle = this.$refs.viewportEle;
            this.panZoomInstance = this.setupPanZoomInstance(viewportEle);
        },
        enqueueTransformation(transformationFunction, callback) {
            this.transformationQueue.push(transformationFunction);
            if (callback) {
                this.callbackQueue.push(callback);
            }
            this._processQueue();
        },

        _processQueue() {
            this.$nextTick(() => {
                const state = {
                    nodes: [...this.nodes],
                    edges: [...this.edges],
                };
                while (this.transformationQueue.length > 0) {
                    const transformationFunction =
                        this.transformationQueue.shift();
                    transformationFunction(state);
                }

                while (this.callbackQueue.length > 0) {
                    const callback = this.callbackQueue.shift();
                    callback(state);
                }
                this.nodes = state.nodes;
                this.edges = state.edges;
                this.layoutGraph();
                if (!this.hasInit) {
                    this.hasInit = true;
                    this.dispatchEvent('init', { data: true });
                }
            });
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
            let parents = this.buildDagre()
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
            let children = this.buildDagre()
                .outEdges(nodeId)
                .map((edge) => edge.w);
            if (children) {
                return children.map((nodeId) => this.getNodeById(nodeId));
            }
            return [];
        },

        hasChildren(nodeId) {
            return this.buildDagre().outEdges(nodeId).length > 0;
        },

        /**
         * Get a Node with all properties needed to add to editor.
         * This is handled for you when using public APIs but is useful to create custom logic.
         * @param {Object} incompleteNode - The incomplete node to be added.
         */
        createNode(incompleteNode) {
            return getCompleteNode(incompleteNode);
        },
        /**
         * Get an Edge with all properties needed to add to editor.
         * This is handled for you when using public APIs but is useful to create custom logic.
         * @param {Object} incompleteEdge - The incomplete node to be added.
         */
        createEdge(incompleteEdge) {
            return getCompleteEdge(incompleteEdge);
        },
        /**
         * Adds a node to the flow editor.
         * @param {Object} incompleteNode - The incomplete node to be added.
         * @param {Array|null} dependsOn - The nodes on which the new node depends.
         * @param callback
         */
        addNode(incompleteNode, dependsOn = [], callback = null) {
            this.enqueueTransformation((state) => {
                const { type } = incompleteNode;

                if (!this.nodeTypes.hasOwnProperty(type)) {
                    console.warn(`'${type}' does not exist in the registry.`);
                    return;
                }

                const nodeConfig = this.getNodeConfig(type);
                const completeNode = getCompleteNode({
                    ...nodeConfig,
                    ...incompleteNode,
                });

                if (dependsOn.length === 1) {
                    const depNodeId = dependsOn[0];
                    const node = state.nodes.find(({ id }) => id === depNodeId);

                    if (node) {
                        const latestGraph = this.buildDagre(
                            state.nodes,
                            state.edges,
                        );
                        const hasOutEdges =
                            latestGraph.outEdges(node.id).length > 0;

                        if (
                            !node.allowChildren ||
                            (!node.allowBranching && hasOutEdges)
                        ) {
                            const successors =
                                latestGraph.successors(depNodeId);
                            const adjustedEdges = successors.map((child) => {
                                state.edges = state.edges.filter(
                                    ({ target }) => target !== child,
                                );
                                return getCompleteEdge({
                                    source: completeNode.id,
                                    target: child,
                                });
                            });

                            adjustedEdges.push(
                                getCompleteEdge({
                                    source: depNodeId,
                                    target: completeNode.id,
                                }),
                            );
                            state.nodes.push(completeNode);
                            state.edges.push(...adjustedEdges);
                            return;
                        }
                    }
                }

                const newEdges = dependsOn.map((depNodeId) =>
                    getCompleteEdge({
                        source: depNodeId,
                        target: completeNode.id,
                    }),
                );
                state.nodes.push(completeNode);
                state.edges.push(...newEdges);
            }, callback);
        },
        /**
         * Recursively searches the graph for ancestors of a given nodeId.
         * @param {string} nodeId - The nodeId.
         * @return {Array} - List of node IDs.
         */
        findAncestorsOfNode(nodeId) {
            const ancestors = new Set();
            const visited = new Set();
            const stack = [nodeId];
            while (stack.length > 0) {
                const currentId = stack.pop();
                const parents = this.buildDagre().predecessors(currentId);
                if (parents) {
                    parents.forEach((parent) => {
                        if (!visited.has(parent)) {
                            visited.add(parent);
                            ancestors.add(parent);
                            stack.push(parent);
                        }
                    });
                }
            }
            return Array.from(ancestors);
        },
        /**
         * Recursively searches the editor for descendents of a given nodeId.
         * @param {string} nodeId - The nodeId.
         * @return {Array} - List of node IDs.
         */
        findDescendantsOfNode(nodeId) {
            const descendants = new Set();
            const visited = new Set();
            const queue = [nodeId];

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
            let childrenOfNode = this.buildDagre()
                .outEdges(completeNode.id)
                .map((edge) => edge.w);
            let deletedNodes = new Set([completeNode.id]);
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
                    this.findDescendantsOfNode(completeNode.id).forEach(
                        (nodeId) => deletedNodes.add(nodeId),
                    );
                }
            }
            // if not preserve we remove all descendants.
            else {
                this.findDescendantsOfNode(completeNode.id).forEach((nodeId) =>
                    deletedNodes.add(nodeId),
                );
            }

            this.enqueueTransformation((state) => {
                state.nodes = state.nodes.filter(
                    (node) => !deletedNodes.has(node.id),
                );
                state.edges = state.edges.filter(
                    (edge) =>
                        !deletedNodes.has(edge.source) &&
                        !deletedNodes.has(edge.target),
                );
            });

            this.edgesWithPath = [];
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
                    transform: 'translate(' + node.position.x + 'px, ' + node.position.y + 'px)',
                    opacity: node.positionComputed ? '100': '0'
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
                    dispatchEvent('new-node-rendered', {data: node.id})
                });
                setupResizeObserver(node, $el)
                $watch('props', value => {
                    node.data = value; 
                });
            `,
            );
            return clonedNodeEle.outerHTML;
        },

        setupResizeObserver(node, ele) {
            let observer = new ResizeObserver((entries) => {
                node.setComputedWidthHeight(ele);
                this.layoutGraph();
            });
            observer.observe(ele);
        },
        /**
         * Builds the graph using the Dagre layout.
         * @returns {Object} - The constructed graph.
         */
        buildDagre(nodes = null, edges = null) {
            if (!nodes) {
                nodes = this.nodes;
            }
            if (!edges) {
                edges = this.edges;
            }
            if (this.lastGraphState.nodes === nodes && this.lastGraphState.edges === edges) {
                return this.lastGraphState.graph;
            }
            const g = new dagre.graphlib.Graph()
                .setGraph(this.dagreConfig)
                .setDefaultEdgeLabel(() => ({}));
            nodes.forEach((node) => {
                g.setNode(node.id, node);
            });

            edges.forEach((edge) => g.setEdge(edge.source, edge.target));

            dagre.layout(g);
            this.lastGraphState = {
                nodes: nodes,
                edges: edges,
                graph: g,
            };
            return g;
        },

        /**
         * Layouts the graph based on the current state and renders the diagram.
         */
        layoutGraph() {
            this.debouncedLayoutGraph();
        },
        _updateNodePosition(node, g) {
            const { x, y } = g.node(node.id);
            const { width, height } = node;
            node.positionComputed = true;
            node.position = {
                x: x - width / 2,
                y: y - height / 2,
            };
        },
        _layoutGraph() {
            let g = this.buildDagre();
            if (!g) {
                return;
            }
            let { width, height } = g.graph();
            this.width = width;
            this.height = height;

            this.nodes.forEach((node) => {
                let currentNode = this.getNodeById(node.id);
                this._updateNodePosition(currentNode, g);
            });

            this.edgesWithPath = this.edges.map((edge) => {
                let source = this.getNodeById(edge.source);
                let target = this.getNodeById(edge.target);
                const positionMap = {
                    TB: {
                        sourceX: source.x,
                        sourceY: source.y + source.height / 2,
                        targetX: target.x,
                        targetY: target.y - target.height / 2,
                        sourcePosition: Position.Bottom,
                        targetPosition: Position.Top,
                    },
                    BT: {
                        sourceX: source.x,
                        sourceY: source.y - source.height / 2,
                        targetX: target.x,
                        targetY: target.y + target.height / 2,
                        sourcePosition: Position.Top,
                        targetPosition: Position.Bottom,
                    },
                    LR: {
                        sourceX: source.x + source.width / 2,
                        sourceY: source.y,
                        targetX: target.x - target.width / 2,
                        targetY: target.y,
                        sourcePosition: Position.Right,
                        targetPosition: Position.Left,
                    },
                    RL: {
                        sourceX: source.x - source.width / 2,
                        sourceY: source.y,
                        targetX: target.x + target.width / 2,
                        targetY: target.y,
                        sourcePosition: Position.Left,
                        targetPosition: Position.Right,
                    },
                };
                const rankConfig =
                    positionMap[this.dagreConfig?.rankdir] || positionMap.TB;
                const [path, labelX, labelY, offsetX, offsetY] =
                    getSmoothStepPath(rankConfig);
                return { edge: edge, path: path };
            });
            return g;
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
