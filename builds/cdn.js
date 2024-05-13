import {flowEditor} from "../src/core";
import {node} from "../src/node";


document.addEventListener('alpine:init', () => {
    window.Alpine.plugin(node);
    window.Alpine.data('flowEditor', flowEditor)
});

