extends SceneTree
## Perfil gráfico real a 1080p: panorama, jugador, interior y cruce de calle.
## Ejecutar sin --headless; -- --output=RUTA_ABSOLUTA.json [--captures].
## Cada escenario reconstruye el mundo, calienta 10 s y mide otros 12 s.

const WARMUP_US: int = 10000000
const SAMPLE_US: int = 12000000
const POPULATION: int = 24
const RANDOM_SEED: int = 421

var _output: String = ""
var _captures: bool = false
var _scenario_filter: String = ""
var _disable_msaa: bool = false
var _world: Node3D
var _player: WorldPlayer
var _manager: NPCManager


func _initialize() -> void:
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("--output="):
			_output = argument.trim_prefix("--output=")
		elif argument == "--captures":
			_captures = true
		elif argument.begins_with("--scenario="):
			_scenario_filter = argument.trim_prefix("--scenario=")
		elif argument == "--no-msaa":
			_disable_msaa = true
	call_deferred("_run")


func _run() -> void:
	if not _output.is_absolute_path():
		push_error("BENCHMARK: proporcionar --output absoluto en SIDE1/tests/output")
		quit(1)
		return
	root.size = Vector2i(1920, 1080)
	DisplayServer.window_set_size(Vector2i(1920, 1080))
	DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_DISABLED)
	DisplayServer.window_move_to_foreground()
	Engine.max_fps = 0
	var scenarios: Array[String] = ["overview", "player", "store", "street_walk"]
	if not _scenario_filter.is_empty() and not scenarios.has(_scenario_filter):
		push_error("BENCHMARK: escenario desconocido " + _scenario_filter)
		quit(1)
		return
	var results: Array[Dictionary] = []
	for scenario: String in scenarios:
		if not _scenario_filter.is_empty() and scenario != _scenario_filter:
			continue
		results.append(await _measure(scenario))
	var report: Dictionary = {
		"engine": Engine.get_version_info().string,
		"renderer": ProjectSettings.get_setting("rendering/renderer/rendering_method"),
		"gpu": RenderingServer.get_video_adapter_name(),
		"os": OS.get_name(), "processor": OS.get_processor_name(),
		"viewport": str(root.size), "quality": "Alto", "population": POPULATION,
		"msaa_3d": root.msaa_3d, "render_scale": root.scaling_3d_scale,
		"physics_engine": ProjectSettings.get_setting("physics/3d/physics_engine", "GodotPhysics3D"),
		"physics_ticks_per_second": Engine.physics_ticks_per_second,
		"physics_interpolation": ProjectSettings.get_setting("physics/common/physics_interpolation", false),
		"warmup_seconds": 10, "sample_seconds": 12, "seed": RANDOM_SEED,
		"vsync_mode_observed": DisplayServer.window_get_vsync_mode(),
		"max_fps": Engine.max_fps, "scenarios": results,
		"limitations": "Semilla fijada antes de iniciar FSM; planificación y RVO pueden variar. Una ejecución corta no certifica todos los equipos."
	}
	var file: FileAccess = FileAccess.open(_output, FileAccess.WRITE)
	if file == null:
		push_error("BENCHMARK: no se pudo escribir " + _output)
		quit(1)
		return
	file.store_string(JSON.stringify(report, "  "))
	file.close()
	print("WORLD_BENCHMARK_OK ", _output)
	quit(0)


