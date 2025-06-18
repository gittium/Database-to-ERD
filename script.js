// Enhanced DBML to ERD Converter with Proper Relationship Symbols
// Supports one-to-one, one-to-many, and many-to-many relationships

let currentZoom = 1;
let tables = [];
let relationships = [];
let svg, container, zoom;

// Initialize SVG and setup zoom behavior
function initializeSVG() {
    svg = d3.select('#erdDiagram');
    
    zoom = d3.zoom()
        .scaleExtent([0.1, 3])
        .on('zoom', handleZoom);
    
    svg.call(zoom);
    
    container = svg.append('g')
        .attr('class', 'main-container');
    
    // Define relationship markers
    defineRelationshipMarkers();
}

// Define SVG markers for different relationship types
function defineRelationshipMarkers() {
    const defs = svg.select('defs').empty() ? svg.append('defs') : svg.select('defs');
    
    // Clear existing markers
    defs.selectAll('marker').remove();
    
    // One marker (single bar)
    defs.append('marker')
        .attr('id', 'one-marker')
        .attr('markerWidth', '12')
        .attr('markerHeight', '12')
        .attr('refX', '6')
        .attr('refY', '6')
        .attr('orient', 'auto')
        .attr('markerUnits', 'strokeWidth')
        .append('line')
        .attr('x1', '6')
        .attr('y1', '1')
        .attr('x2', '6')
        .attr('y2', '11')
        .attr('stroke', '#2c3e50')
        .attr('stroke-width', '2');
    
    // Many marker (crow's foot)
    defs.append('marker')
        .attr('id', 'many-marker')
        .attr('markerWidth', '15')
        .attr('markerHeight', '12')
        .attr('refX', '15')
        .attr('refY', '6')
        .attr('orient', 'auto')
        .attr('markerUnits', 'strokeWidth')
        .append('path')
        .attr('d', 'M15,6 L3,1 M15,6 L3,11 M15,6 L3,6')
        .attr('fill', 'none')
        .attr('stroke', '#2c3e50')
        .attr('stroke-width', '2');
    
    // Many marker start (crow's foot pointing left)
    defs.append('marker')
        .attr('id', 'many-marker-start')
        .attr('markerWidth', '15')
        .attr('markerHeight', '12')
        .attr('refX', '0')
        .attr('refY', '6')
        .attr('orient', 'auto')
        .attr('markerUnits', 'strokeWidth')
        .append('path')
        .attr('d', 'M0,6 L12,1 M0,6 L12,11 M0,6 L12,6')
        .attr('fill', 'none')
        .attr('stroke', '#2c3e50')
        .attr('stroke-width', '2');
    
    // One marker start (single bar at start)
    defs.append('marker')
        .attr('id', 'one-marker-start')
        .attr('markerWidth', '12')
        .attr('markerHeight', '12')
        .attr('refX', '6')
        .attr('refY', '6')
        .attr('orient', 'auto')
        .attr('markerUnits', 'strokeWidth')
        .append('line')
        .attr('x1', '6')
        .attr('y1', '1')
        .attr('x2', '6')
        .attr('y2', '11')
        .attr('stroke', '#2c3e50')
        .attr('stroke-width', '2');
}

// Handle zoom events
function handleZoom(event) {
    currentZoom = event.transform.k;
    container.attr('transform', event.transform);
    updateZoomDisplay();
}

function updateZoomDisplay() {
    const zoomElement = document.getElementById('zoomLevel');
    if (zoomElement) {
        zoomElement.textContent = Math.round(currentZoom * 100) + '%';
    }
}

// Zoom control functions
function zoomIn() {
    svg.transition().duration(300).call(zoom.scaleBy, 1.5);
}

function zoomOut() {
    svg.transition().duration(300).call(zoom.scaleBy, 1 / 1.5);
}

function resetZoom() {
    svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
}

function fitToView() {
    if (tables.length === 0) return;
    
    const bounds = container.node().getBBox();
    const parent = svg.node().getBoundingClientRect();
    const fullWidth = parent.width;
    const fullHeight = parent.height;
    
    const width = bounds.width;
    const height = bounds.height;
    const midX = bounds.x + width / 2;
    const midY = bounds.y + height / 2;
    
    const scale = Math.min(fullWidth / width, fullHeight / height) * 0.8;
    const translate = [fullWidth / 2 - scale * midX, fullHeight / 2 - scale * midY];
    
    svg.transition().duration(750).call(
        zoom.transform,
        d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
    );
}

