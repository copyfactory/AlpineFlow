# Alpine Flow

## About

Alpine Flow makes creating directed step based flowcharts and node based workflow UIs (DAG) in AlpineJS an easier task.

<!-- TOC -->

-   [Alpine Flow](#alpine-flow)
    -   [About](#about)
    -   [Features](#features)
    -   [Installation](#installation)
    -   [Concepts](#concepts)
        -   [What is a node?](#what-is-a-node)
        -   [What is an edge?](#what-is-an-edge)
    -   [Quickstart](#quickstart)
        -   [Building your first flow](#building-your-first-flow)
            -   [1. Create a node component](#1-create-a-node-component)
            -   [2. Create an editor](#2-create-an-editor)
            -   [3. Putting it together](#3-putting-it-together)
    -   [API reference](#api-reference)
        -   [Node](#node)
            -   [Configuration](#configuration)
            -   [The `$nodes` magic](#the-nodes-magic)
        -   [flowEditor](#floweditor-)
            -   [Configuration](#configuration-1)
            -   [Methods](#methods)
                -   [editor.**hasNodes()**](#editorhasnodes)
                -   [editor.**hasNoNodes()**](#editorhasnonodes)
                -   [editor.**addNode(_incompleteNode_, _dependsOn_=null)**](#editoraddnode_incompletenode_-_dependson_null)
                -   [editor.**deleteNode(_nodeId_, _dependsOn_=null)**](#editordeletenode_nodeid_-_dependson_null)
                -   [editor.**getNodeById(_nodeId_)**](#editorgetnodebyid_nodeid_)
                -   [editor.**findParents(_nodeId_)**](#editorfindparents_nodeid_)
                -   [editor.**findChildren(_nodeId_)**](#editorfindchildren_nodeid_)
                -   [editor.**findDescendantsOfNode(_nodeId_)**](#editorfinddescendantsofnode_nodeid_)
                -   [editor.**zoomOut(_zoomStep = 1 / 1.2_)**](#editorzoomout_zoomstep--1--12_)
                -   [editor.**zoomIn(_zoomStep = 1.2_)**](#editorzoomin_zoomstep--12_)
                -   [editor.**setViewportToCenter(_paddingY = 0.1, paddingX = 0.3_)**](#editorsetviewporttocenter_paddingy--01-paddingx--03_)
                -   [editor.**setViewport(_x=0, y=0, zoom=1_)**](#editorsetviewport_x0-y0-zoom1_)
                -   [editor.**toObject()**](#editortoobject)
    -   [Events](#events)
        -   [`@flow-init.window`](#flow-initwindow)
        -   [`@flow-nodes-updated.window`](#flow-nodes-updatedwindow)
        -   [`@flow-nodes-deleted.window`](#flow-nodes-deletedwindow)
    -   [Dependencies](#dependencies)
    <!-- TOC -->

## Features

1. Easy and familiar syntax well integrated with Alpine.js.
2. Automatic handling of layout and arrow drawing.
3. Full styling control across background, nodes, edges and toolbar. Use Tailwind, CSS or anything you want.
4. Built-in zooming, panning and dragging.
5. Pre-built toolbar component.
6. Methods to delete nodes, add nodes and traverse your workflow.
7. Configurable node settings to allow/disallow deleting, branching and children access.
8. Custom events to hook-into.

## Installation

**via cdn**

```html
<link
    href="https://unpkg.com/@copyfactory/alpine-flow@latest/dist/flow.css"
    rel="stylesheet"
    type="text/css"
/>
<script
    defer
    src="https://unpkg.com/@copyfactory/alpine-flow@latest/dist/alpine-flow.cdn.min.js"
></script>
```

**via npm**

```bash
npm i @copyfactory/alpine-flow
```

## Concepts

### What is a node?

A node in Alpine Flow is an alpine component with the `x-node` directive.
That means it can render anything you like. You can find all the options for customizing your nodes further down.
The term 'node' and 'component' will be used interchangeably.

### What is an edge?

An edge connects two nodes. Every edge needs a target node ID and a source node ID.
The the most part edges addition and removal will be handled for you when using the public methods.

## Quickstart

The Alpine flow package is composed of a directive to declare components `x-node`
and a data component `flowEditor` to start a new editor.

The `flowEditor` only requires nodes and edges to get something going.

### Building your first flow

#### 1. Create a node component

Nodes are the building blocks of your editor. Building them is easy. Just add the `x-node` directive
to any Alpine component with a `type` and add a `props` object to your `x-data`.

The `props` is automatically synced to any node instances `data` attribute.

Think of the `props` as being all the attributes you want to persist to your database.

Consider the following example for a node where we want to apply styling based on some state.

When saving this node we likely don't want to save the 'isClicked' attribute.

Having a clear namespace for properties that should be persisted to each node instance
makes it easy to separate styling and data.

```html
<div
    x-cloak
    x-node="{type: 'my first node'}"
    x-data="{isClicked: false, props: {text: 'Default text'}}"
    @click="
        props.text = (Math.random() + 1).toString(36).substring(7);
        isClicked = !isClicked"
>
    <div>
        <p :style="isClicked && { color: 'green' }" x-text="props.text"></p>
    </div>
</div>
```

By declaring a `x-node` the element is registered as a component in the registry under the name 'my first node'.

As you can see this is pure Alpine so `@click` and all other directives/magics will work.

The `@click` here just sets the text to a random 7 character string and changes the color of the text.

It's also worth mentioning that re-usable components work as well:

```html
<div
    x-cloak
    x-node="{type: 'my first node'}"
    @click="handleClick"
    x-data="myFirstNode"
>
    <div>
        <p :style="isClicked && { color: 'green' }" x-text="props.text"></p>
    </div>
</div>

<script>
    document.addEventListener('alpine:init', () => {
        Alpine.data('myFirstNode', () => ({
            isClicked: false,
            props: { text: 'Default text' },

            handleClick() {
                this.props.text = (Math.random() + 1).toString(36).substring(7);
                this.isClicked = !this.isClicked;
            },
        }));
    });
</script>
```

#### 2. Create an editor

Creating an editor is easy, just set the x-data to `flowEditor` on an element.

There are many initial parameters you can provide which will be outlined below.

The `flowEditor` will take up the full width and height of the element it was placed on.

```html
<div x-data="flowEditor" style="width:500px;height:500px"></div>
```

#### 3. Putting it together

Here is the full example alone with a live rendering of the editor output.

Notice how when you drag or zoom, the viewport updates in real-time?

Finally, clicking on our node will update it's text, reposition the graph as well as update
the output.

```html
<!doctype html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta
            name="viewport"
            content="width=device-width, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0"
        />
        <meta http-equiv="X-UA-Compatible" content="ie=edge" />
        <title>Alpine flow basic example</title>
        <link
            href="https://unpkg.com/@copyfactory/alpine-flow@latest/dist/flow.css"
            rel="stylesheet"
            type="text/css"
        />
        <script
            defer
            src="https://unpkg.com/@copyfactory/alpine-flow@latest/dist/alpine-flow.cdn.min.js"
        ></script>
        <script
            defer
            src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js"
        ></script>
    </head>
    <body>
        <div
            x-cloak
            x-node="{type: 'my first node'}"
            x-data="{isClicked: false, props: {text: 'Default text'}}"
            @click="
        props.text = (Math.random() + 1).toString(36).substring(7);
        isClicked = !isClicked"
        >
            <div>
                <p
                    :style="isClicked && { color: 'green' }"
                    x-text="props.text"
                ></p>
            </div>
        </div>

        <div
            x-data="{
        liveEditor: null,
        node1: {id: 1, type: 'my first node'},
        node2: {id: 2, type: 'my first node'},
    }"
            style="display: flex;"
        >
            <div style="flex: 1;">
                <div
                    x-init="liveEditor=editor"
                    x-data="editor = flowEditor({
                nodes: [node1, node2],
                edges: [{source: node1.id, target: node2.id}]
            })"
                    style="width:500px;height:500px"
                ></div>
            </div>
            <div style="flex: 1;">
                <h6>Live output</h6>
                <pre
                    x-text="JSON.stringify(liveEditor.toObject(),null,2)"
                ></pre>
            </div>
        </div>
    </body>
</html>
```

Done! You have just created an interactive and reactive flowchart using pure Alpine.

## API reference

### Node

#### Configuration

Below are the available config options and defaults when registering a new `Node`.

The `type` is required and must be unique as we register the Node under that name.

When a new `x-node` is declared your component has access to a `node` object which contains the nodeId, it's data and
the node config.

| Name           | Type      | Description                                                  | Default |
| -------------- | --------- | ------------------------------------------------------------ | ------- | --- | --- |
| type           | `String`  | The name of the registered Node.                             |         |
| deletable      | `Boolean` | True/False for if this node type can be deleted.             | `true`  |
| allowBranching | `Boolean` | True/False for if this node type can have multiple children. | `false` |     |     |
| allowChildren  | `Boolean` | True/False for if this node type can have children.          | `true`  |

**Example usage**

Here is an example node structure with the default configuration.

> Don't register an `x-init` directive on the same div as the registered `x-node` as this will get overridden.

> Best practice is to add an `x-ignore` directive to the first child so that Alpine doesn't crawl it.
> All `x-ignore` directives are removed when rendering a new node instance.

```html
<div
    x-data="{isOpen: false, props: {}}"
    x-cloak
    x-node="{type: 'myNode', deletable: true, allowBranching: false, allowChildren: true}"
>
    <!--  Prevent crawling of the node  -->
    <div x-ignore>
        <div x-init="console.log(node.id)"></div>
    </div>
</div>
```

#### The `$nodes` magic

A `$nodes` magic is also exposed should you want to know what the registered nodes currently are.

The `$nodes` magic returns an object where the keys are the registry
names and the values an object of the registered node Element and it's config.

By default all `x-node` are registered in the `default` registry. You can specify which registries your nodes belong to
by adding a modifier.

```html
<div x-node.customRegistryName="{type: 'myNode'}"></div>

<div
    x-data="editor = flowEditor({
        nodeTypes: $nodes.customRegistryName,
        // more config
})"
></div>
```

---

### flowEditor

#### Configuration

Below are the available config options and defaults when initializing a new `flowEditor`.

| Name              | Type      | Description                                                                                                | Default           |
| ----------------- | --------- | ---------------------------------------------------------------------------------------------------------- | ----------------- |
| nodeTypes         | `Object`  | The types of nodes available in the editor. The default is to use the components registered with `x-node`. | `$nodes.default`  |
| nodes             | `Array`   | The initial nodes to populate the editor.                                                                  | []                |
| edges             | `Array`   | The initial edges to populate the editor.                                                                  | []                |
| viewport          | `Object`  | The viewport positioning to set                                                                            | {x:0, y:0,zoom:1} |
| zoomOnWheelScroll | `Boolean` | Whether to enable zooming on wheel scroll. The default is to panOnScroll.                                  | false             |
| zoomOnPinch       | `Boolean` | Whether to enable zooming on pinch gestures                                                                | true              |
| panOnScroll       | `Boolean` | Whether to enable panning on scroll                                                                        | true              |
| panOnScrollSpeed  | `Number`  | The speed of panning on scroll                                                                             | 0.5               |
| panOnDrag         | `Boolean` | Whether to enable panning on drag                                                                          | true              |
| minZoom           | `Number`  | The minimum allowed zoom level                                                                             | 0.5               |
| maxZoom           | `Number`  | The maximum allowed zoom level                                                                             | 2                 |
| zoomDuration      | `Number`  | The duration of zoom animation in milliseconds.                                                            | 100               |
| toolbarClasses    | `String`  | The CSS classes to add to the toolbar.                                                                     | 'bottom left'     |
| toolbarBtnClasses | `String`  | The CSS classes to add to the toolbar buttons.                                                             | ''                |
| backgroundClasses | `String`  | The CSS classes for the background.                                                                        | 'dots'            |

**Example usage**

```html
<div
    x-data="editor = flowEditor({
        nodes: [{id: 1, type: 'myCustomNode', data: {foo: 'bar'}}],
        minZoom: 1,
        maxZoom: 2,
        // more config
})"
></div>
```

#### Methods

Below are the public methods for using the `flowEditor`.

---

##### editor.**hasNodes()**

**Returns:**

-   (`boolean`): Returns `true` if the editor has nodes, otherwise `false`.

**Example:**

```javascript
editor.hasNodes();
```

---

##### editor.**hasNoNodes()**

Returns `true` if the editor has no nodes, otherwise `false`.

**Example:**

```javascript
editor.hasNoNodes();
```

---

##### editor.**addNode(_incompleteNode_, _dependsOn_=null)**

Adds a node to the flow editor.

**Parameters:**

-   `incompleteNode` (`Object`): The incomplete node to be added.
-   `dependsOn` (`Array|null`, optional): The node IDs on which the new node depends. Defaults to `null`.

**Example:**

```javascript
let newNode = {
    id: 'my-node-id',
    type: 'myNode',
    data: { foo: 'bar' },
};

editor.addNode(newNode, [anotherNode.id]);
```

---

##### editor.**deleteNode(_nodeId_, _dependsOn_=null)**

Delete a node from the graph along with its edges.

**Parameters:**

-   `nodeId` (`string`): The ID of the node.
-   `strategy` (`string`): `preserve` (the default) tries to keep as many nodes as possible while deleting. `all` removes all descendants of the input node.

**Example:**

```javascript
// Suppose you had a graph of nodes: '1 -> 2 -> 3'
editor.deleteNode('2', 'preserve');
// by deleting node 2 the new nodes would be: '1 -> 3' since we can repoint node '1' to node '3'.

editor.deleteNode('2', 'all');
// would delete all dependents on 2 onwards.
// by deleting node 2 the new nodes would be: '1' since we delete node '2' and all dependants on node '2' (node '3') in this case.
```

---

##### editor.**getNodeById(_nodeId_)**

Gets a node by its ID.

**Parameters:**

-   `nodeId` (`string`): The ID of the node.

**Returns:**

-   (`Node|null`): The node with the given ID, or `null` if not found.

**Example:**

```javascript
let myNode = editor.getNodeById('my-node-id');
console.log(myNode);
```

---

##### editor.**findParents(_nodeId_)**

Get the parent nodes of a given nodeId.

**Parameters:**

-   `nodeId` (`string`): The ID of the node.

**Returns:**

-   (`Array`): An array of nodes.

**Example:**

```javascript
let nodes = editor.findParents('my-node-id');
console.log(nodes);
```

---

##### editor.**findChildren(_nodeId_)**

Get the children nodes of a given nodeId.

**Parameters:**

-   `nodeId` (`string`): The ID of the node.

**Returns:**

-   (`Array`): An array of nodes.

**Example:**

```javascript
let nodes = editor.findChildren('my-node-id');
console.log(nodes);
```

---

##### editor.**findDescendantsOfNode(_nodeId_)**

Recursively searches nodes for all descendents of a given nodeId.

**Parameters:**

-   `nodeId` (`string`): The ID of the node.

**Returns:**

-   (`Array`): An array of nodeIds.

**Example:**

```javascript
let nodeIds = editor.findDescendantsOfNode('my-node-id');
console.log(nodes);
```

---

##### editor.**zoomOut(_zoomStep = 1 / 1.2_)**

Zooms out the viewport.

**Parameters:**

-   `zoomStep` (`number`, optional): The factor to zoom out. Defaults to `1 / 1.2`.

**Example:**

```javascript
editor.zoomOut();
```

---

##### editor.**zoomIn(_zoomStep = 1.2_)**

Zooms in the viewport.

**Parameters:**

-   `zoomStep` (`number`, optional): The factor to zoom in. Defaults to `1.2`.

**Example:**

```javascript
editor.zoomIn();
```

---

##### editor.**setViewportToCenter(_paddingY = 0.1, paddingX = 0.3_)**

Sets the viewport of the canvas to center the content so that all nodes are in view.

**Parameters:**

-   `paddingY` (`number`, optional): The vertical padding as a percentage of canvas height. Defaults to `0.1`.
-   `paddingX` (`number`, optional): The horizontal padding as a fraction of canvas width. Defaults to `0.3`.

**Returns:**

-   (`Object`): The plain object representation of the viewport.

**Example:**

```javascript
editor.setViewportToCenter();
```

---

##### editor.**setViewport(_x=0, y=0, zoom=1_)**

Sets the viewport based on X/Y and zoom level.

**Parameters:**

-   `x` (`number`, optional): The new X. Defaults to `0`.
-   `y` (`number`, optional): The new Y. Defaults to `0`.
-   `zoom` (`number`, optional): The new zoom. Defaults to `1`.

**Returns:**

-   (`Object`): The plain object representation of the viewport.

**Example:**

```javascript
editor.setViewPort(100, 100, 1.5);
```

---

##### editor.**toObject()**

Converts the flow editor to a plain object to save to the DB.

**Returns:**

-   (`Object`): The nodes, edges and viewport.

**Example:**

```javascript
let flowObject = editor.toObject();
console.log(flowObject);
// {
//   nodes: [];
//   edges: [];
//   viewport: {};
// };

let newEditor = flowEditor(flowObject);
```

---

## Events

You can hook into events using the normal Alpine syntax of `@event-name`.

All events emitted by Alpine Flow will have the prefix `flo-`.

---

### `@flow-init.window`

Dispatched when the editor has finished its first load.

**Event detail**

```js
event = $event.detail;
console.log(event);
// {data: true}
```

---

### `@flow-nodes-updated.window`

Dispatched when the nodes have been modified.

**Event detail**

```js
event = $event.detail;
console.log(event);
// {data: [{id: 1, type: 'myNode', data: {}...}]}
```

---

### `@flow-nodes-deleted.window`

Dispatched when nodes have been deleted.

**Event detail**

```js
event = $event.detail;
console.log(event);
// {data: [deletedNodeId1, deletedNodeId2]}
```

---

## Dependencies

Alpine flow depends on the following:

1. [Dagre](https://github.com/dagrejs/dagre) - For node layout and positioning.
2. [D3-Zoom](https://github.com/d3/d3-zoom) - For zooming and panning the editor.
