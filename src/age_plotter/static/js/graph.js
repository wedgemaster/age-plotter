/**
 * Cytoscape.js graph visualization.
 * Layout extensions are registered in vendor.entry.js
 */

// Tuning constants for d3-force degree-based functions (tweak from console)
window.d3ForceConfig = {
    manyBody: { base: -500, perDegree: -80, min: -5000 },
    linkDist: { base: 50, perDegree: 0, max: 2000 , exp: 1.0 },
    collide:  { base: 50, perDegree: 0, max: 120 },
    nodeSize: { base: 40, perDegree: 2, max: 60 },  // Node size based on degree
};

// Expose layout parameters for console tweaking
window.layoutParams = {
    fcose: {
        // Quality and performance
        quality: 'proof',             // 'draft', 'default', or 'proof'
        randomize: true,              // Randomize initial positions
        animate: true,                // Animate layout
        animationDuration: 1000,      // Animation duration in ms
        animationEasing: undefined,   // Easing for animation
        fit: true,                    // Fit to viewport after layout
        padding: 20,                  // Padding around graph

        // Node positioning
        nodeDimensionsIncludeLabels: true,  // Include labels in node dimensions
        uniformNodeDimensions: false,       // Treat all nodes as same size
        packComponents: false,              // Pack disconnected components
        nodeRepulsion: 50000,               // Repulsion between nodes (high for large graphs)

        // Edge parameters
        idealEdgeLength: 200,         // Target edge length
        edgeElasticity: 0.45,         // Edge stretchiness (0-1)

        // Nesting (compound nodes)
        nestingFactor: 0.1,           // Nesting multiplier

        // Gravity
        gravity: 0.01,                // General gravity toward center (low for spread)
        gravityRangeCompound: 1.5,    // Gravity range for compounds
        gravityCompound: 1.0,         // Gravity for compound nodes
        gravityRange: 3.8,            // Gravity range

        // Algorithm tuning
        numIter: 5000,                // Number of iterations
        initialEnergyOnIncremental: 0.3,  // Energy for incremental layouts

        // Tiling (for compound nodes)
        tile: true,                   // Enable tiling
        tilingPaddingVertical: 10,    // Vertical tiling padding
        tilingPaddingHorizontal: 10,  // Horizontal tiling padding

        // Sampling
        samplingType: true,           // Use sampling
        sampleSize: 25,               // Sample size
        nodeSeparation: 200,          // Min separation between nodes
        piTol: 0.0000001,             // Tolerance for layout
    },
    cola: {
        nodeSpacing: 30,              // Min space between nodes
        edgeLength: 100,              // Target edge length
        animate: true,
        randomize: true,
        avoidOverlap: true,
        convergenceThreshold: 0.01,
        flow: undefined,              // Use DAG flow: { axis: 'y', minSeparation: 30 }
        alignment: undefined,         // Alignment constraints
        handleDisconnected: true,     // Handle disconnected components
    },
    coseBilkent: {
        nodeRepulsion: 4500,
        idealEdgeLength: 80,
        edgeElasticity: 0.45,
        gravity: 0.25,
        numIter: 2500,
        randomize: true,
        animate: 'end',
        animationDuration: 500,
        tile: true,
        tilingPaddingVertical: 10,
        tilingPaddingHorizontal: 10,
        gravityRangeCompound: 1.5,
        gravityCompound: 1.0,
        gravityRange: 3.8,
        nestingFactor: 0.1,
        initialEnergyOnIncremental: 0.5,
    },
    cose: {
        nodeRepulsion: 8000,
        idealEdgeLength: 100,
        nodeOverlap: 4,               // Overlap padding
        refresh: 20,                  // Refresh rate during layout
        randomize: true,
        componentSpacing: 40,         // Space between components
        nestingFactor: 1.2,
        gravity: 1,
        numIter: 1000,
        initialTemp: 1000,            // Initial temperature
        coolingFactor: 0.99,          // Cooling factor for simulated annealing
        minTemp: 1.0,                 // Min temp to stop
    },
    d3Force: {
        animate: true,                // Animate layout
        fixedAfterDragging: true,     // Fix node position after dragging
        linkId: function(d) { return d.id; },  // REQUIRED: ID accessor for links
        randomize: true,              // Randomize initial positions
        infinite: true,               // Run continuously until stopped
        alphaDecay: 0,                // Never cool down (default ~0.0228)
        alphaTarget: 0.01,            // Very slight warmth - enough to respond, not jittery
        velocityDecay: 0.7,           // High friction - nodes settle quickly (default 0.4)

        // Centering forces (default 0.1 pulls toward center)
        xStrength: 0,                 // Disable X-axis centering
        yStrength: 0,                 // Disable Y-axis centering

        // Degree-based repulsion: hubs push harder to get breathing room
        // Tweak via window.d3ForceConfig.manyBody
        // Note: d3 flattens node data, so degree is on node directly, not node.data
        manyBodyStrength: function(node) {
            const c = window.d3ForceConfig.manyBody;
            const degree = node.degree || 0;
            return Math.max(c.min, c.base + (degree * c.perDegree));
        },

        // Degree-based link distance: edges to/from hubs are longer
        // Tweak via window.d3ForceConfig.linkDist
        linkDistance: function(link) {
            const c = window.d3ForceConfig.linkDist;
            const sourceDegree = link.source?.degree || 0;
            const targetDegree = link.target?.degree || 0;
            let distance = 0;
            if (sourceDegree == 1 || targetDegree == 1 ){
                distance = c.base;
            }
            else {
                distance = c.base + (Math.pow((sourceDegree + targetDegree), c.exp ) * c.perDegree);
            }
            return Math.min(c.max, distance);
        },

        // Collision detection: reserve more space around high-degree nodes
        // Tweak via window.d3ForceConfig.collide
        collideRadius: function(node) {
            const c = window.d3ForceConfig.collide;
            const degree = node.degree || 0;
            return Math.min(c.max, c.base + (degree * c.perDegree));
        },
        collideStrength: 0.8,         // How strongly to enforce collision (0-1)
    },
};