// Clear input and diagram
function clearInput() {
    const inputElement = document.getElementById('dbmlInput');
    if (inputElement) {
        inputElement.value = '';
    }
    container.selectAll('*').remove();
    tables = [];
    relationships = [];
    updateStats();
}

// Update statistics display
function updateStats() {
    const inputElement = document.getElementById('dbmlInput');
    const statsElement = document.getElementById('inputStats');
    
    if (!inputElement || !statsElement) return;
    
    const input = inputElement.value;
    const lines = input.split('\n').length;
    const tableMatches = input.match(/Table\s+[\p{L}\p{N}_.]+/gu) || [];
    const refMatches = input.match(/Ref:/g) || [];
    
    statsElement.innerHTML = `
        <div style="display: flex; gap: 20px;">
            <div class="stats-item">
                <div class="stats-icon" style="background: #3498db;">📄</div>
                <span>Lines: <strong>${lines}</strong></span>
            </div>
            <div class="stats-item">
                <div class="stats-icon" style="background: #2ecc71;">🗂️</div>
                <span>Tables: <strong>${tableMatches.length}</strong></span>
            </div>
            <div class="stats-item">
                <div class="stats-icon" style="background: #e74c3c;">🔗</div>
                <span>Relations: <strong>${refMatches.length}</strong></span>
            </div>
        </div>
    `;
}

// Enhanced DBML parser with better relationship detection
function parseDBML(dbmlCode) {
    const parsedTables = [];
    const parsedRelationships = [];
    
    const cleanedDbml = dbmlCode.replace(/\/\/.*/g, '');

    // Parse tables
    const tableRegex = /Table\s+([\p{L}\p{N}_.]+)\s*\{([^}]+)\}/gu;
    let tableMatch;
    
    while ((tableMatch = tableRegex.exec(cleanedDbml)) !== null) {
        const tableName = tableMatch[1];
        const tableBody = tableMatch[2];
        
        const columns = [];
        const columnLines = tableBody.split('\n');
        
        for (const line of columnLines) {
            const trimmedLine = line.trim();
            if (trimmedLine && !trimmedLine.startsWith('Indexes') && !trimmedLine.startsWith('Note')) {
                const columnMatch = trimmedLine.match(/([\p{L}\p{N}_ก-๙\u0E00-\u0E7F]+)\s+([^[]+)(?:\[([^\]]+)\])?/u);
                if (columnMatch) {
                    const columnName = columnMatch[1];
                    const columnType = columnMatch[2].trim();
                    const constraints = (columnMatch[3] || '').toLowerCase();
                    
                    const isPK = constraints.includes('pk') || constraints.includes('primary key');
                    const isUnique = constraints.includes('unique');
                    const isNotNull = constraints.includes('not null');
                    
                    columns.push({
                        name: columnName,
                        type: columnType,
                        isPrimaryKey: isPK,
                        isForeignKey: false, // Will be determined from relationships
                        isUnique: isUnique,
                        isNotNull: isNotNull,
                        constraints: constraints
                    });
                }
            }
        }
        
        parsedTables.push({
            name: tableName,
            columns: columns
        });
    }
    
    // Parse relationships with enhanced detection
    const refRegex = /Ref:\s*([\p{L}\p{N}_.]+)\.([\p{L}\p{N}_ก-๙\u0E00-\u0E7F]+)\s*([><-])\s*([\p{L}\p{N}_.]+)\.([\p{L}\p{N}_ก-๙\u0E00-\u0E7F]+)/gu;
    let refMatch;
    
    while ((refMatch = refRegex.exec(cleanedDbml)) !== null) {
        const fromTable = refMatch[1];
        const fromColumn = refMatch[2];
        const relationSymbol = refMatch[3];
        const toTable = refMatch[4];
        const toColumn = refMatch[5];
        
        // Determine relationship type
        const relType = determineRelationshipType(
            parsedTables, fromTable, fromColumn, toTable, toColumn, relationSymbol
        );
        
        parsedRelationships.push({
            fromTable,
            fromColumn,
            relationship: relationSymbol,
            toTable,
            toColumn,
            type: relType // 'one-to-one', 'one-to-many', 'many-to-one', 'many-to-many'
        });
        
        // Mark foreign key columns - Fix FK identification logic
        if (relationSymbol === '>' || relationSymbol === '<') {
  const fromTableObj = parsedTables.find(t => t.name === fromTable);
  if (fromTableObj) {
    const fromCol = fromTableObj.columns.find(c => c.name === fromColumn);
    if (fromCol) fromCol.isForeignKey = true;
  }
}

    }
    
    return { tables: parsedTables, relationships: parsedRelationships };
}

