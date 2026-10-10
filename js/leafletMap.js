const maps = new Map();

    function requireLeaflet() {
        if (!window.L) {
            throw new Error("Leaflet is not loaded. Configure a pinned Leaflet asset before enabling the production map.");
        }
        return window.L;
    }

    function getMap(elementId) {
        const entry = maps.get(elementId);
        if (!entry) throw new Error(`Leaflet map '${elementId}' has not been initialized.`);
        return entry;
    }

export function initializeMap(elementId, options) {
    const L = requireLeaflet();
    if (maps.has(elementId)) return;
    const map = L.map(elementId, { preferCanvas: options.preferCanvas });
    map.setView([options.latitude, options.longitude], options.zoom);
    maps.set(elementId, { map, layers: new Map() });
}

export function disposeMap(elementId) {
    const entry = maps.get(elementId);
    if (!entry) return;
    entry.map.remove();
    maps.delete(elementId);
}

export function setView(elementId, latitude, longitude, zoom) {
    getMap(elementId).map.setView([latitude, longitude], zoom);
}

export function setZoom(elementId, zoom) {
    getMap(elementId).map.setZoom(zoom);
}

export function fitBounds(elementId, bounds) {
    getMap(elementId).map.fitBounds([[bounds.south, bounds.west], [bounds.north, bounds.east]]);
}

export function addTileLayer(elementId, layer) {
    const entry = getMap(elementId);
    const L = requireLeaflet();
    if (entry.layers.has(layer.id)) entry.layers.get(layer.id).remove();
    const tileLayer = L.tileLayer(layer.urlTemplate, { attribution: layer.attribution, maxZoom: layer.maxZoom, opacity: layer.opacity });
    tileLayer.addTo(entry.map);
    entry.layers.set(layer.id, tileLayer);
}

export function addGeoJsonLayer(elementId, layer) {
    const entry = getMap(elementId);
    const L = requireLeaflet();
    if (entry.layers.has(layer.id)) entry.layers.get(layer.id).remove();
    const geoJsonLayer = L.geoJSON(layer.geoJson, {
        opacity: layer.opacity,
        fillOpacity: layer.opacity,
        onEachFeature: (feature, featureLayer) => {
            const properties = feature?.properties ?? {};
            const content = Object.entries(properties).map(([key, value]) => `<div><strong>${escapeHtml(key)}:</strong> ${escapeHtml(String(value))}</div>`).join("");
            if (content) featureLayer.bindPopup(content, { closeButton: true, maxWidth: 320 });
        }
    });
    geoJsonLayer.addTo(entry.map);
    entry.layers.set(layer.id, geoJsonLayer);
}

function escapeHtml(value) {
    return value.replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

export function removeLayer(elementId, layerId) {
    const entry = getMap(elementId);
    const layer = entry.layers.get(layerId);
    if (!layer) return;
    layer.remove();
    entry.layers.delete(layerId);
}

export function setLayerVisibility(elementId, layerId, visible) {
    const entry = getMap(elementId);
    const layer = entry.layers.get(layerId);
    if (!layer) return;
    if (visible) layer.addTo(entry.map);
    else layer.remove();
}

export function setLayerOpacity(elementId, layerId, opacity) {
    const layer = getMap(elementId).layers.get(layerId);
    if (layer?.setOpacity) layer.setOpacity(opacity);
}

export function setComparisonSplit(elementId, beforeLayerId, afterLayerId, position) {
    const entry = getMap(elementId);
    const before = entry.layers.get(beforeLayerId);
    const after = entry.layers.get(afterLayerId);
    const clamped = Math.max(0, Math.min(100, Number(position)));
    if (before?.getContainer) before.getContainer().style.clipPath = 'inset(0 0 0 0)';
    if (after?.getContainer) after.getContainer().style.clipPath = `inset(0 0 0 ${clamped}%)`;
}

export function invalidateSize(elementId) {
    getMap(elementId).map.invalidateSize();
}

export function startDistanceMeasurement(elementId) {
    const entry = getMap(elementId);
    clearMeasurement(elementId);
    entry.measurement = { points: [], line: null, markers: [], label: null };
    entry.map.getContainer().classList.add('leaflet-measuring');
    entry.map.on('click.measurement', event => {
        entry.measurement.points.push(event.latlng);
        const marker = window.L.circleMarker(event.latlng, { radius: 5, color: '#f59e0b', fillColor: '#fef3c7', fillOpacity: 1 }).addTo(entry.map);
        entry.measurement.markers.push(marker);
        if (entry.measurement.points.length > 1) {
            if (entry.measurement.line) entry.measurement.line.remove();
            entry.measurement.line = window.L.polyline(entry.measurement.points, { color: '#f59e0b', weight: 3, dashArray: '6 4' }).addTo(entry.map);
            const distance = totalDistance(entry.measurement.points);
            if (entry.measurement.label) entry.measurement.label.remove();
            entry.measurement.label = window.L.tooltip({ permanent: true, direction: 'center', className: 'leaflet-measurement-label' }).setLatLng(event.latlng).setContent(`${formatDistance(distance)} · click to extend`).addTo(entry.map);
        }
    });
}

export function clearMeasurement(elementId) {
    const entry = getMap(elementId);
    entry.map.off('click.measurement');
    entry.map.getContainer().classList.remove('leaflet-measuring');
    if (!entry.measurement) return;
    entry.measurement.line?.remove();
    entry.measurement.label?.remove();
    entry.measurement.markers.forEach(marker => marker.remove());
    entry.measurement = null;
}

export function startPolygonDrawing(elementId) {
    const entry = getMap(elementId);
    const L = requireLeaflet();
    clearPolygonDrawing(elementId);
    entry.polygonDrawing = { points: [], markers: [], polygon: null };
    entry.map.getContainer().classList.add('leaflet-drawing-polygon');
    entry.map.on('click.polygonDrawing', event => {
        entry.polygonDrawing.points.push(event.latlng);
        entry.polygonDrawing.markers.push(L.circleMarker(event.latlng, { radius: 5, color: '#2563eb', fillColor: '#dbeafe', fillOpacity: 1 }).addTo(entry.map));
        if (entry.polygonDrawing.polygon) entry.polygonDrawing.polygon.remove();
        if (entry.polygonDrawing.points.length >= 3) entry.polygonDrawing.polygon = L.polygon(entry.polygonDrawing.points, { color: '#2563eb', weight: 3, fillColor: '#93c5fd', fillOpacity: .28 }).addTo(entry.map);
    });
}

export function clearPolygonDrawing(elementId) {
    const entry = getMap(elementId);
    entry.map.off('click.polygonDrawing');
    entry.map.getContainer().classList.remove('leaflet-drawing-polygon');
    if (!entry.polygonDrawing) return;
    entry.polygonDrawing.polygon?.remove();
    entry.polygonDrawing.markers.forEach(marker => marker.remove());
    entry.polygonDrawing = null;
}

function totalDistance(points) {
    let total = 0;
    for (let i = 1; i < points.length; i++) total += points[i - 1].distanceTo(points[i]);
    return total;
}

function formatDistance(metres) {
    return metres >= 1000 ? `${(metres / 1000).toFixed(2)} km` : `${Math.round(metres)} m`;
}