// Helper to re-run layout from console: rerunLayout() or rerunLayout('cola')
window.rerunLayout = function(layoutName) {
    const container = document.querySelector('.cytoscape-container');
    const cy = container?._cy;
    if (cy) {
        const name = layoutName || document.querySelector('.graph-container select')?.value || 'fcose';
        cy.layout(getLayoutOptions(name)).run();
    }
};

// Color palette for node labels (64 colors)
const NODE_COLORS = [
    // Original 8
    '#6366f1', // indigo
    '#22c55e', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#06b6d4', // cyan
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#14b8a6', // teal
    // Blues
    '#3b82f6', // blue
    '#0ea5e9', // sky
    '#1d4ed8', // blue-700
    '#0284c7', // sky-600
    '#2563eb', // blue-600
    '#0369a1', // sky-700
    '#1e40af', // blue-800
    '#0c4a6e', // sky-900
    // Greens
    '#10b981', // emerald
    '#84cc16', // lime
    '#16a34a', // green-600
    '#65a30d', // lime-600
    '#059669', // emerald-600
    '#4d7c0f', // lime-700
    '#047857', // emerald-700
    '#15803d', // green-700
    // Reds & Oranges
    '#f97316', // orange
    '#dc2626', // red-600
    '#ea580c', // orange-600
    '#b91c1c', // red-700
    '#c2410c', // orange-700
    '#f43f5e', // rose
    '#e11d48', // rose-600
    '#be123c', // rose-700
    // Purples
    '#a855f7', // purple
    '#7c3aed', // violet-600
    '#9333ea', // purple-600
    '#6d28d9', // violet-700
    '#7e22ce', // purple-700
    '#c026d3', // fuchsia-600
    '#a21caf', // fuchsia-700
    '#d946ef', // fuchsia
    // Yellows & Browns
    '#eab308', // yellow
    '#ca8a04', // yellow-600
    '#a16207', // yellow-700
    '#92400e', // amber-800
    '#78350f', // amber-900
    '#854d0e', // yellow-800
    '#713f12', // yellow-900
    '#b45309', // amber-700
    // Teals & Cyans
    '#0d9488', // teal-600
    '#0891b2', // cyan-600
    '#0f766e', // teal-700
    '#0e7490', // cyan-700
    '#115e59', // teal-800
    '#155e75', // cyan-800
    '#2dd4bf', // teal-400
    '#22d3ee', // cyan-400
    // Neutrals with color
    '#64748b', // slate-500
    '#6b7280', // gray-500
    '#71717a', // zinc-500
    '#737373', // neutral-500
    '#78716c', // stone-500
    '#475569', // slate-600
    '#4b5563', // gray-600
    '#52525b', // zinc-600
];

