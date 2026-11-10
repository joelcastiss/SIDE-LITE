extends SceneTree
## La reposición busca slots alternativos y rechaza puntos sin apoyo o bloqueados.


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var world: Node3D = (load("res://scenes/Main.tscn") as PackedScene).instantiate() as Node3D
	root.add_child(world)
	for frame in range(24):
		await physics_frame
	var manager: NPCManager = world.get_node("NpcSpawner") as NPCManager
	manager.set_process(false)
	var original_points: Array[Vector3] = manager.spawn_positions.duplicate()
	var population: Array[ShopNpc] = manager.get_population()
	for index: int in range(population.size()):
		population[index].set_state(ShopNpc.State.IDLE)
		population[index].wait_timer.stop()
		population[index].global_position = original_points[index] + Vector3.UP * 0.05
	population[-1].queue_free()
	for frame in range(3):
		await physics_frame
	var observer := Node3D.new()
	world.add_child(observer)
	observer.global_position = Vector3(500, 0, 500)
	manager._observer = observer
	# Sin cámara activa, conservar la condición de distancia y aislar selección de slots.
	for camera: Node in world.find_children("*", "Camera3D", true, false):
		(camera as Camera3D).current = false
	manager._spawn_index = 0
	manager._spawn_one(false)
	if manager.get_population().size() != 24:
		_fail("Primer slot ocupado impidió usar la plaza libre")
		return
	var last: ShopNpc = manager.get_population()[-1]
	if last.global_position.distance_to(original_points[-1]) > 0.15:
		_fail("Reposición no utilizó el punto libre apoyado")
		return
	last.queue_free()
	await physics_frame
	manager.spawn_positions = [Vector3(1000, 0, 1000), Vector3(-34, 0, -34)]
	manager._spawn_one(false)
	if manager.get_population().size() != 23:
		_fail("Se creó NPC fuera del mapa o dentro de edificio")
		return
	print("NPC_SPAWNING_OK: primer slot ocupado, punto alternativo, rechazo fuera mapa y sólido")
	quit(0)


func _fail(message: String) -> void:
	push_error("NPC_SPAWNING_FAILED: " + message)
	quit(1)
