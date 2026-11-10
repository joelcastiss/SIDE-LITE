extends SceneTree
## Aforo completo con destinos únicos, limpieza y cruce bidireccional de puerta.


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var world: Node3D = (load("res://scenes/Main.tscn") as PackedScene).instantiate() as Node3D
	root.add_child(world)
	for frame in range(24):
		await physics_frame
	var manager: NPCManager = world.get_node("NpcSpawner") as NPCManager
	manager.set_process(false)
	var shop: Node3D = world.get_node("Shop") as Node3D
	var npcs: Array[ShopNpc] = manager.get_population()
	for index: int in range(npcs.size()):
		var npc: ShopNpc = npcs[index]
		shop.exit_shop(npc)
		npc.inside_shop = false
		npc.set_state(ShopNpc.State.IDLE)
		npc.wait_timer.stop()
		npc.global_position = Vector3(-16 + index, 0.05, 18)
		npc.shop_visit_chance = 0.0
		npc._rng.seed = 20261009 + index
	var markers: Node3D = shop.get_node("BrowsePoints") as Node3D
	var destinations: Array[Vector3] = []
	for index: int in range(6):
		var npc: ShopNpc = npcs[index]
		npc.global_position = (markers.get_child(index) as Node3D).global_position + Vector3.UP * 0.05
		if not npc._enter_shop():
			_fail("Aforo no aceptó seis compradores")
			return
		npc.browse_stops = 1
		npc.browse_min_seconds = 0.2
		npc.browse_max_seconds = 0.4
		npc._next_browse_stop()
		var destination: Vector3 = npc.navigation_agent.target_position
		for previous: Vector3 in destinations:
			if previous.distance_to(destination) < 0.8:
				_fail("Dos compradores recibieron el mismo destino")
				return
		destinations.append(destination)
	if shop._browse_reservations.size() != 6:
		_fail("No se reservaron seis destinos distintos")
		return
	var excess := Node3D.new()
	world.add_child(excess)
	var excess_point: Vector3 = shop.get_browse_point(excess)
	excess.queue_free()
	if excess_point.is_finite() or shop._browse_reservations.size() != 6:
		_fail("La exhibición llena asignó una reserva solapada")
		return
	var all_exited: bool = false
	for frame in range(1800):
		await physics_frame
		all_exited = true
		for index: int in range(6):
			all_exited = all_exited and not npcs[index].inside_shop
		if all_exited:
			break
	if not all_exited or not shop._browse_reservations.is_empty() or not shop._occupants.is_empty():
		for index: int in range(6):
			print("SHOP_DIAG %s state%d pos%s target%s inside%s" % [npcs[index].name, npcs[index].state, npcs[index].global_position, npcs[index].navigation_agent.target_position, npcs[index].inside_shop])
		_fail("Compradores no salieron o dejaron reservas/aforo ocupados")
		return
	# Preparar dos trayectorias opuestas sin jugador en medio de la abertura.
	for index: int in range(6):
		npcs[index].set_state(ShopNpc.State.IDLE)
		npcs[index].wait_timer.stop()
		npcs[index].global_position = Vector3(-10 + index, 0.05, 18)
	var player: WorldPlayer = world.get_node("Player") as WorldPlayer
	player.global_position = Vector3(2, 0.05, 6)
	var exiting: ShopNpc = npcs[0]
	var entering: ShopNpc = npcs[1]
	exiting.global_position = Vector3(-0.35, 0.05, 3.5)
	entering.global_position = Vector3(0.35, 0.05, 6.3)
	exiting._enter_shop()
	exiting.set_state(ShopNpc.State.EXIT_SHOP)
	exiting._set_destination(shop.get_exit_point())
	entering.set_state(ShopNpc.State.ENTER_SHOP)
	entering._set_destination(shop.get_entry_point())
	var crossed: bool = false
	var minimum: float = INF
	for frame in range(600):
		await physics_frame
		var offset: Vector3 = exiting.global_position - entering.global_position
		offset.y = 0.0
		minimum = minf(minimum, offset.length())
		if offset.length() < 0.64 or exiting.global_position.y < -0.05 or entering.global_position.y < -0.05:
			_fail("Cruce de puerta produjo solapamiento o caída")
			return
		if not exiting.inside_shop and entering.inside_shop and entering.global_position.z < 4.0:
			crossed = true
			break
	if not crossed:
		_fail("Cruce bidireccional bloqueado: %s / %s" % [exiting.global_position, entering.global_position])
		return
	print("NPC_SHOP_TRAFFIC_OK: seis destinos únicos, seis salidas, reservas/aforo liberados, puerta bidireccional; mínimo=%.4fm" % minimum)
	quit(0)


func _fail(message: String) -> void:
	push_error("NPC_SHOP_TRAFFIC_FAILED: " + message)
	quit(1)