// Map label -> color
const labelColorMap = new Map();
let colorIndex = 0;

/**
 * Get consistent color for a label.
 */
function getLabelColor(label) {
    if (!labelColorMap.has(label)) {
        labelColorMap.set(label, NODE_COLORS[colorIndex % NODE_COLORS.length]);
        colorIndex++;
    }
    return labelColorMap.get(label);
}

// Active filter state
let activeFilterLabel = null;
let activeFilterRelType = null;

// Color fallbacks (overridden by theme)
const EDGE_COLOR_FALLBACK = '#64748b';
const DIMMED_COLOR_FALLBACK = '#666';
const HIGHLIGHT_COLOR_FALLBACK = '#f59e0b';  // amber

// Get current theme colors or fallbacks
function getEdgeColor() {
    return window.themeColors?.muted || EDGE_COLOR_FALLBACK;
}

function getDimmedColor() {
    return window.themeColors?.dimmed || DIMMED_COLOR_FALLBACK;
}

function getHighlightColor() {
    return window.themeColors?.primary || HIGHLIGHT_COLOR_FALLBACK;
}

/**
 * Filter graph by node label. Toggle behavior:
 * - Click label: gray out other nodes
 * - Click same label again: restore all colors
 */
function filterByLabel(cy, label) {
    // Clear any relationship filter first
    if (activeFilterRelType) {
        activeFilterRelType = null;
    }

    if (activeFilterLabel === label) {
        // Clear filter - restore all colors
        activeFilterLabel = null;
        cy.nodes().forEach(node => {
            node.style({ 'background-color': node.data('color'), 'opacity': 1 });
        });
        cy.edges().forEach(edge => {
            edge.style({
                'line-color': getEdgeColor(),
                'target-arrow-color': getEdgeColor()
            });
        });
    } else {
        // Apply filter
        activeFilterLabel = label;
        cy.nodes().forEach(node => {
            if (node.data('nodeLabel') === label) {
                node.style({ 'background-color': node.data('color'), 'opacity': 1 });
            } else {
                node.style({ 'background-color': getDimmedColor(), 'opacity': 0.5 });
            }
        });
        cy.edges().forEach(edge => {
            edge.style({
                'line-color': getDimmedColor(),
                'target-arrow-color': getDimmedColor()
            });
        });
    }
}

/**
 * Filter graph by relationship type. Toggle behavior:
 * - Click type: highlight those edges, gray out others
 * - Click same type again: restore all
 */
function filterByRelType(cy, relType) {
    // Clear any node label filter first
    if (activeFilterLabel) {
        activeFilterLabel = null;
        cy.nodes().forEach(node => {
            node.style('background-color', node.data('color'));
            node.style('opacity', 1);
        });
    }

    if (activeFilterRelType === relType) {
        // Clear filter - restore all
        activeFilterRelType = null;
        cy.nodes().forEach(node => {
            node.style({ 'background-color': node.data('color'), 'opacity': 1 });
        });
        cy.edges().forEach(edge => {
            edge.style({
                'line-color': getEdgeColor(),
                'target-arrow-color': getEdgeColor(),
                'width': 1
            });
        });
    } else {
        // Apply filter - highlight matching edges, keep connected nodes colored
        activeFilterRelType = relType;

        // Collect nodes connected via this relationship type
        const connectedNodeIds = new Set();
        cy.edges().forEach(edge => {
            if (edge.data('label') === relType) {
                connectedNodeIds.add(edge.data('source'));
                connectedNodeIds.add(edge.data('target'));
            }
        });

        // Dim only unconnected nodes, keep connected nodes colored
        cy.nodes().forEach(node => {
            if (connectedNodeIds.has(node.id())) {
                node.style({ 'background-color': node.data('color'), 'opacity': 1 });
            } else {
                node.style({ 'background-color': getDimmedColor(), 'opacity': 0.5 });
            }
        });

        // Highlight matching edges, dim others
        cy.edges().forEach(edge => {
            if (edge.data('label') === relType) {
                edge.style({
                    'line-color': getHighlightColor(),
                    'target-arrow-color': getHighlightColor(),
                    'width': 2
                });
            } else {
                edge.style({
                    'line-color': getDimmedColor(),
                    'target-arrow-color': getDimmedColor()
                });
            }
        });
    }
}

