extends SceneTree

# Prueba de integración: escenas, malla, aforo y visita completa de un NPC.
func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var world := load("res://scenes/Main.tscn").instantiate() as Node3D
	root.add_child(world)
	for frame in range(24):
		await physics_frame
	var region := world.get_node("NavigationRegion3D") as NavigationRegion3D
	var shop := world.get_node("Shop")
	var spawner := world.get_node("NpcSpawner")
	if region.navigation_mesh == null or region.navigation_mesh.get_polygon_count() < 100:
		_fail("Malla de navegación ausente")
		return
	var path := NavigationServer3D.map_get_path(world.get_world_3d().navigation_map, Vector3(-20, 0, 15), shop.get_entry_point(), true)
	if path.size() < 2:
		_fail("No hay ruta desde la calle hasta la tienda")
		return
	var visitors: Array[Node3D] = []
	# La población persistente ya ocupa plazas; completar sólo las libres.
	var available_capacity: int = shop.max_capacity - shop._occupants.size()
	for i in range(available_capacity):
		var visitor := Node3D.new()
		visitors.append(visitor)
		if not shop.try_enter(visitor):
			_fail("Aforo rechazó una plaza disponible")
			return
	var excess_visitor := Node3D.new()
	var exceeded_capacity: bool = shop.try_enter(excess_visitor)
	excess_visitor.free()
	if exceeded_capacity:
		_fail("Aforo permitió superar el máximo")
		return
	for visitor in visitors:
		shop.exit_shop(visitor)
		visitor.free()
	var reached_browse := false
	var reached_exit := false
	for npc in spawner.get_children():
		npc.walk_speed = 18.0
		npc.navigation_agent.max_speed = 18.0
		npc.browse_min_seconds = 0.05
		npc.browse_max_seconds = 0.10
	for frame in range(720):
		await physics_frame
		for npc in spawner.get_children():
			reached_browse = reached_browse or npc.state == npc.State.BROWSE
			reached_exit = reached_exit or npc.state == npc.State.EXIT_SHOP
		if reached_browse and reached_exit:
			print("SMOKE OK: malla, ruta, aforo y ciclo NPC")
			quit(0)
			return
	_fail("NPC no completó visita: browse=%s exit=%s" % [reached_browse, reached_exit])


func _fail(message: String) -> void:
	push_error("SMOKE FAILED: " + message)
	quit(1)
