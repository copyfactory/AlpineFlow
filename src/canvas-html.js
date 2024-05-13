
export const canvasHTML = `
<div x-init="canvas = $el" x-ref="canvas" class="flow">
    <div @drop.prevent
         @dragover.prevent
         @wheel.prevent
         :class="{ 'dragging': grabbing, 'grabbing': !grabbing, [backgroundClasses]: true }" 
         class="flow__background">
        <div class="flow__renderer">
            <template x-if="areNodesReady">
                
                <div :style="'height:' + height + 'px;width: ' + width + 'px;'">
                    <div @flow-set-h-w.window="height = event.detail.height;width = event.detail.width" x-ref="viewportEle" class="flow__renderer">
                        <div class="flow__viewport flow__canvas-container"
                            :style="'transform: translate(' + canvasPosition.x + 'px, ' + canvasPosition.y + 'px) scale(' + zoom + ');'" 
                        >
                            <div style="z-index: 0;" class="flow__canvas-container">
                                <template  x-for="(edge, index) in edgesWithPath" :key="edge.edge.id">
                                    <svg :width="width" :height="height"
                                         class="flow__canvas-container flow__edges">
                                        <g>
                                            <defs>
                                                <marker
                                                        id="arrow"
                                                        markerWidth="12.5"
                                                        markerHeight="12.5"
                                                        viewBox="-10 -10 20 20"
                                                        markerUnits="strokeWidth"
                                                        orient="auto-start-reverse"
                                                        refX="0"
                                                        refY="0">
                                                    <polyline
                                                            stroke-linecap="round"
                                                            stroke-linejoin="round"
                                                            fill="none"
                                                            points="-5,-4 0,0 -5,4"
                                                            style="stroke: rgb(177, 177, 183); stroke-width: 1;">
                                                    </polyline>
                                                </marker>
                                            </defs>

                                            <path :d="edge.path" fill="none"
                                                  :class="{ 'animated': edge.edge.animated }"
                                                  marker-end="url(#arrow)"
                                                  class="flow__edge-path"></path>
                                        </g>
                                    </svg>
                                </template>
                                <div class="flow__nodes">
                                    <template x-for="(node, index) in nodes" :key="node.id">
                                        <div
                                                @wheel.passive.stop
                                                @mousedown.stop
                                                @mouseup.stop
                                                @mousemove.stop
                                                >
                                            <div x-data="{nodeHtml: ''}"
                                                 @click.outside="node.selected = false;"
                                                 @click="node.selected = true;"
                                                 x-init="nodeHtml = getNodeHTMLToRender(node);"
                                            >
                                                <div x-ref="nodeContainer"
                                                     x-html="nodeHtml"></div>
                                            </div>
                                        </div>
                                    </template>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </template>
        </div>

        <div
            @mousedown.stop
            @mouseup.stop
            @mousemove.stop
            :class="toolbarClasses ? toolbarClasses: ''"
            class="flow__panel flow__toolbar" x-init="toolbar = $el">
            
                <button 
                    :class="toolbarBtnClasses ? toolbarBtnClasses: ''"
                    class="flow__toolbar__button"
                    aria-label="Zoom in"
                    @click.stop="zoomIn()" 
                    type="button" 
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                </button>
                <button
                    :class="toolbarBtnClasses ? toolbarBtnClasses: ''"
                    class="flow__toolbar__button" 
                    aria-label="Zoom out"
                    @click.stop="zoomOut()" 
                    type="button"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-minus"><path d="M5 12h14"/></svg>
                    </button>
                <button
                    :class="toolbarBtnClasses ? toolbarBtnClasses: ''"
                    class="flow__toolbar__button"
                    aria-label="Fit to view"
                    @click.stop="setViewportToCenter()" 
                    type="button"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-focus"><circle cx="12" cy="12" r="3"/><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/></svg>
                </button>
        </div>
    </div>
</div>    
`

export function injectCanvasToEle(ele){
    let newCanvasHtml = document.createElement('div')
    newCanvasHtml.innerHTML = canvasHTML
    newCanvasHtml.style.height = '100%'
    newCanvasHtml.style.width = '100%'
    ele.appendChild(newCanvasHtml)
    return ele
}