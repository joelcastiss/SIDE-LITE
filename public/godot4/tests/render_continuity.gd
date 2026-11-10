extends SceneTree
## Regresión de continuidad: geometría presente y cámaras sin cortes a distancia.
## Complementar con las capturas GPU; headless no demuestra ausencia de artefactos.

var _failure: String = ""
var _geometry_count: int = 0
var _camera_count: int = 0


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var world: Node3D = (load("res://scenes/Main.tscn") as PackedScene).instantiate() as Node3D
	root.add_child(world)
	for frame in range(24):
		await physics_frame
	_check_nodes(world)
	var manager: NPCManager = world.get_node("NpcSpawner") as NPCManager
	if manager.get_population().size() != 24:
		_failure = "No existen 24 habitantes antes de recorrer el mundo"
	# Alternar detalle desde extremos nunca debe retirar la geometría de un vecino.
	var player: WorldPlayer = world.get_node("Player") as WorldPlayer
	for position: Vector3 in [Vector3(-85, 0.05, -85), Vector3(85, 0.05, 85), Vector3(0, 0.05, 12)]:
		player.global_position = position
		player.reset_physics_interpolation()
		manager.call("_update_detail")
		for npc: ShopNpc in manager.get_population():
			if not npc.is_visible_in_tree():
				_failure = "LOD oculta un vecino: " + str(npc.get_path())
	if not _failure.is_empty():
		push_error("RENDER_CONTINUITY_FAILED: " + _failure)
		quit(1)
		return
	print("RENDER_CONTINUITY_OK geometries=%d cameras=%d, sin hard cutoffs, 24 NPC visibles desde 3 sectores" % [_geometry_count, _camera_count])
	quit(0)


func _check_nodes(node: Node) -> void:
	if node is GeometryInstance3D:
		var geometry := node as GeometryInstance3D
		_geometry_count += 1
		if geometry.visibility_range_begin > 0.0 or geometry.visibility_range_end > 0.0:
			_failure = "Corte de geometría por distancia: " + str(node.get_path())
		if not geometry.is_visible_in_tree():
			_failure = "Geometría oculta: " + str(node.get_path())
		if geometry.layers & 1 == 0:
			_failure = "Geometría fuera de la capa visible del mundo: " + str(node.get_path())
	if node is Camera3D:
		var camera := node as Camera3D
		_camera_count += 1
		# Desde cualquier borde, la diagonal del mapa cabe dentro de far=280 m.
		if camera.far < 260.0 or camera.cull_mask & 1 == 0:
			_failure = "Cámara recorta el barrio o su capa: " + str(node.get_path())
	for child: Node in node.get_children():
		_check_nodes(child)