// Fixed relationship type determination with correct logic
function determineRelationshipType(tables, fromTable, fromColumn, toTable, toColumn, symbol) {
    const fromTableObj = tables.find(t => t.name === fromTable);
    const toTableObj = tables.find(t => t.name === toTable);
    
    if (!fromTableObj || !toTableObj) return 'one-to-many';
    
    const fromCol = fromTableObj.columns.find(c => c.name === fromColumn);
    const toCol = toTableObj.columns.find(c => c.name === toColumn);
    
    // Check for one-to-one relationship
    if (symbol === '-') {
        return 'one-to-one';
    }
    
    // For > and < symbols, determine based on which side has the foreign key
    if (symbol === '>' || symbol === '<') {
  return 'many-to-one';
}
    
    // Check if either column is unique (indicates one-to-one)
    if (fromCol && fromCol.isUnique && toCol && toCol.isUnique) {
        return 'one-to-one';
    }
    
    // Check for junction table pattern (many-to-many)
    const isJunctionTable = (table) => {
        const pkColumns = table.columns.filter(c => c.isPrimaryKey);
        const fkColumns = table.columns.filter(c => c.isForeignKey || c.name.includes('_id'));
        return pkColumns.length >= 2 && fkColumns.length >= 2 && table.columns.length <= 4;
    };
    
    if (isJunctionTable(fromTableObj) || isJunctionTable(toTableObj)) {
        return 'many-to-many';
    }
    
    // Default
    return 'one-to-many';
}

// Auto layout tables
function autoLayout() {
    if (tables.length === 0) return;
    
    const tableSpacing = 320;
    const verticalSpacing = 240;
    const cols = Math.ceil(Math.sqrt(tables.length * 1.2));
    
    tables.forEach((table, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        
        const x = 50 + col * tableSpacing;
        const y = 50 + row * (verticalSpacing + table.columns.length * 25);
        
        table.x = x;
        table.y = y;
    });
    
    drawERD();
}