/**
 * Update legend item visual state to show active filter.
 */
function updateLegendActiveState(container, activeValue) {
    container.querySelectorAll('[data-label]').forEach(item => {
        if (activeValue && item.dataset.label === activeValue) {
            item.classList.add('ring-1', 'ring-primary');
        } else {
            item.classList.remove('ring-1', 'ring-primary');
        }
    });
}

/**
 * Set graph container height to fill remaining viewport.
 */
function setGraphHeight(panel) {
    const graphContainer = panel.querySelector('.graph-container');
    if (!graphContainer) return;

    // Reset height to auto first so we get accurate rect.top measurement
    graphContainer.style.height = 'auto';

    const rect = graphContainer.getBoundingClientRect();
    // Account for fixed bottom navbar (64px) plus some padding (20px)
    const bottomOffset = 84;
    const availableHeight = window.innerHeight - rect.top - bottomOffset;
    const minHeight = 300;
    graphContainer.style.height = Math.max(availableHeight, minHeight) + 'px';
}

// Resize handler for all visible graph containers
window.addEventListener('resize', () => {
    document.querySelectorAll('.graph-view:not(.hidden) .graph-container').forEach(gc => {
        const panel = gc.closest('.result-panel');
        if (panel) setGraphHeight(panel);

        // Tell Cytoscape to resize to fit new container dimensions
        const cy = gc.querySelector('.cytoscape-container')?._cy;
        if (cy) {
            cy.resize();
            cy.fit(50);
        }
    });
});

/**
 * Initialize Cytoscape graph for a panel.
 */
function initGraphIfNeeded(panel) {
    const container = panel.querySelector('.cytoscape-container');
    if (!container) return;

    // If already initialized and cy instance exists, just fit
    if (container._cy) {
        container._cy.resize();
        container._cy.fit(50);
        return;
    }

    // Clear stale initialized flag (from localStorage restore)
    container.dataset.initialized = '';

    // Set graph height to fill viewport
    setGraphHeight(panel);

    const nodes = JSON.parse(container.dataset.nodes || '[]');
    const relationships = JSON.parse(container.dataset.relationships || '[]');

    if (nodes.length === 0 && relationships.length === 0) {
        container.innerHTML = '<div class="flex items-center justify-center h-full text-base-content/50">No graph data</div>';
        container.dataset.initialized = 'true';
        return;
    }

    const elements = buildCytoscapeElements(nodes, relationships);

    const cy = cytoscape({
        container: container,
        elements: elements,
        style: getCytoscapeStyle(),
        minZoom: 0.2,
        maxZoom: 3,
        webgl: true,  // GPU-accelerated rendering (experimental)
    });

    // Store reference for controls
    container._cy = cy;
    container.dataset.initialized = 'true';

    // Node click handler - show modal (layout keeps running in infinite mode)
    cy.on('tap', 'node', function(evt) {
        showNodeModal(evt.target.data());
    });

    // After initial layout settles, reduce alpha so grab reheat is gentle
    cy.one('layoutstop', function() {
        cy.fit(50);
        // Lower alpha so grab reheat = (0 - 0.01) / 3 ≈ 0 instead of 0.33
        const sim = container._runningLayout?.simulation;
        if (sim) sim.alpha(0);
    });

    // Run layout and store reference for stopping
    container._runningLayout = cy.layout(getLayoutOptions('d3Force'));
    container._runningLayout.run();

    // Populate legend
    populateLegend(panel, nodes, relationships);
}

/**
 * Transform nodes and relationships to Cytoscape elements.
 */
