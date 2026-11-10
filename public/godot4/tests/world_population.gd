extends SceneTree
## Contrato de población: cobertura inicial, identidades persistentes y LOD sin saltos.


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var world: Node3D = (load("res://scenes/Main.tscn") as PackedScene).instantiate() as Node3D
	root.add_child(world)
	var manager: NPCManager = world.get_node("NpcSpawner") as NPCManager
	var population: Array[ShopNpc] = manager.get_population()
	if population.size() != 24:
		_fail("Deben existir 24 NPC antes del primer frame; encontrados %d" % population.size())
		return
	var identities: Array[int] = []
	var origins: Dictionary = {}
	var sectors: Dictionary = {"norte": 0, "sur": 0, "este": 0, "oeste": 0, "tienda": 0}
	for npc: ShopNpc in population:
		identities.append(npc.get_instance_id())
		origins[npc.get_instance_id()] = npc.global_position
		if npc.global_position.z < -30.0:
			sectors.norte += 1
		if npc.global_position.z > 30.0:
			sectors.sur += 1
		if npc.global_position.x > 30.0:
			sectors.este += 1
		if npc.global_position.x < -30.0:
			sectors.oeste += 1
		if absf(npc.global_position.x) < 5.0 and absf(npc.global_position.z) < 4.0:
			sectors.tienda += 1
	for sector: String in sectors:
		if sectors[sector] < 2:
			_fail("Falta cobertura inicial en %s" % sector)
			return
	for frame in range(24):
		await physics_frame
	var shop: Node3D = world.get_node("Shop") as Node3D
	if shop._occupants.size() < 2:
		_fail("La tienda no tiene ocupantes iniciales independientes del jugador")
		return
	var observer: Node3D = Node3D.new()
	world.add_child(observer)
	manager._observer = observer
	observer.global_position = Vector3(500, 0, 500)
	manager._update_detail()
	for npc: ShopNpc in population:
		if npc.full_detail or npc.animation_tree.active or not npc.visible:
			_fail("El LOD lejano no suspendió animación o hizo desaparecer un NPC")
			return
	for frame in range(120):
		await physics_frame
	var movers: int = 0
	for npc: ShopNpc in population:
		var origin: Vector3 = origins[npc.get_instance_id()]
		if npc.global_position.distance_to(origin) > 0.5:
			movers += 1
	if movers < 16:
		_fail("El LOD lejano detuvo la población: sólo %d NPC se movieron" % movers)
		return
	var first: ShopNpc = population[0]
	observer.global_position = first.global_position
	manager._update_detail()
	if not first.full_detail or not first.animation_tree.active:
		_fail("El NPC no recuperó el detalle al acercarse")
		return
	observer.global_position = first.global_position + Vector3(manager.detail_distance + manager.detail_hysteresis * 0.5, 0, 0)
	manager._update_detail()
	if not first.full_detail:
		_fail("La histéresis no conserva el detalle en la franja intermedia")
		return
	var saw_patrol: bool = false
	var saw_interact: bool = false
	for frame in range(1200):
		await physics_frame
		if manager.get_population().size() != 24:
			_fail("La población cambió durante la simulación")
			return
		for npc: ShopNpc in manager.get_population():
			if not identities.has(npc.get_instance_id()) or not npc.visible:
				_fail("Se reemplazó u ocultó abruptamente un NPC")
				return
			if npc.global_position.y < -0.05:
				_fail("Un NPC cayó bajo el suelo: %s position=%s velocity=%s state=%d detail=%s floor=%s inside_shop=%s slides=%d physics_tick=%d delta=%f terrain_rid=%s frame=%d" % [npc.name, npc.global_position, npc.velocity, npc.state, npc.full_detail, npc.is_on_floor(), npc.inside_shop, npc.get_slide_collision_count(), Engine.get_physics_frames(), npc.get_physics_process_delta_time(), (world.get_node("Ciudad/TerrainCollision") as StaticBody3D).get_rid(), frame])
				return
			saw_patrol = saw_patrol or npc.state == ShopNpc.State.PATROL
			saw_interact = saw_interact or npc.state == ShopNpc.State.INTERACT
		if shop._occupants.size() > shop.max_capacity:
			_fail("Se excedió el aforo de tienda")
			return
	if not saw_patrol or not saw_interact:
		_fail("No se observaron PATROL e INTERACT durante la simulación")
		return
	# La ausencia de Shop tampoco debe impedir que exista población.
	var independent: NPCManager = (load("res://scripts/npc_manager.gd") as GDScript).new() as NPCManager
	independent.max_npcs = 3
	independent.max_initial_npcs = 3
	independent.shop_path = NodePath("TiendaInexistente")
	root.add_child(independent)
	if independent.get_population().size() != 3:
		_fail("La población sigue dependiendo de encontrar Shop")
		return
	independent.queue_free()
	print("WORLD_POPULATION_OK: 24 constantes, cinco sectores, identidades, suelo, FSM, aforo y LOD; %d peatones avanzan lejos" % movers)
	quit(0)


func _fail(message: String) -> void:
	push_error("WORLD_POPULATION_FAILED: " + message)
	quit(1)