func _measure(scenario: String) -> Dictionary:
	seed(RANDOM_SEED)
	var load_start: int = Time.get_ticks_usec()
	_world = (load("res://scenes/Main.tscn") as PackedScene).instantiate() as Node3D
	_manager = _world.get_node("NpcSpawner") as NPCManager
	_manager.max_npcs = POPULATION
	_manager.max_initial_npcs = POPULATION
	root.add_child(_world)
	# Los RNG son por NPC: seed() global no basta para reproducir sus destinos.
	var index: int = 0
	for npc: ShopNpc in _manager.get_population():
		var random: RandomNumberGenerator = npc.get("_rng") as RandomNumberGenerator
		random.seed = RANDOM_SEED + index
		index += 1
	var load_ms: float = float(Time.get_ticks_usec() - load_start) / 1000.0
	_player = _world.get_node("Player") as WorldPlayer
	await process_frame
	_world.get_node("QualitySettings").call("_apply_quality", 2)
	# Opción de laboratorio: aislar el coste de MSAA sin guardar preferencias.
	if _disable_msaa:
		root.msaa_3d = Viewport.MSAA_DISABLED
	if scenario == "overview":
		(_world.get_node("PlayerCamera") as Camera3D).make_current()
	elif scenario == "store":
		_player.global_position = Vector3(0, 0.05, 2.2)
		var interior_camera := Camera3D.new()
		interior_camera.name = "BenchmarkInteriorCamera"
		interior_camera.far = 280.0
		interior_camera.near = 0.15
		interior_camera.fov = 65.0
		_world.add_child(interior_camera)
		interior_camera.global_position = Vector3(0, 3.1, 4.2)
		interior_camera.look_at(Vector3(0, 1.4, -1.8))
		interior_camera.make_current()
	elif scenario == "street_walk":
		_player.global_position = Vector3(-34, 0.05, 14)
	# Evitar que una recolocación de prueba interpole desde la posición de inicio.
	_player.reset_physics_interpolation()
	# Registrar foco permite reconocer límites del driver aplicados en segundo plano.
	DisplayServer.window_move_to_foreground()
	var warmup_start: int = Time.get_ticks_usec()
	while Time.get_ticks_usec() - warmup_start < WARMUP_US:
		await process_frame
	var start_position: Vector3 = _player.global_position
	if scenario == "street_walk":
		_key(KEY_D, true)
	var durations: Array[float] = []
	var samples: Array[Dictionary] = []
	var sample_start: int = Time.get_ticks_usec()
	var previous: int = sample_start
	var next_monitor: int = sample_start
	while Time.get_ticks_usec() - sample_start < SAMPLE_US:
		await process_frame
		var now: int = Time.get_ticks_usec()
		durations.append(float(now - previous) / 1000.0)
		previous = now
		if now >= next_monitor:
			next_monitor = now + 250000
			samples.append({
				"elapsed_s": float(now - sample_start) / 1000000.0,
				"fps": Engine.get_frames_per_second(),
				"window_focused": DisplayServer.window_is_focused(),
				"draw_calls": Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),
				"primitives": Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME),
				"objects_drawn": Performance.get_monitor(Performance.RENDER_TOTAL_OBJECTS_IN_FRAME),
				"process_ms": Performance.get_monitor(Performance.TIME_PROCESS) * 1000.0,
				"physics_ms": Performance.get_monitor(Performance.TIME_PHYSICS_PROCESS) * 1000.0,
				"static_memory": Performance.get_monitor(Performance.MEMORY_STATIC),
				"video_memory": Performance.get_monitor(Performance.RENDER_VIDEO_MEM_USED),
				"node_count": Performance.get_monitor(Performance.OBJECT_NODE_COUNT),
				"population": _manager.get_population().size(),
				"player_position": [_player.global_position.x, _player.global_position.y, _player.global_position.z]
			})
	var elapsed_s: float = float(Time.get_ticks_usec() - sample_start) / 1000000.0
	_key(KEY_D, false)
	var result: Dictionary = {
		"scenario": scenario, "scene_load_ms": load_ms,
		"frame_count": durations.size(), "measured_seconds": elapsed_s,
		"effective_fps": float(durations.size()) / elapsed_s,
		"frame_median_ms": _percentile(durations, 0.5),
		"frame_p95_ms": _percentile(durations, 0.95),
		"frame_p99_ms": _percentile(durations, 0.99),
		"player_distance_m": _player.global_position.distance_to(start_position),
		"samples": samples
	}
	for metric: String in ["fps", "draw_calls", "primitives", "objects_drawn", "process_ms", "physics_ms", "static_memory", "video_memory", "node_count", "population"]:
		var values: Array[float] = []
		for sample: Dictionary in samples:
			values.append(float(sample[metric]))
		result[metric + "_median"] = _percentile(values, 0.5)
	if _captures:
		await RenderingServer.frame_post_draw
		var capture_path: String = _output.get_basename() + "-" + scenario + ".png"
		var capture_error: Error = root.get_texture().get_image().save_png(capture_path)
		if capture_error != OK:
			push_error("BENCHMARK: captura fallida " + capture_path)
	print("BENCHMARK_SCENARIO ", scenario, " fps=", result.effective_fps, " draws=", result.draw_calls_median, " p95_ms=", result.frame_p95_ms)
	_world.queue_free()
	await process_frame
	await physics_frame
	return result


func _key(key: Key, pressed: bool) -> void:
	var event := InputEventKey.new()
	event.physical_keycode = key
	event.keycode = key
	event.pressed = pressed
	Input.parse_input_event(event)


func _percentile(values: Array[float], fraction: float) -> float:
	if values.is_empty():
		return 0.0
	values.sort()
	return values[mini(values.size() - 1, int(float(values.size() - 1) * fraction))]