function buildCytoscapeElements(nodes, relationships) {
    const elements = [];
    const nodeIds = new Set();

    // Pre-compute degree for each node (needed for d3-force layout)
    const degreeMap = new Map();
    for (const node of nodes) {
        degreeMap.set(String(node.id), 0);
    }
    for (const rel of relationships) {
        const sourceId = String(rel.start_node_id);
        const targetId = String(rel.end_node_id);
        if (degreeMap.has(sourceId)) {
            degreeMap.set(sourceId, degreeMap.get(sourceId) + 1);
        }
        if (degreeMap.has(targetId)) {
            degreeMap.set(targetId, degreeMap.get(targetId) + 1);
        }
    }

    // Add nodes (coerce IDs to strings for consistent comparison)
    for (const node of nodes) {
        const label = node.labels[0] || 'Node';
        const displayName = getNodeDisplayName(node);
        const nodeId = String(node.id);
        nodeIds.add(nodeId);

        elements.push({
            data: {
                id: nodeId,
                label: displayName,
                nodeLabel: label,
                color: getLabelColor(label),
                properties: node.properties,
                allLabels: node.labels,
                degree: degreeMap.get(nodeId) || 0,
            }
        });
    }

    // Add edges (only if both endpoints exist)
    for (const rel of relationships) {
        const sourceId = String(rel.start_node_id);
        const targetId = String(rel.end_node_id);
        const hasSource = nodeIds.has(sourceId);
        const hasTarget = nodeIds.has(targetId);

        if (hasSource && hasTarget) {
            elements.push({
                data: {
                    id: String(rel.id),
                    source: sourceId,
                    target: targetId,
                    label: rel.type,
                    properties: rel.properties,
                }
            });
        } else {
            console.warn(
                `Dropped relationship ${rel.id} (${rel.type}): missing`,
                !hasSource ? `source ${sourceId}` : '',
                !hasTarget ? `target ${targetId}` : ''
            );
        }
    }

    return elements;
}

/**
 * Determine display name for a node.
 * Priority: name > title > label > id (first 8 chars)
 */
function getNodeDisplayName(node) {
    const props = node.properties || {};
    return props.name || props.title || props.label || String(node.id).slice(0, 8);
}

/**
 * Get Cytoscape stylesheet.
 */
function getCytoscapeStyle() {
    // Get theme colors if available
    const colors = (typeof getThemeColors === 'function') ? getThemeColors() : {};
    const textColor = colors.text || '#fff';
    const edgeColor = colors.muted || EDGE_COLOR_FALLBACK;

    // Store colors globally for filter functions
    if (colors.muted) window.themeColors = colors;

    return [
        // Node style
        {
            selector: 'node',
            style: {
                'background-color': 'data(color)',
                'label': 'data(label)',
                'text-valign': 'center',
                'text-halign': 'center',
                'font-size': '11px',
                'color': textColor,
                'width': function(node) {
                    const c = window.d3ForceConfig.nodeSize;
                    const degree = node.data('degree') || 0;
                    return Math.min(c.max, c.base + (degree * c.perDegree));
                },
                'height': function(node) {
                    const c = window.d3ForceConfig.nodeSize;
                    const degree = node.data('degree') || 0;
                    return Math.min(c.max, c.base + (degree * c.perDegree));
                },
            }
        },
        // Edge style
        {
            selector: 'edge',
            style: {
                'width': 1,
                'line-color': edgeColor,
                'target-arrow-color': edgeColor,
                'target-arrow-shape': 'triangle',
                'curve-style': 'bezier',
                'label': 'data(label)',
                'font-size': '10px',
                'color': edgeColor,
                'text-rotation': 'autorotate',
                'text-margin-y': -10,
            }
        },
        // Selected node
        {
            selector: 'node:selected',
            style: {
                'border-width': 3,
                'border-color': '#fff',
            }
        },
        // Hover
        {
            selector: 'node:active',
            style: {
                'overlay-opacity': 0.2,
            }
        }
    ];
}

/**
 * Populate legend panel with node labels and relationship types.
 */
