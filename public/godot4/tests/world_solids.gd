extends SceneTree
## Colisiones físicas de props/perímetro, escalas y concordancia con navegación.

var _world: Node3D
var _player: WorldPlayer
var _checks: int = 0
var _failed: bool = false


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	_world = (load("res://scenes/Main.tscn") as PackedScene).instantiate() as Node3D
	root.add_child(_world)
	_player = _world.get_node("Player") as WorldPlayer
	for frame: int in range(24):
		await physics_frame
	var solids: Array[Node] = _world.find_children("*", "StaticBody3D", true, false)
	for node: Node in solids:
		var body: StaticBody3D = node as StaticBody3D
		if body.collision_layer != 1 or body.collision_mask != 6:
			_fail("Capas inconsistentes: " + str(body.get_path()))
			return
		for child: Node in body.get_children():
			var collider: CollisionShape3D = child as CollisionShape3D
			if collider == null:
				continue
			if collider.disabled or collider.shape == null or not collider.global_basis.get_scale().is_equal_approx(Vector3.ONE):
				_fail("Collider nulo/desactivado/escalado: " + str(collider.get_path()))
				return
			_checks += 1
	var region: NavigationRegion3D = _world.get_node("NavigationRegion3D") as NavigationRegion3D
	if int(region.get_meta("obstacle_count", 0)) < 90:
		_fail("La navegación no incluye todos los props y la valla")
		return
	# Barridos a altura de la cápsula: los props pequeños también son sólidos.
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.34
	capsule.height = 1.8
	var space: PhysicsDirectSpaceState3D = _world.get_world_3d().direct_space_state
	var centers: Array[Vector3] = [
		Vector3(-40.2, 0, 4.8), Vector3(-18, 0, 0), Vector3(-54, 0, -54)
	]
	for center: Vector3 in centers:
		var query := PhysicsShapeQueryParameters3D.new()
		query.shape = capsule
		query.collision_mask = 1
		query.transform = Transform3D(Basis.IDENTITY, center + Vector3(0, 0.91, 2.0))
		query.motion = Vector3(0, 0, -4)
		if space.cast_motion(query)[0] >= 0.99:
			_fail("Prop atravesable: " + str(center))
			return
		_checks += 1
	# Se corre y salta contra los cuatro límites con el controlador de producción.
	var placements: Array[Vector3] = [Vector3(85, 0.04, 10), Vector3(-85, 0.04, 10), Vector3(10, 0.04, 85), Vector3(10, 0.04, -85)]
	var keys: Array[Key] = [KEY_D, KEY_A, KEY_S, KEY_W]
	for index: int in range(placements.size()):
		_player.global_position = placements[index]
		_player.velocity = Vector3.ZERO
		_player.reset_physics_interpolation()
		for frame: int in range(12):
			await physics_frame
		_key(keys[index], true)
		_key(KEY_SHIFT, true)
		_key(KEY_SPACE, true)
		for frame: int in range(150):
			await physics_frame
			if absf(_player.global_position.x) > 87.55 or absf(_player.global_position.z) > 87.55 or _player.global_position.y < -0.02:
				_fail("Perímetro atravesado: " + str(_player.global_position))
				break
			_checks += 1
		_key(keys[index], false)
		_key(KEY_SHIFT, false)
		_key(KEY_SPACE, false)
		if _failed:
			return
	# Aislar el salto del dintel del tráfico: esta prueba verifica geometría estática.
	_world.get_node("NpcSpawner").queue_free()
	for frame: int in range(3):
		await physics_frame
	_player.global_position = Vector3(0, 0.04, 4.94)
	_player.velocity = Vector3.ZERO
	_player.reset_physics_interpolation()
	for frame: int in range(12):
		await physics_frame
	var doorway_peak: float = 0.0
	_key(KEY_SPACE, true)
	for frame: int in range(120):
		await physics_frame
		doorway_peak = maxf(doorway_peak, _player.global_position.y)
		_checks += 1
	_key(KEY_SPACE, false)
	if doorway_peak < 0.7 or doorway_peak > 1.15 or not _player.is_on_floor():
		_fail("Salto atraviesa el dintel o pierde apoyo: peak=%.4f floor=%s" % [doorway_peak, _player.is_on_floor()])
		return
	print("WORLD_SOLIDS_OK checks=%d bodies=%d nav_obstacles=%d doorway_peak=%.4f: props, escalas y 4 límites con carrera/salto, dintel sólido" % [_checks, solids.size(), int(region.get_meta("obstacle_count", 0)), doorway_peak])
	quit(0)


func _key(key: Key, pressed: bool) -> void:
	var event := InputEventKey.new()
	event.physical_keycode = key
	event.keycode = key
	event.pressed = pressed
	Input.parse_input_event(event)


func _fail(message: String) -> void:
	_failed = true
	push_error("WORLD_SOLIDS_FAILED: " + message)
	quit(1)