// Enhanced ERD drawing with proper relationship symbols
function drawERD() {
    container.selectAll('*').remove();
    
    if (tables.length === 0) return;
    
    const tableWidth = 240;
    const headerHeight = 40;
    const rowHeight = 24;
    
    function getColumnY(table, columnName) {
        const columnIndex = table.columns.findIndex(c => c.name === columnName);
        if (columnIndex === -1) {
            return table.y + headerHeight / 2;
        }
        return table.y + headerHeight + (columnIndex * rowHeight) + (rowHeight / 2);
    }
    
    function getConnectionPoint(table, columnName, direction) {
        const columnY = getColumnY(table, columnName);
        const x = direction === 'right' ? table.x + tableWidth : table.x;
        return { x, y: columnY };
    }
    
    // Draw relationships first (so they appear behind tables)
    relationships.forEach(rel => {
        const fromTable = tables.find(t => t.name === rel.fromTable);
        const toTable = tables.find(t => t.name === rel.toTable);
        
        if (fromTable && toTable) {
            // Determine connection direction
            const isFromLeft = fromTable.x < toTable.x;
            
            const fromPoint = getConnectionPoint(fromTable, rel.fromColumn, isFromLeft ? 'right' : 'left');
            const toPoint = getConnectionPoint(toTable, rel.toColumn, isFromLeft ? 'left' : 'right');
            
            // Create path data for curved line
            const dx = toPoint.x - fromPoint.x;
            const dy = toPoint.y - fromPoint.y;
            const curveOffset = Math.abs(dx) * 0.3;
            
            const pathData = `M ${fromPoint.x} ${fromPoint.y} C ${fromPoint.x + (isFromLeft ? curveOffset : -curveOffset)} ${fromPoint.y}, ${toPoint.x + (isFromLeft ? -curveOffset : curveOffset)} ${toPoint.y}, ${toPoint.x} ${toPoint.y}`;
            
            const path = container.append('path')
                .attr('d', pathData)
                .attr('class', 'relationship-line')
                .attr('stroke', '#7f8c8d')
                .attr('stroke-width', '2')
                .attr('fill', 'none');
            
            // Apply appropriate markers based on relationship type - FIXED LOGIC
            applyRelationshipMarkers(path, rel, isFromLeft);
            
            // Add relationship label
            const midX = (fromPoint.x + toPoint.x) / 2;
            const midY = (fromPoint.y + toPoint.y) / 2 - 8;
            
            container.append('text')
                .attr('x', midX)
                .attr('y', midY)
                .attr('class', 'relationship-text')
                .attr('text-anchor', 'middle')
                .attr('fill', '#5a6c7d')
                .attr('font-size', '11px')
                .attr('font-weight', '500')
                .text(rel.type.replace('-', ':'));
        }
    });
    
    // Draw tables
    tables.forEach((table, tableIndex) => {
        const tableHeight = headerHeight + table.columns.length * rowHeight;
        
        const tableGroup = container.append('g')
            .attr('class', 'table-group')
            .attr('transform', `translate(${table.x || 0}, ${table.y || 0})`);

        // Table container with shadow
        tableGroup.append('rect')
            .attr('width', tableWidth)
            .attr('height', tableHeight)
            .attr('class', 'table-box')
            .attr('fill', '#ffffff')
            .attr('stroke', '#2c3e50')
            .attr('stroke-width', '2')
            .attr('rx', '8')
            .style('filter', 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))')
            .style('cursor', 'move');

        // Table header
        tableGroup.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', tableWidth)
            .attr('height', headerHeight)
            .attr('fill', '#3498db')
            .attr('rx', '8 8 0 0');
        
        // Table name
        tableGroup.append('text')
            .attr('x', tableWidth / 2)
            .attr('y', headerHeight / 2 + 5)
            .attr('class', 'table-title')
            .attr('fill', 'white')
            .attr('font-weight', 'bold')
            .attr('font-size', '14px')
            .attr('text-anchor', 'middle')
            .text(table.name);
        
        // Draw columns
        table.columns.forEach((column, colIndex) => {
            const columnY = headerHeight + colIndex * rowHeight;
            
            // Column separator line
            if (colIndex > 0) {
                tableGroup.append('line')
                    .attr('x1', 8).attr('y1', columnY)
                    .attr('x2', tableWidth - 8).attr('y2', columnY)
                    .attr('stroke', '#ecf0f1')
                    .attr('stroke-width', '1');
            }

            // Column indicators - FIXED POSITIONING
            let offsetX = 15;
            if (column.isPrimaryKey) {
                tableGroup.append('text')
                    .attr('x', offsetX)
                    .attr('y', columnY + 16)
                    .attr('fill', '#e74c3c')
                    .attr('font-weight', 'bold')
                    .attr('font-size', '10px')
                    .text('PK');
                offsetX += 28;
            }
            if (column.isForeignKey) {
                tableGroup.append('text')
                    .attr('x', offsetX)
                    .attr('y', columnY + 16)
                    .attr('fill', '#f39c12')
                    .attr('font-weight', 'bold')
                    .attr('font-size', '10px')
                    .text('FK');
                offsetX += 28;
            }

            // Column name
            tableGroup.append('text')
                .attr('x', offsetX)
                .attr('y', columnY + 16)
                .attr('fill', '#2c3e50')
                .attr('font-size', '12px')
                .attr('font-family', 'JetBrains Mono, Courier New, monospace')
                .text(column.name);
            
            // Column type
            tableGroup.append('text')
                .attr('x', tableWidth - 15)
                .attr('y', columnY + 16)
                .attr('fill', '#7f8c8d')
                .attr('font-size', '10px')
                .attr('text-anchor', 'end')
                .text(column.type);
        });

        // Make table draggable
        tableGroup.call(d3.drag()
            .on('start', function(event) {
                d3.select(this).raise();
            })
            .on('drag', function(event) {
                tables[tableIndex].x += event.dx;
                tables[tableIndex].y += event.dy;
                drawERD();
            })
        );
    });
}

