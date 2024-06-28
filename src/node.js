/**
 * Converts an element to a Node to be used in the diagram. Attaches state properties.
 * @param {Object} currentNodeData - The data representing the current node.
 * @param {string} [currentNodeData.id=null] - The ID of the node.
 * @param {Object} [currentNodeData.data={}] - Additional data associated with the node.
 * @param {Object} [currentNodeData.position={x: 0, y: 0}] - The position of the node.
 * @param {string} [currentNodeData.type=''] - The type of the node.
 * @param {boolean} [currentNodeData.selected=false] - Indicates whether the node is selected.
 * @param {boolean} [currentNodeData.selectable=true] - Indicates whether the node is selectable.
 * @param {boolean} [currentNodeData.deletable=true] - Indicates whether the node is deletable.
 * @param {boolean} [currentNodeData.allowBranching=true] - Indicates whether the node allows branching.
 * @param {boolean} [currentNodeData.allowChildren=true] - Indicates whether the node allows children nodes.
 * @param {string} [currentNodeData.className=''] - The CSS class name of the node.
 * @param {number} [currentNodeData.width=0] - The width of the node.
 * @param {number} [currentNodeData.height=0] - The height of the node.
 * @returns {Object} - The complete node object with attached state properties.
 */
export function getCompleteNode(currentNodeData) {
    let newNode = Alpine.reactive({
        id: null,
        data: {},
        position: { x: 0, y: 0 },
        type: '',
        positionComputed: false,
        selected: false,
        selectable: true,
        deletable: true,
        allowBranching: false,
        allowChildren: true,
        width: 0,
        height: 0,
        ...currentNodeData,

        /**
         * Sets the computed width and height of the node.
         * @param {HTMLElement} ele - The element representing the node.
         */
        setComputedWidthHeight(ele) {
            let styles = window.getComputedStyle(ele);
            this.width = parseFloat(styles.width);
            this.height = parseFloat(styles.height);
        },
        toObject() {
            return {
                id: this.id,
                data: this.data,
                type: this.type,
                position: this.position,
                selected: this.selected,
                selectable: this.selectable,
                deletable: this.deletable,
                allowChildren: this.allowChildren,
                allowBranching: this.allowBranching,
                width: this.width,
                height: this.height,
            };
        },
    });
    newNode.id = newNode.id.toString();
    newNode.positionComputed = false
    return newNode;
}

const nodeRegistry = { default: {} };

export const node = (Alpine) => {
    Alpine.directive(
        'node',
        (el, { value, expression, modifiers }, { evaluate }) => {
            if (!expression) {
                console.warn(
                    'Node not registered due to missing config. Modify to `x-node="{type: myNodeName}"`',
                );
                return;
            }
            let nodeConfig = evaluate(expression);

            if ((!'type') in nodeConfig) {
                console.warn(
                    'Node not registered due to missing name. Modify to `x-node="{type: myNodeName}"`',
                );
                return;
            }
            el.setAttribute('x-ignore', true);
            el.removeAttribute('x-node');

            if (!modifiers.length) {
                modifiers.push('default');
            }
            modifiers.forEach((registryName) => {
                if (!nodeRegistry.hasOwnProperty(registryName)) {
                    nodeRegistry[registryName] = {};
                }
                nodeRegistry[registryName][nodeConfig.type] = {
                    ele: el,
                    nodeConfig: nodeConfig,
                };
            });
            el.remove();
        },
    ).before('ignore');

    Alpine.magic('nodes', (el, { Alpine }) => {
        return nodeRegistry;
    });
};
