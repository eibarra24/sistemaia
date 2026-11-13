<script>
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import L from 'leaflet';
	import 'leaflet-draw';
	import { geoJSONToLayer, layerToGeoJSON } from './geofences.js';

	let {
		geofences = [],
		center = [-33.4489, -70.6693],
		zoom = 13,
		centerOnUser = false,
		readonly = false,
		marker = null,
		onchange = () => {},
		onselect = () => {},
		onlocationerror = () => {}
	} = $props();

	let container;
	let map;
	let drawControl;
	let drawnItems;
	let userMarker = null;
	let userAccuracy = null;
	let testMarkerLayer = null;

	const DRAW_OPTIONS = {
		position: 'topright',
		draw: {
			polygon: { shapeOptions: { color: '#2563eb', fillOpacity: 0.15 }, showArea: true },
			polyline: false,
			rectangle: false,
			circle: { shapeOptions: { color: '#2563eb', fillOpacity: 0.15 } },
			marker: false,
			circlemarker: false
		},
		edit: {
			featureGroup: null, // set after drawnItems creation
			remove: true
		}
	};

	function dotIcon(color) {
		return L.divIcon({
			className: '',
			html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 0 0 2px ${color}"></div>`,
			iconSize: [16, 16],
			iconAnchor: [8, 8]
		});
	}

	function requestUserLocation() {
		if (!browser || !navigator.geolocation) {
			onlocationerror(new Error('Geolocation is not supported'));
			return;
		}

		navigator.geolocation.getCurrentPosition(
			(position) => {
				if (!map) return;
				const latlng = [position.coords.latitude, position.coords.longitude];
				map.setView(latlng, Math.max(zoom, 15));

				if (userMarker) map.removeLayer(userMarker);
				if (userAccuracy) map.removeLayer(userAccuracy);
				userMarker = L.marker(latlng, { icon: dotIcon('#2563eb') }).addTo(map);
				userMarker.bindTooltip('Tu ubicación');
				if (position.coords.accuracy) {
					userAccuracy = L.circle(latlng, {
						radius: position.coords.accuracy,
						color: '#2563eb',
						weight: 1,
						fillOpacity: 0.08
					}).addTo(map);
				}
			},
			(error) => onlocationerror(error),
			{ enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
		);
	}

	function emitChange() {
		const list = drawnItems.getLayers().map((layer) => ({
			id: layer._geofenceId || crypto.randomUUID(),
			name: layer._geofenceName || 'Geocerca',
			geojson: layerToGeoJSON(layer),
			createdAt: layer._geofenceCreatedAt || new Date().toISOString()
		}));
		list.forEach((g, i) => {
			const layer = drawnItems.getLayers()[i];
			layer._geofenceId = g.id;
			layer._geofenceName = g.name;
			layer._geofenceCreatedAt = g.createdAt;
		});
		onchange(list);
	}

	function syncFromProps() {
		if (!map || !drawnItems) return;
		drawnItems.clearLayers();
		for (const gf of geofences) {
			const layer = geoJSONToLayer(gf.geojson);
			if (layer) {
				layer._geofenceId = gf.id;
				layer._geofenceName = gf.name;
				layer._geofenceCreatedAt = gf.createdAt;
				drawnItems.addLayer(layer);
			}
		}
	}

	$effect(() => {
		// re-sync when geofences prop changes (skip initial mount; onMount handles it)
		if (!map) return;
		syncFromProps();
	});

	$effect(() => {
		if (!map) return;
		if (testMarkerLayer) {
			map.removeLayer(testMarkerLayer);
			testMarkerLayer = null;
		}
		if (marker && Number.isFinite(marker.lat) && Number.isFinite(marker.lng)) {
			const latlng = [marker.lat, marker.lng];
			const color = marker.inside ? '#16a34a' : '#dc2626';
			testMarkerLayer = L.marker(latlng, { icon: dotIcon(color) }).addTo(map);
			testMarkerLayer.bindTooltip(marker.inside ? 'Dentro de geocerca' : 'Fuera de geocerca');
			map.panTo(latlng);
		}
	});

	onMount(() => {
		if (!browser || !container) return;

		map = L.map(container, { zoomControl: true }).setView(center, zoom);
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			maxZoom: 19,
			attribution: '&copy; OpenStreetMap contributors'
		}).addTo(map);

		drawnItems = new L.FeatureGroup();
		map.addLayer(drawnItems);

		DRAW_OPTIONS.edit.featureGroup = drawnItems;

		if (!readonly) {
			drawControl = new L.Control.Draw(DRAW_OPTIONS);
			map.addControl(drawControl);

			map.on(L.Draw.Event.CREATED, (e) => {
				const layer = e.layer;
				layer.setStyle({ color: '#2563eb', weight: 2, fillOpacity: 0.15 });
				drawnItems.addLayer(layer);
				onselect(layer);
				emitChange();
			});

			map.on(L.Draw.Event.EDITED, emitChange);
			map.on(L.Draw.Event.DELETED, emitChange);
		}

		syncFromProps();

		if (centerOnUser) {
			requestUserLocation();
		}

		return () => {
			map?.remove();
			map = null;
			drawnItems = null;
		};
	});

	onDestroy(() => {
		map?.remove();
	});

	export function getMap() {
		return map;
	}
	export function getDrawnItems() {
		return drawnItems;
	}
	export function fitToGeofences() {
		if (!drawnItems || drawnItems.getLayers().length === 0) return;
		const group = new L.FeatureGroup(drawnItems.getLayers());
		map.fitBounds(group.getBounds().pad(0.2));
	}
</script>

<div class="geofence-map" bind:this={container}></div>

<style>
	.geofence-map {
		width: 100%;
		height: 100%;
		min-height: 420px;
		border-radius: 8px;
		border: 1px solid var(--border, #e2e8f0);
		z-index: 0;
	}
	:global(.leaflet-container) {
		font-family: inherit;
	}
</style>
