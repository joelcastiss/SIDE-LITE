extends SceneTree
## Perfil reproducible: 12 s de calentamiento y 12 s medidos con 24 NPC.
## --script res://tests/world_profile.gd -- --output=C:/.../SIDE1/tests/output/profile.json
## Añadir --captures para guardar vistas overview/player/store junto al JSON.

var _output: String = ""
var _captures: bool = false


func _initialize() -> void:
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("--output="):
			_output = argument.trim_prefix("--output=")
		elif argument == "--captures":
			_captures = true
	call_deferred("_run")


func _run() -> void:
	if not _output.is_absolute_path():
		push_error("PROFILE: --output debe ser una ruta absoluta dentro de SIDE1/tests/output")
		quit(1)
		return
	root.size = Vector2i(1280, 720)
	DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_DISABLED)
	Engine.max_fps = 0
	var started: int = Time.get_ticks_usec()
	var world: Node3D = (load("res://scenes/Main.tscn") as PackedScene).instantiate() as Node3D
	var spawner: Node3D = world.get_node("NpcSpawner") as Node3D
	spawner.set("max_npcs", 24)
	spawner.set("max_initial_npcs", 24)
	root.add_child(world)
	var load_ms: float = float(Time.get_ticks_usec() - started) / 1000.0
	(world.get_node("PlayerCamera") as Camera3D).make_current()
	await process_frame
	world.get_node("QualitySettings").call("_apply_quality", 2)
	var warmup_start: int = Time.get_ticks_usec()
	while Time.get_ticks_usec() - warmup_start < 12000000:
		await process_frame
	var durations: Array[float] = []
	var samples: Array[Dictionary] = []
	var sample_start: int = Time.get_ticks_usec()
	var previous: int = sample_start
	var next_monitor: int = sample_start
	while Time.get_ticks_usec() - sample_start < 12000000:
		await process_frame
		var now: int = Time.get_ticks_usec()
		durations.append(float(now - previous) / 1000.0)
		previous = now
		if now >= next_monitor:
			next_monitor = now + 250000
			samples.append({
				"elapsed_s": float(now - sample_start) / 1000000.0,
				"population": spawner.get_child_count(),
				"fps_monitor": Engine.get_frames_per_second(),
				"draw_calls": Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),
				"primitives": Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME),
				"objects_drawn": Performance.get_monitor(Performance.RENDER_TOTAL_OBJECTS_IN_FRAME),
				"process_ms": Performance.get_monitor(Performance.TIME_PROCESS) * 1000.0,
				"physics_ms": Performance.get_monitor(Performance.TIME_PHYSICS_PROCESS) * 1000.0,
				"static_memory": Performance.get_monitor(Performance.MEMORY_STATIC),
				"video_memory": Performance.get_monitor(Performance.RENDER_VIDEO_MEM_USED),
				"node_count": Performance.get_monitor(Performance.OBJECT_NODE_COUNT),
				"resource_count": Performance.get_monitor(Performance.OBJECT_RESOURCE_COUNT),
				"orphan_nodes": Performance.get_monitor(Performance.OBJECT_ORPHAN_NODE_COUNT)
			})
	var summary: Dictionary = {
		"engine": Engine.get_version_info().string,
		"renderer": ProjectSettings.get_setting("rendering/renderer/rendering_method"),
		"viewport": "1280x720", "quality": "Alto", "camera": "Main/PlayerCamera overview",
		"warmup_seconds": 12, "sample_seconds": 12, "initial_population": 24,
		"scene_load_ms": load_ms,
		"frame_count": durations.size(),
		"frame_median_ms": _percentile(durations, 0.5),
		"frame_p95_ms": _percentile(durations, 0.95),
		"frame_p99_ms": _percentile(durations, 0.99),
		"samples": samples
	}
	for metric: String in ["draw_calls", "primitives", "objects_drawn", "process_ms", "physics_ms", "static_memory", "video_memory", "node_count", "resource_count", "orphan_nodes", "population"]:
		var values: Array[float] = []
		for sample: Dictionary in samples:
			values.append(float(sample[metric]))
		summary[metric + "_median"] = _percentile(values, 0.5)
	var file := FileAccess.open(_output, FileAccess.WRITE)
	if file == null:
		push_error("PROFILE: no se pudo escribir " + _output)
		quit(1)
		return
	file.store_string(JSON.stringify(summary, "  "))
	file.close()
	if _captures:
		await _capture("overview")
		var player: Node3D = world.get_node_or_null("Player") as Node3D
		if player != null:
			(player.get_node("CameraPivot/SpringArm3D/Camera3D") as Camera3D).make_current()
			await _capture("player")
			player.global_position = Vector3(0, 0.01, 2.2)
			for frame in range(12):
				await physics_frame
			await _capture("store")
	print("WORLD_PROFILE_OK ", _output, " frames=", durations.size(), " median_ms=", summary.frame_median_ms)
	quit(0)


func _percentile(values: Array[float], fraction: float) -> float:
	values.sort()
	return values[mini(values.size() - 1, int(float(values.size() - 1) * fraction))]


func _capture(label: String) -> void:
	for frame in range(8):
		await process_frame
	await RenderingServer.frame_post_draw
	var capture_path: String = _output.get_basename() + "-" + label + ".png"
	var result: Error = root.get_texture().get_image().save_png(capture_path)
	if result != OK:
		push_error("PROFILE: captura fallida " + capture_path)
