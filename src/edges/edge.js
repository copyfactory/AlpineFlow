
/**
 * Converts an edge data to a complete edge with necessary properties for tracking and rendering.
 * @param {Object} currentEdgeData - The data representing the current edge.
 * @param {string} [currentEdgeData.id=null] - The ID of the edge.
 * @param {string} [currentEdgeData.type='default'] - The type of the edge.
 * @param {string} [currentEdgeData.source=''] - The source node ID of the edge.
 * @param {string} [currentEdgeData.target=''] - The target node ID of the edge.
 * @param {boolean} [currentEdgeData.animated=false] - Indicates whether the edge is animated.
 * @param {string} [currentEdgeData.className=''] - The CSS class name of the edge.
 * @param {string} [currentEdgeData.markerEnd='arrow'] - The marker at the end of the edge.
 * @param {string|null} [currentEdgeData.markerStart=null] - The marker at the start of the edge.
 * @returns {Object} - The complete edge object with attached state properties.
 */
export function getCompleteEdge(currentEdgeData){
    // Returns a complete node with all props needed to track and render elements.
    let edge = Alpine.reactive({
        id: null,
        type: 'default',
        source:'',
        target: '',
        animated: false,

        className: '',
        markerEnd: 'arrow',
        markerStart: null,

        ...currentEdgeData,
        toObject(){
            return {
                id: this.id,
                type: this.type,
                source: this.source,
                target: this.target,
                animated: this.animated,
                className: this.className,
            }
        }
    })
    if (!edge.id){
        edge.id = `${edge.source}.${edge.target}`
    }
    else {
        edge.id = edge.id.toString()
    }
    return edge
}