// FIXED: Apply relationship markers based on type with correct logic
function applyRelationshipMarkers(path, relationship, isFromLeft) {
    const { type, relationship: symbol } = relationship;
    
    // The key insight: markers should represent the cardinality at each end
    // For "A.id > B.id" (many-to-one): many A records can reference one B record
    // So A side should have "many" marker, B side should have "one" marker
    
    switch (type) {
        case 'one-to-one':
            path.attr('marker-start', 'url(#one-marker-start)')
                .attr('marker-end', 'url(#one-marker)');
            break;
            
        case 'many-to-one':
            // Many records on the "from" side, one record on the "to" side
            path.attr('marker-start', 'url(#many-marker-start)')
                .attr('marker-end', 'url(#one-marker)');
            break;
            
        case 'one-to-many':
            // One record on the "from" side, many records on the "to" side
            path.attr('marker-start', 'url(#one-marker-start)')
                .attr('marker-end', 'url(#many-marker)');
            break;
            
        case 'many-to-many':
            path.attr('marker-start', 'url(#many-marker-start)')
                .attr('marker-end', 'url(#many-marker)');
            break;
            
        default:
            // Fallback based on symbol
            if (symbol === '>') {
                path.attr('marker-start', 'url(#many-marker-start)')
                    .attr('marker-end', 'url(#one-marker)');
            } else if (symbol === '<') {
                path.attr('marker-start', 'url(#one-marker-start)')
                    .attr('marker-end', 'url(#many-marker)');
            } else {
                path.attr('marker-start', 'url(#one-marker-start)')
                    .attr('marker-end', 'url(#one-marker)');
            }
    }
}

// Convert DBML to ERD
function convertToERD() {
    const dbmlInput = document.getElementById('dbmlInput');
    if (!dbmlInput) return;
    
    const dbmlCode = dbmlInput.value.trim();
    
    if (!dbmlCode) {
        alert('Please enter some DBML code to convert');
        return;
    }
    
    const convertBtn = document.querySelector('button[onclick="convertToERD()"]');
    if (convertBtn) {
        convertBtn.classList.add('converting');
        convertBtn.textContent = 'Converting...';
    }
    
    setTimeout(() => {
        try {
            const parsedData = parseDBML(dbmlCode);
            
            if (parsedData.tables.length === 0) {
                throw new Error('No tables found. Please check your DBML syntax.');
            }
            
            tables = parsedData.tables;
            relationships = parsedData.relationships;
            
            autoLayout();
            updateStats();
            
            setTimeout(() => {
                fitToView();
            }, 100);
            
        } catch (error) {
            console.error('Conversion error:', error);
            alert('Conversion Error: ' + error.message);
        } finally {
            if (convertBtn) {
                convertBtn.classList.remove('converting');
                convertBtn.textContent = 'Convert';
            }
        }
    }, 100);
}

// Export SVG
function exportSVG() {
    if (tables.length === 0) {
        alert('Please convert some DBML first');
        return;
    }
    
    const svgElement = document.getElementById('erdDiagram');
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
    const svgUrl = URL.createObjectURL(svgBlob);
    
    const downloadLink = document.createElement('a');
    downloadLink.href = svgUrl;
    downloadLink.download = 'erd-diagram.svg';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(svgUrl);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeSVG();
    
    // Setup input event listener
    const inputElement = document.getElementById('dbmlInput');
    if (inputElement) {
        inputElement.addEventListener('input', updateStats);
    }
    
    updateStats();
});

// Export functions to global scope for HTML onclick handlers
window.initializeSVG = initializeSVG;
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.resetZoom = resetZoom;
window.fitToView = fitToView;
window.clearInput = clearInput;
window.convertToERD = convertToERD;
window.autoLayout = autoLayout;
window.exportSVG = exportSVG;