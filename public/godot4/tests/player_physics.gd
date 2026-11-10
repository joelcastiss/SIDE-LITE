extends SceneTree
## Circuito aislado: input real, suelo, salto, bordillos, rampas, techo y peatón.

var _world: Node3D
var _player: WorldPlayer
var _failed: bool = false
var _jump_peak: float = 0.0
var _checks: int = 0


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	_world = Node3D.new()
	root.add_child(_world)
	_box(Vector3(0, -0.25, 0), Vector3(100, 0.5, 100))
	_box(Vector3(0, 0.1, 10), Vector3(3, 0.2, 3))
	_box(Vector3(0, 0.3, -10), Vector3(3, 0.6, 3))
	_box(Vector3(0, 1.5, -20), Vector3(0.4, 3, 6))
	_box(Vector3(0, 0.1, -30), Vector3(3, 0.2, 3))
	_box(Vector3(-1, 2.0, -30), Vector3(6, 0.2, 3))
	_ramp(Vector3(0, 0, 20), 30.0)
	_ramp(Vector3(0, 0, 30), 60.0)
	var npc := CharacterBody3D.new()
	npc.collision_layer = 2
	npc.collision_mask = 7
	npc.position = Vector3(0, 0, -40)
	var npc_shape := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.34
	capsule.height = 1.8
	npc_shape.shape = capsule
	npc_shape.position.y = 0.9
	npc.add_child(npc_shape)
	_world.add_child(npc)
	_player = (load("res://scenes/Player.tscn") as PackedScene).instantiate() as WorldPlayer
	_world.add_child(_player)
	await _place(Vector3(-6, 0.05, 0))
	await _walk(KEY_D, 90)
	if absf(_player.position.y) > 0.035 or not _player.is_on_floor():
		_fail("Suelo plano perdió apoyo")
	var walking_speed: float = Vector2(_player.velocity.x, _player.velocity.z).length()
	if absf(walking_speed - _player.walk_speed) > 0.05:
		_fail("Velocidad de paseo incorrecta: %.3f" % walking_speed)
	await _place(Vector3(-6, 0.05, 0))
	_key(KEY_SPACE, true)
	var takeoffs: int = 0
	var previous_y: float = 0.0
	for tick in range(180):
		await physics_frame
		if _player.velocity.y > 4.9 and previous_y < 0.04:
			takeoffs += 1
		_jump_peak = maxf(_jump_peak, _player.position.y)
		previous_y = _player.position.y
	_key(KEY_SPACE, false)
	if takeoffs != 1 or _jump_peak < 1.1 or _jump_peak > 1.4 or not _player.is_on_floor():
		_fail("Salto sostenido: despegues=%d altura=%.4f suelo=%s" % [takeoffs, _jump_peak, _player.is_on_floor()])
	await _place(Vector3(-4, 0.05, 10))
	await _walk(KEY_D, 65)
	if _player.position.x < -0.4 or _player.position.y < 0.17 or _player.position.y > 0.235:
		_fail("No subió bordillo 0.2m: %s" % _player.position)
	var curb_y: float = _player.position.y
	await _place(Vector3(-4, 0.05, -10))
	await _walk(KEY_D, 100)
	if _player.position.x > -1.75 or _player.position.y > 0.04:
		_fail("Subió pared 0.6m: %s" % _player.position)
	await _place(Vector3(-5, 0.05, -20))
	_key(KEY_SHIFT, true)
	await _walk(KEY_D, 120)
	_key(KEY_SHIFT, false)
	if _player.position.x > -0.5 or _player.position.y < -0.02:
		_fail("Carrera atravesó muro: %s" % _player.position)
	await _place(Vector3(-4, 0.05, -30))
	await _walk(KEY_D, 100)
	if _player.position.x > -1.75 or _player.position.y > 0.04:
		_fail("Escalón atravesó techo bajo: %s" % _player.position)
	await _place(Vector3(-4, 0.05, 20))
	await _walk(KEY_D, 85)
	if _player.position.x < 0.0 or _player.position.y < 1.6 or not _player.is_on_floor():
		_fail("Rampa30 no transitable: %s" % _player.position)
	var ramp_y: float = _player.position.y
	await _place(Vector3(-4, 0.05, 30))
	await _walk(KEY_D, 100)
	if _player.position.x > -2.4 or _player.position.y > 0.3:
		_fail("Subió rampa60: %s" % _player.position)
	await _place(Vector3(-4, 0.05, -40))
	await _walk(KEY_D, 100)
	if _player.position.x > -0.65 or _player.position.y > 0.04:
		_fail("Atravesó o subió peatón: %s" % _player.position)
	if _failed:
		quit(1)
		return
	print("PLAYER_PHYSICS_OK checks=%d walk_speed=%.3f jump_peak=%.4f takeoffs=%d curb_y=%.4f ramp30_y=%.4f: pared0.6, sprint_muro, techo, rampa60, peatón" % [_checks, walking_speed, _jump_peak, takeoffs, curb_y, ramp_y])
	quit(0)


func _place(at: Vector3) -> void:
	_key(KEY_D, false)
	_player.position = at
	_player.velocity = Vector3.ZERO
	_player.reset_physics_interpolation()
	_player.avoidance_agent.set_velocity_forced(Vector3.ZERO)
	for tick in range(18):
		await physics_frame


func _walk(key: Key, ticks: int) -> void:
	_key(key, true)
	for tick in range(ticks):
		await physics_frame
		_checks += 1
		if _player.position.y < -0.02:
			_fail("Caída: %s" % _player.position)
	_key(key, false)
	await physics_frame


func _key(key: Key, pressed: bool) -> void:
	var event := InputEventKey.new()
	event.physical_keycode = key
	event.keycode = key
	event.pressed = pressed
	Input.parse_input_event(event)


func _box(at: Vector3, size: Vector3) -> void:
	var body := StaticBody3D.new()
	body.position = at
	body.collision_layer = 1
	var collider := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	collider.shape = shape
	body.add_child(collider)
	_world.add_child(body)


func _ramp(at: Vector3, degrees: float) -> void:
	var body := StaticBody3D.new()
	body.position = at
	var shape := ConvexPolygonShape3D.new()
	var height: float = 6.0 * tan(deg_to_rad(degrees))
	shape.points = PackedVector3Array([Vector3(-3, 0, -2), Vector3(-3, 0, 2), Vector3(3, 0, -2), Vector3(3, 0, 2), Vector3(3, height, -2), Vector3(3, height, 2)])
	var collider := CollisionShape3D.new()
	collider.shape = shape
	body.add_child(collider)
	_world.add_child(body)


func _fail(message: String) -> void:
	_failed = true
	push_error("PLAYER_PHYSICS_FAILED: " + message)
