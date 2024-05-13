import {flowEditor, node} from "../src/index";
import '../src/flow.css'

document.addEventListener('alpine:init', () => {
    window.Alpine.plugin(node);
    window.Alpine.data('flowEditor', flowEditor)
});

