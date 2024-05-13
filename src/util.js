
/**
 * Clamps a value between a minimum and maximum.
 * @param {number} val - The value to clamp.
 * @param {number} [min=0] - The minimum value.
 * @param {number} [max=1] - The maximum value.
 * @returns {number} - The clamped value.
 */
export const clamp = (val, min = 0, max = 1) => Math.min(Math.max(val, min), max);


/**
 * Gets the first item of an array or returns null if the array is empty.
 * @param {Array} array - The input array.
 * @returns {*} - The first item of the array or null if the array is empty.
 */
export function getFirstItemOrNull(array){
    if (!array){
        return null
    }
    return array[0]
}


/**
 * Calculates the center and offsets of an edge.
 * @param {Object} options - The options for calculating edge center.
 * @param {number} options.sourceX - The x-coordinate of the source node.
 * @param {number} options.sourceY - The y-coordinate of the source node.
 * @param {number} options.targetX - The x-coordinate of the target node.
 * @param {number} options.targetY - The y-coordinate of the target node.
 * @returns {Array} - The center x and y coordinates, and the offsets in x and y directions.
 */
export function getEdgeCenter({
  sourceX,
  sourceY,
  targetX,
  targetY,
}) {
  const xOffset = Math.abs(targetX - sourceX) / 2;
  const centerX = targetX < sourceX ? targetX + xOffset : targetX - xOffset;

  const yOffset = Math.abs(targetY - sourceY) / 2;
  const centerY = targetY < sourceY ? targetY + yOffset : targetY - yOffset;

  return [centerX, centerY, xOffset, yOffset];
}
