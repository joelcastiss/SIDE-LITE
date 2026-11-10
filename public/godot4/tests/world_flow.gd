extends SceneTree
## Caminar real, cruzar calle, entrar/salir tres veces y conservar la población.

var _world: Node3D
var _player: WorldPlayer
var _manager: NPCManager
var _identities: Array[int] = []
var _previous: Dictionary = {}
var _travelled: Dictionary = {}
var _checks: int = 0
var _failed: bool = false


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	_world = (load("res://scenes/Main.tscn") as PackedScene).instantiate() as Node3D
	root.add_child(_world)
	_player = _world.get_node("Player") as WorldPlayer
	_manager = _world.get_node("NpcSpawner") as NPCManager
	var npc_index: int = 0
	for npc: ShopNpc in _manager.get_population():
		(npc.get("_rng") as RandomNumberGenerator).seed = 421 + npc_index
		npc_index += 1
		var identity: int = npc.get_instance_id()
		_identities.append(identity)
		_previous[identity] = npc.global_position
		_travelled[identity] = 0.0
	if _identities.size() != 24:
		_fail("Faltan NPC iniciales")
		return
	for frame in range(24):
		await physics_frame
	# Mismos presets que usa el selector; no emitir item_selected ni guardar user://.
	var quality: Node = _world.get_node("QualitySettings")
	for preset in range(3):
		quality.call("_apply_quality", preset)
		await process_frame
		var expected: float = [0.7, 0.85, 1.0][preset]
		if not is_equal_approx(root.scaling_3d_scale, expected):
			_fail("Preset no aplica escala de render")
			return
		var sun: DirectionalLight3D = _world.get_node("Sun") as DirectionalLight3D
		if sun.shadow_enabled != (preset > 0):
			_fail("Preset no aplica sombras")
			return
	await _place(Vector3(-31, 0.04, 10))
	await _walk(KEY_D, 240)
	if _player.global_position.x < -15.0:
		_fail("No cruzó la calle")
		return
	await _place(Vector3(0, 0.04, 10))
	for crossing in range(3):
		if not await _walk_to_z(KEY_W, 3.0, true):
			_fail("Entrada bloqueada en ciclo %d" % crossing)
			return
		if not await _walk_to_z(KEY_S, 8.0, false):
			_fail("Salida bloqueada en ciclo %d" % crossing)
			return
	if _failed:
		return
	var movers: int = 0
	var minimum_distance: float = INF
	for identity: int in _identities:
		minimum_distance = minf(minimum_distance, _travelled[identity])
		if _travelled[identity] > 1.0:
			movers += 1
	if movers < 20:
		_fail("Sólo %d NPC caminaron más de 1 m" % movers)
		return
	print("WORLD_FLOW_OK checks=%d: calle, 3 entradas/salidas, 24 IDs constantes, %d peatones >1m, mínimo=%.3fm, presets0/1/2" % [_checks, movers, minimum_distance])
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
		if not _check_world():
			break
	event.pressed = false
	Input.parse_input_event(event)
	await physics_frame


func _walk_to_z(key: Key, target_z: float, decreasing: bool) -> bool:
	# La aceleración y el tráfico cambian el tiempo de paso, nunca la meta física.
	# Cuatro segundos limitan el intento; siguen comprobándose suelo y población.
	var event := InputEventKey.new()
	event.physical_keycode = key
	event.keycode = key
	event.pressed = true
	Input.parse_input_event(event)
	var arrived: bool = false
	for frame in range(240):
		await physics_frame
		if not _check_world():
			break
		arrived = _player.global_position.z <= target_z if decreasing else _player.global_position.z >= target_z
		if arrived:
			break
	event.pressed = false
	Input.parse_input_event(event)
	await physics_frame
	return arrived and not _failed


func _check_world() -> bool:
	_checks += 1
	if _player.global_position.y < -0.02 or _player.global_position.y > 0.035:
		_fail("Jugador perdió apoyo: %s" % _player.global_position)
		return false
	var population: Array[ShopNpc] = _manager.get_population()
	if population.size() != 24:
		_fail("Población varió mientras jugador cruzaba tienda")
		return false
	for npc: ShopNpc in population:
		var identity: int = npc.get_instance_id()
		if not _identities.has(identity) or not npc.visible or npc.global_position.y < -0.05:
			_fail("NPC reemplazado, oculto o bajo suelo")
			return false
		_travelled[identity] += npc.global_position.distance_to(_previous[identity])
		_previous[identity] = npc.global_position
	return true


func _fail(message: String) -> void:
	_failed = true
	# Conservar evidencia del contacto que bloqueó el flujo, sin ocultar el fallo.
	if is_instance_valid(_player):
		print("WORLD_FLOW_PLAYER position=", _player.global_position, " velocity=", _player.velocity, " slides=", _player.get_slide_collision_count())
		for index in range(_player.get_slide_collision_count()):
			var contact: KinematicCollision3D = _player.get_slide_collision(index)
			print("WORLD_FLOW_CONTACT collider=", contact.get_collider(), " normal=", contact.get_normal(), " position=", contact.get_position())
		for npc: ShopNpc in _manager.get_population():
			if npc.global_position.distance_to(_player.global_position) < 4.0:
				print("WORLD_FLOW_NEARBY npc=", npc.name, " position=", npc.global_position, " velocity=", npc.velocity, " state=", npc.state, " detail=", npc.full_detail)
	push_error("WORLD_FLOW_FAILED: " + message)
	quit(1)