function populateLegend(panel, nodes, relationships) {
    // Collect unique labels
    const nodeLabels = new Set();
    for (const node of nodes) {
        for (const label of node.labels) {
            nodeLabels.add(label);
        }
    }

    // Collect unique relationship types
    const relTypes = new Set();
    for (const rel of relationships) {
        relTypes.add(rel.type);
    }

    // Render node labels (clickable for filtering)
    const nodeContainer = panel.querySelector('.node-labels .legend-items');
    if (nodeContainer) {
        nodeContainer.innerHTML = '';
        for (const label of nodeLabels) {
            const item = document.createElement('div');
            item.className = 'flex items-center gap-2 text-sm cursor-pointer hover:bg-base-300 rounded px-1 -mx-1';
            item.dataset.label = label;
            item.innerHTML = `
                <span class="w-3 h-3 rounded-full" style="background-color: ${getLabelColor(label)}"></span>
                <span>${label}</span>
            `;
            nodeContainer.appendChild(item);
        }
    }

    // Render relationship types (clickable for filtering)
    const relContainer = panel.querySelector('.rel-types .legend-items');

    // Add click handlers to node labels (after relContainer is defined)
    nodeContainer?.querySelectorAll('[data-label]').forEach(item => {
        item.onclick = () => {
            const cy = panel.querySelector('.cytoscape-container')?._cy;
            if (cy) {
                filterByLabel(cy, item.dataset.label);
                // Update both containers' visual state
                updateLegendActiveState(nodeContainer, activeFilterLabel);
                updateLegendActiveState(relContainer, activeFilterRelType);
            }
        };
    });
    if (relContainer) {
        relContainer.innerHTML = '';
        for (const type of relTypes) {
            const item = document.createElement('div');
            item.className = 'flex items-center gap-2 text-sm cursor-pointer hover:bg-base-300 rounded px-1 -mx-1';
            item.dataset.label = type;
            item.innerHTML = `
                <span class="w-4 border-t-2 border-base-content/50"></span>
                <span>${type}</span>
            `;
            item.onclick = () => {
                const cy = panel.querySelector('.cytoscape-container')?._cy;
                if (cy) {
                    filterByRelType(cy, type);
                    // Update both containers' visual state
                    updateLegendActiveState(nodeContainer, activeFilterLabel);
                    updateLegendActiveState(relContainer, activeFilterRelType);
                }
            };
            relContainer.appendChild(item);
        }
    }
}

/**
 * Show modal with node properties.
 */
function showNodeModal(nodeData) {
    const modal = document.getElementById('node-modal');
    if (!modal) return;

    // Set header
    const label = nodeData.allLabels?.[0] || 'Node';
    const labelEl = document.getElementById('modal-node-label');
    if (labelEl) {
        labelEl.textContent = label;
        labelEl.style.backgroundColor = getLabelColor(label);
    }

    const nameEl = document.getElementById('modal-node-name');
    if (nameEl) {
        nameEl.textContent = nodeData.label;
    }

    // Build properties table
    const tbody = document.querySelector('#modal-properties-table tbody');
    if (tbody) {
        tbody.innerHTML = '';

        const props = nodeData.properties || {};
        for (const [key, value] of Object.entries(props)) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="font-medium">${escapeHtml(key)}</td>
                <td class="max-w-xs truncate" title="${escapeHtml(String(value))}">${escapeHtml(String(value))}</td>
            `;
            tbody.appendChild(tr);
        }
    }

    // Show modal
    modal.showModal();
}

/**
 * Escape HTML characters.
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Map config keys to actual registered layout names
const LAYOUT_NAME_MAP = {
    d3Force: 'd3-force',
    coseBilkent: 'cose-bilkent',
};

/**
 * Get layout options for a given layout name.
 * All parameters come from window.layoutParams for console tweaking.
 */
function getLayoutOptions(name) {
    const p = window.layoutParams;
    const validName = p[name] ? name : 'fcose';
    const registeredName = LAYOUT_NAME_MAP[validName] || validName;
    return { name: registeredName, ...p[validName] };
}

/**
 * Fit graph to viewport.
 */
function graphFit(btn) {
    const container = btn.closest('.graph-container')?.querySelector('.cytoscape-container');
    container?._cy?.fit(50);
}

/**
 * Change graph layout.
 */
function graphChangeLayout(select) {
    const container = select.closest('.graph-container')?.querySelector('.cytoscape-container');
    const cy = container?._cy;
    if (cy) {
        // Stop any running layout first
        if (container._runningLayout) {
            container._runningLayout.stop();
        }
        container._runningLayout = cy.layout(getLayoutOptions(select.value));
        container._runningLayout.run();
    }
}

/**
 * Re-run current layout.
 */
function graphReset(btn) {
    const graphContainer = btn.closest('.graph-container');
    const container = graphContainer?.querySelector('.cytoscape-container');
    const select = graphContainer?.querySelector('select');
    const cy = container?._cy;
    if (cy) {
        // Stop any running layout first
        if (container._runningLayout) {
            container._runningLayout.stop();
        }
        const layoutName = select?.value || 'dagre';
        container._runningLayout = cy.layout(getLayoutOptions(layoutName));
        container._runningLayout.run();
    }
}
