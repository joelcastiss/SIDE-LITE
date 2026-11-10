extends SceneTree

## Verifica el soporte de toda la losa y cruces reales con el controlador del jugador.
var _player: WorldPlayer
var _failed: bool = false
var _minimum_y: float = INF
var _maximum_y: float = -INF


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var world := (load("res://scenes/Main.tscn") as PackedScene).instantiate() as Node3D
	root.add_child(world)
	_player = world.get_node("Player") as WorldPlayer
	for frame in range(24):
		await physics_frame
	var ground := world.get_node("Ciudad/TerrainCollision") as StaticBody3D
	var excluded: Array[RID] = []
	for body: StaticBody3D in world.find_children("*", "StaticBody3D", true, false):
		if body != ground:
			excluded.append(body.get_rid())
	var space := world.get_world_3d().direct_space_state
	var samples: int = 0
	for x in range(-87, 88, 2):
		for z in range(-87, 88, 2):
			var query := PhysicsRayQueryParameters3D.create(Vector3(x, 0.1, z), Vector3(x, -0.8, z), 1, excluded)
			var hit := space.intersect_ray(query)
			if hit.is_empty() or absf((hit.position as Vector3).y) > 0.001:
				_fail("Suelo discontinuo en (%s,%s): %s" % [x, z, hit])
				return
			samples += 1
	# Los eventos alimentan el mismo controlador físico usado en el juego.
	await _place(Vector3(-31, 0.04, 10))
	await _walk(KEY_D, 240)
	if _player.global_position.x < -15.0:
		_fail("El jugador no cruzó la calle")
	await _place(Vector3(0, 0.04, 10))
	await _walk(KEY_W, 120)
	if _player.global_position.z > 3.0:
		_fail("El umbral de tienda bloqueó el acceso")
	await _walk(KEY_S, 120)
	if _player.global_position.z < 8.0:
		_fail("El jugador no salió de la tienda")
	await _place(Vector3(0, 0.04, 0))
	await _walk(KEY_A, 120)
	if _player.global_position.x < -5.6 or _player.global_position.x > -4.8:
		_fail("La pared de tienda no detuvo al jugador")
	await _place(Vector3(0, 0.04, 0))
	await _walk(KEY_W, 80)
	if _player.global_position.z < -0.65:
		_fail("La mesa no detuvo al jugador")
	if _failed:
		quit(1)
		return
	print("GROUND_QA_OK samples=%d min_y=%.5f max_y=%.5f: calle, entrada/salida, pared y mesa" % [samples, _minimum_y, _maximum_y])
	quit(0)


func _place(point: Vector3) -> void:
	_player.global_position = point
	_player.velocity = Vector3.ZERO
	_player.reset_physics_interpolation()
	for frame in range(12):
		await physics_frame


func _walk(key: Key, frames: int) -> void:
	var event := InputEventKey.new()
	event.physical_keycode = key
	event.keycode = key
	event.pressed = true
	Input.parse_input_event(event)
	for frame in range(frames):
		await physics_frame
		_minimum_y = minf(_minimum_y, _player.global_position.y)
		_maximum_y = maxf(_maximum_y, _player.global_position.y)
		if _player.global_position.y < -0.02 or _player.global_position.y > 0.035:
			_fail("El jugador perdió su altura de apoyo: %s" % _player.global_position)
			break
	event.pressed = false
	Input.parse_input_event(event)
	await physics_frame


func _fail(message: String) -> void:
	_failed = true
	push_error(message)
	quit(1)
