/**
 * Vendor bundle entry point.
 * Imports all third-party libraries and exposes them globally.
 */

// Core libraries
import cytoscape from 'cytoscape';
import * as d3 from 'd3';
import htmx from 'htmx.org';

// Cytoscape layout extensions
import fcose from 'cytoscape-fcose';
import cola from 'cytoscape-cola';
import coseBilkent from 'cytoscape-cose-bilkent';
import d3Force from 'cytoscape-d3-force';

// Register Cytoscape extensions
cytoscape.use(fcose);
cytoscape.use(cola);
cytoscape.use(coseBilkent);
cytoscape.use(d3Force);

// Expose globally
window.cytoscape = cytoscape;
window.d3 = d3;
window.htmx = htmx;

// Export for potential module usage
export { cytoscape, d3, htmx };
