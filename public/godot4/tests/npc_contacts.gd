extends SceneTree
## Regresión de contactos: NPC quieto, LOD lejano y jugador prioritario.

var _minimum: float = INF


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var world: Node3D = (load("res://scenes/Main.tscn") as PackedScene).instantiate() as Node3D
	root.add_child(world)
	for frame in range(24):
		await physics_frame
	var manager: NPCManager = world.get_node("NpcSpawner") as NPCManager
	manager.set_process(false)
	var population: Array[ShopNpc] = manager.get_population()
	for index: int in range(population.size()):
		var npc: ShopNpc = population[index]
		npc.set_state(ShopNpc.State.IDLE)
		npc.wait_timer.stop()
		npc.global_position = Vector3(-16.0 + index * 1.0, 0.05, 18.0)
		npc.shop_visit_chance = 0.0
	var mover: ShopNpc = population[0]
	var blocker: ShopNpc = population[1]
	var player: WorldPlayer = world.get_node("Player") as WorldPlayer
	player.global_position = Vector3(10, 0.05, 10)
	blocker.global_position = Vector3(-7, 0.05, 10)
	blocker.set_full_detail(false)
	if not blocker.navigation_agent.avoidance_enabled:
		_fail("NPC IDLE lejano desapareció de RVO")
		return
	if not await _pass_blocker(mover, blocker, Vector3(-10, 0.05, 10), Vector3(-4, 0, 10)):
		return
	# Obstáculo dinámico que no participa en RVO: exigir recuperación por progreso.
	blocker.navigation_agent.avoidance_enabled = false
	if not await _pass_blocker(mover, blocker, Vector3(-10, 0.05, 10), Vector3(-4, 0, 10)):
		return
	blocker.navigation_agent.avoidance_enabled = true
	blocker.global_position = Vector3(0, 0.05, 18)
	player.global_position = Vector3(-7, 0.05, 10)
	if not await _pass_blocker(mover, player, Vector3(-10, 0.05, 10), Vector3(-4, 0, 10)):
		return
	# Dos peatones con destinos opuestos deben ceder espacio sin atravesarse.
	player.global_position = Vector3(10, 0.05, 10)
	mover.global_position = Vector3(-10, 0.05, 10)
	blocker.global_position = Vector3(-4, 0.05, 10)
	mover.set_state(ShopNpc.State.PATROL)
	blocker.set_state(ShopNpc.State.PATROL)
	mover._set_destination(Vector3(-4, 0, 10))
	blocker._set_destination(Vector3(-10, 0, 10))
	for frame in range(480):
		await physics_frame
		if not _check_separation(mover, blocker):
			return
		if mover.global_position.x > -5 and blocker.global_position.x < -9:
			print("NPC_CONTACTS_OK: quieto lejano, recuperación bloqueo, jugador y cruce frontal; distancia mínima=%.4f m" % _minimum)
			quit(0)
			return
	_fail("Cruce frontal bloqueado: %s / %s" % [mover.global_position, blocker.global_position])


func _pass_blocker(mover: ShopNpc, blocker: CharacterBody3D, origin: Vector3, target: Vector3) -> bool:
	mover.global_position = origin
	mover.velocity = Vector3.ZERO
	mover.set_state(ShopNpc.State.PATROL)
	mover._set_destination(target)
	mover.set_full_detail(false)
	for frame in range(600):
		await physics_frame
		if not _check_separation(mover, blocker):
			return false
		if mover.global_position.x > target.x - 0.7:
			mover.set_state(ShopNpc.State.IDLE)
			mover.wait_timer.stop()
			return true
	_fail("NPC atascado frente a %s: %s" % [blocker.name, mover.global_position])
	return false


func _check_separation(first: CharacterBody3D, second: CharacterBody3D) -> bool:
	var offset: Vector3 = first.global_position - second.global_position
	offset.y = 0.0
	_minimum = minf(_minimum, offset.length())
	if offset.length() < 0.64:
		_fail("Cápsulas superpuestas: %.4f m" % offset.length())
		return false
	if first.global_position.y < -0.05:
		_fail("NPC perdió el suelo")
		return false
	return true


func _fail(message: String) -> void:
	push_error("NPC_CONTACTS_FAILED: " + message)
	quit(1)
