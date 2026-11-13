import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';

export const GEOFENCE_TYPES = {
	POLYGON: 'polygon',
	CIRCLE: 'circle'
};

export const STORAGE_KEY = 'sistemaia.geofences';

const DEFAULT_CENTER = [-33.4489, -70.6693]; // Santiago, Chile
const DEFAULT_ZOOM = 13;

const STYLE = {
	color: '#2563eb',
	weight: 2,
	fillColor: '#2563eb',
	fillOpacity: 0.15
};

function isValidLatLng(latlng) {
	return (
		latlng &&
		typeof latlng.lat === 'number' &&
		typeof latlng.lng === 'number' &&
		latlng.lat >= -90 &&
		latlng.lat <= 90 &&
		latlng.lng >= -180 &&
		latlng.lng <= 180
	);
}

function toLatLngs(ring) {
	return (ring || []).map((p) => [p[0], p[1]]);
}

export function layerToGeoJSON(layer) {
	if (layer instanceof L.Polygon) {
		const rings = layer.getLatLngs().map((ring) => ring.map((p) => [p.lat, p.lng]));
		return { type: 'Polygon', coordinates: rings };
	}
	if (layer instanceof L.Circle) {
		const c = layer.getLatLng();
		const r = layer.getRadius();
		const pts = [];
		const steps = 64;
		for (let i = 0; i < steps; i++) {
			const angle = (i / steps) * 2 * Math.PI;
			const lat = c.lat + (r * Math.cos(angle)) / 111320;
			const lng =
				c.lng +
				(r * Math.sin(angle)) / (111320 * Math.cos((c.lat * Math.PI) / 180));
			pts.push([lat, lng]);
		}
		pts.push(pts[0]);
		return { type: 'Polygon', coordinates: [pts] };
	}
	return null;
}

export function geoJSONToLayer(geojson) {
	if (!geojson || geojson.type !== 'Polygon' || !geojson.coordinates?.length) return null;
	const latlngs = toLatLngs(geojson.coordinates[0]).filter(
		(p) => p[0] !== undefined && p[1] !== undefined
	);
	if (latlngs.length < 3) return null;
	return L.polygon(latlngs, STYLE);
}

export function loadGeofences() {
	if (typeof localStorage === 'undefined') return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		const list = raw ? JSON.parse(raw) : [];
		return Array.isArray(list) ? list : [];
	} catch {
		return [];
	}
}

export function saveGeofences(list) {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function circleToPolygon(latlng, radiusMeters) {
	const pts = [];
	const steps = 64;
	for (let i = 0; i < steps; i++) {
		const angle = (i / steps) * 2 * Math.PI;
		const lat = latlng.lat + (radiusMeters * Math.cos(angle)) / 111320;
		const lng =
			latlng.lng +
			(radiusMeters * Math.sin(angle)) / (111320 * Math.cos((latlng.lat * Math.PI) / 180));
		pts.push([lat, lng]);
	}
	pts.push(pts[0]);
	return pts;
}

export function isPointInsideGeofence(latlng, geofence) {
	// Simplified check: polygon rings only
	const coords = geofence?.geojson?.coordinates;
	if (!coords || !coords[0]) return false;
	const ring = coords[0];
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const xi = ring[i][1],
			yi = ring[i][0],
			xj = ring[j][1],
			yj = ring[j][0];
		const intersect =
			yi > latlng.lat !== yj > latlng.lat &&
			latlng.lng < ((xj - xi) * (latlng.lat - yi)) / (yj - yi) + xi;
		if (intersect) inside = !inside;
	}
	return inside;
}
