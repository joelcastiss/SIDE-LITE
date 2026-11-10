extends SceneTree
## Comprueba conexión, volumen libre y apoyo real de las rutas del mapa.

var _scene: Node3D
var _space: PhysicsDirectSpaceState3D
var _capsule: CapsuleShape3D
var _routes_checked: int = 0


func _initialize() -> void:
	call_deferred("_check_routes")


func _check_routes() -> void:
	_scene = (load("res://scenes/Main.tscn") as PackedScene).instantiate() as Node3D
	root.add_child(_scene)
	# El servidor integra las regiones al finalizar los fotogramas de física.
	for frame: int in range(24):
		await physics_frame
	var map_rid: RID = _scene.get_world_3d().navigation_map
	_space = _scene.get_world_3d().direct_space_state
	_capsule = CapsuleShape3D.new()
	_capsule.radius = 0.34
	_capsule.height = 1.8
	if NavigationServer3D.map_get_regions(map_rid).size() != 1:
		_fail("NavigationRegion3D no se registró en el mapa")
		return
	var region: NavigationRegion3D = _scene.get_node("NavigationRegion3D") as NavigationRegion3D
	if region.navigation_mesh.get_polygon_count() > 12000:
		_fail("La malla tiene demasiados polígonos para este barrio plano")
		return
	var origin := Vector3(0, 0, 12)
	var destinations: Array[Vector3] = [
		Vector3(-86, 0, -86), Vector3(86, 0, 86),
		Vector3(-86, 0, 86), Vector3(86, 0, -86),
		Vector3(-36, 0, 0), Vector3(36, 0, 0),
		Vector3(0, 0, -36), Vector3(0, 0, 36),
		Vector3(-50, 0, 0), Vector3(50, 0, 0),
		Vector3(0, 0, -50), Vector3(0, 0, 50)
	]
	var shop: Node3D = _scene.get_node("Shop") as Node3D
	destinations.append(shop.get_node("ShopEntry").global_position)
	destinations.append(shop.get_node("ShopExit").global_position)
	for marker: Node in shop.get_node("BrowsePoints").get_children():
		destinations.append((marker as Node3D).global_position)
	for destination: Vector3 in destinations:
		if not _check_route(map_rid, origin, destination):
			return
	# Todos los ejes viales se cruzan desde ambos lados, lejos y cerca de la tienda.
	for coordinate: float in [-76.0, -24.0, 24.0, 76.0]:
		for transverse: float in [-50.0, 0.0, 50.0]:
			if not _check_route(map_rid, Vector3(coordinate - 7, 0, transverse), Vector3(coordinate + 7, 0, transverse)):
				return
			if not _check_route(map_rid, Vector3(transverse, 0, coordinate - 7), Vector3(transverse, 0, coordinate + 7)):
				return
	# Ambos laterales del fondo deben conectarse por el pasillo libre.
	if not _check_route(map_rid, Vector3(-3.4, 0, -2.8), Vector3(3.4, 0, -2.8)):
		return
	print("NAVIGATION_OK: %d rutas con cápsula libre y suelo; %d polígonos, %d obstáculos" % [_routes_checked, region.navigation_mesh.get_polygon_count(), int(region.get_meta("obstacle_count", 0))])
	quit(0)


func _check_route(map_rid: RID, origin: Vector3, destination: Vector3) -> bool:
	var path: PackedVector3Array = NavigationServer3D.map_get_path(map_rid, origin, destination, true)
	if path.size() < 2 or path[0].distance_to(origin) > 0.15 or path[-1].distance_to(destination) > 0.15:
		_fail("Ruta interrumpida o punto inaccesible: %s -> %s; ruta=%s" % [origin, destination, path])
		return false
	for index: int in range(path.size() - 1):
		var from: Vector3 = path[index]
		var to: Vector3 = path[index + 1]
		var query := PhysicsShapeQueryParameters3D.new()
		query.shape = _capsule
		query.collision_mask = 1
		query.transform = Transform3D(Basis.IDENTITY, Vector3(from.x, 0.91, from.z))
		query.motion = Vector3(to.x - from.x, 0, to.z - from.z)
		if not _space.intersect_shape(query, 1).is_empty():
			_fail("Ruta nace dentro de un sólido: %s -> %s" % [from, to])
			return false
		var motion: PackedFloat32Array = _space.cast_motion(query)
		if motion[0] < 0.9999:
			_fail("Ruta atraviesa colisión física: %s -> %s" % [from, to])
			return false
		var samples: int = maxi(1, ceili(from.distance_to(to)))
		for sample: int in range(samples + 1):
			var point: Vector3 = from.lerp(to, float(sample) / float(samples))
			var ray := PhysicsRayQueryParameters3D.create(Vector3(point.x, 0.15, point.z), Vector3(point.x, -0.25, point.z), 1)
			var hit: Dictionary = _space.intersect_ray(ray)
			if hit.is_empty() or absf((hit.position as Vector3).y) > 0.015:
				_fail("Ruta sin apoyo al nivel del suelo: %s" % point)
				return false
	_routes_checked += 1
	return true


func _fail(message: String) -> void:
	push_error("NAVIGATION_FAILED: " + message)
	quit(1)
