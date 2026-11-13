<script>
	import { onMount } from 'svelte';
	import GeofenceMap from '$lib/geofences/GeofenceMap.svelte';
	import {
		loadGeofences,
		saveGeofences,
		isPointInsideGeofence
	} from '$lib/geofences/index.js';

	let geofences = $state([]);
	let selectedId = $state(null);
	let testPoint = $state('');
	let testResult = $state(null);
	let testMarker = $state(null);
	let locationError = $state('');

	onMount(() => {
		geofences = loadGeofences();
	});

	function handleChange(list) {
		geofences = list;
		saveGeofences(list);
	}

	function handleLocationError() {
		locationError = 'No se pudo obtener tu ubicación. El mapa usará la ubicación predeterminada.';
	}

	function rename(gf, name) {
		gf.name = name;
		saveGeofences(geofences);
	}

	function remove(gf) {
		geofences = geofences.filter((g) => g.id !== gf.id);
		saveGeofences(geofences);
	}

	function clearAll() {
		geofences = [];
		saveGeofences([]);
	}

	function checkPoint() {
		const [latStr, lngStr] = testPoint.split(',').map((s) => s.trim());
		const lat = parseFloat(latStr);
		const lng = parseFloat(lngStr);
		if (Number.isNaN(lat) || Number.isNaN(lng)) {
			testResult = 'Formato inválido. Usa: lat, lng (ej: -33.4489, -70.6693)';
			testMarker = null;
			return;
		}
		const matches = geofences.filter((g) => isPointInsideGeofence({ lat, lng }, g));
		const inside = matches.length > 0;
		testResult = inside
			? `El punto está dentro de: ${matches.map((g) => g.name).join(', ')}`
			: 'El punto no está dentro de ninguna geocerca';
		testMarker = { lat, lng, inside };
	}
</script>

<svelte:head>
	<title>Geocercas · SistemaIA</title>
</svelte:head>

<h1>Geocercas</h1>
<p class="muted">
	Dibuja geocercas en el mapa usando las herramientas de la esquina superior derecha
	(polígono o círculo). Las geocercas se guardan localmente en el navegador.
</p>

<div class="layout">
	<div class="map-wrap">
		<GeofenceMap
			geofences={geofences}
			centerOnUser
			marker={testMarker}
			onchange={handleChange}
			onlocationerror={handleLocationError}
		/>
		{#if locationError}
			<p class="location-error">{locationError}</p>
		{/if}
	</div>

	<aside class="panel">
		<h2>Geocercas ({geofences.length})</h2>
		{#if geofences.length === 0}
			<p class="muted">Aún no hay geocercas dibujadas.</p>
		{:else}
			<ul class="list">
				{#each geofences as gf (gf.id)}
					<li class:active={selectedId === gf.id}>
						<input
							class="name-input"
							value={gf.name}
							oninput={(e) => rename(gf, e.currentTarget.value)}
						/>
						<button class="btn small secondary" onclick={() => (selectedId = selectedId === gf.id ? null : gf.id)}>Info</button>
						<button class="btn small danger" onclick={() => remove(gf)}>Eliminar</button>
						{#if selectedId === gf.id}
							<pre class="geojson">{JSON.stringify(gf.geojson.coordinates[0].slice(0, 5), null, 2)}…</pre>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
		<button class="btn secondary" onclick={clearAll} disabled={geofences.length === 0}>
			Borrar todas
		</button>

		<h2>Probar punto</h2>
		<div class="point-test">
			<input
				class="name-input"
				placeholder="lat, lng"
				bind:value={testPoint}
				onkeydown={(e) => e.key === 'Enter' && checkPoint()}
			/>
			<button class="btn" onclick={checkPoint}>Verificar</button>
		</div>
		{#if testResult}
			<p class="result" class:ok={testMarker?.inside} class:fail={testMarker && !testMarker.inside}>
				{testResult}
			</p>
		{/if}
	</aside>
</div>

<style>
	.layout {
		display: grid;
		grid-template-columns: 1fr 320px;
		gap: 1rem;
		margin-top: 1rem;
	}
	.map-wrap {
		min-height: 500px;
	}
	.location-error {
		color: var(--danger, #dc2626);
		font-size: 0.9rem;
	}
	.panel {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.list li {
		border: 1px solid var(--border, #e2e8f0);
		border-radius: 6px;
		padding: 0.5rem;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
	}
	.list li.active {
		border-color: var(--primary, #2563eb);
	}
	.name-input {
		flex: 1;
		min-width: 100px;
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--border, #e2e8f0);
		border-radius: 4px;
	}
	.geojson {
		width: 100%;
		font-size: 0.7rem;
		overflow: auto;
		background: var(--surface, #f8fafc);
		padding: 0.4rem;
		border-radius: 4px;
	}
	.point-test {
		display: flex;
		gap: 0.5rem;
	}
	.point-test .name-input {
		flex: 1;
	}
	.result {
		font-size: 0.9rem;
	}
	.result.ok {
		color: #16a34a;
	}
	.result.fail {
		color: #dc2626;
	}
	@media (max-width: 900px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}
</style>
