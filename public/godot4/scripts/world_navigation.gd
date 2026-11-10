extends RefCounted
## Navegación plana derivada de los sólidos reales del barrio y la tienda.

const HALF_MAP: float = 88.0
const AGENT_RADIUS: float = 0.45
const AGENT_HEIGHT: float = 1.8
const NAV_HEIGHT: float = 0.01
const CELL_SIZE: float = 0.01


static func build(region: NavigationRegion3D, source_root: Node3D) -> void:
	# Los polígonos manuales no aplican agent_radius: el margen se calcula aquí.
	# Reservar también el grosor interior de la valla perimetral.
	var extent: float = HALF_MAP - AGENT_RADIUS - 0.2
	var obstacles: Array[Rect2] = _collect_obstacles(source_root)
	var cuts_x: Array[float] = [-extent, extent]
	var cuts_z: Array[float] = [-extent, extent]
	for obstacle: Rect2 in obstacles:
		cuts_x.append(clampf(obstacle.position.x, -extent, extent))
		cuts_x.append(clampf(obstacle.end.x, -extent, extent))
		cuts_z.append(clampf(obstacle.position.y, -extent, extent))
		cuts_z.append(clampf(obstacle.end.y, -extent, extent))
	cuts_x = _unique_sorted(cuts_x)
	cuts_z = _unique_sorted(cuts_z)
	var navmesh := NavigationMesh.new()
	navmesh.cell_size = CELL_SIZE
	navmesh.agent_radius = AGENT_RADIUS
	navmesh.agent_height = AGENT_HEIGHT
	var vertices := PackedVector3Array()
	for z: float in cuts_z:
		for x: float in cuts_x:
			vertices.append(region.to_local(source_root.to_global(Vector3(x, NAV_HEIGHT, z))))
	navmesh.vertices = vertices
	# Cortes solo en bordes de obstáculos: evita una cuadrícula fina de todo el mapa.
	var width: int = cuts_x.size()
	for z: int in range(cuts_z.size() - 1):
		for x: int in range(width - 1):
			var center := Vector2((cuts_x[x] + cuts_x[x + 1]) * 0.5, (cuts_z[z] + cuts_z[z + 1]) * 0.5)
			if _blocked(center, obstacles):
				continue
			var a: int = z * width + x
			navmesh.add_polygon(PackedInt32Array([a, a + width, a + width + 1, a + 1]))
	var map_rid: RID = source_root.get_world_3d().navigation_map
	NavigationServer3D.map_set_cell_size(map_rid, CELL_SIZE)
	region.navigation_mesh = navmesh
	region.set_meta("obstacle_count", obstacles.size())


static func _collect_obstacles(source_root: Node3D) -> Array[Rect2]:
	var result: Array[Rect2] = []
	for node: Node in source_root.find_children("*", "StaticBody3D", true, false):
		var body: StaticBody3D = node as StaticBody3D
		if body.collision_layer & 1 == 0:
			continue
		for child: Node in body.get_children():
			var collider: CollisionShape3D = child as CollisionShape3D
			if collider == null or collider.disabled or not collider.shape is BoxShape3D:
				continue
			var box: BoxShape3D = collider.shape as BoxShape3D
			var local_transform: Transform3D = source_root.global_transform.affine_inverse() * collider.global_transform
			var bounds: AABB = local_transform * AABB(-box.size * 0.5, box.size)
			# Excluir el piso continuo y elementos por encima de la cabeza del agente.
			if bounds.end.y <= 0.02 or bounds.position.y >= AGENT_HEIGHT:
				continue
			var minimum := Vector2(bounds.position.x, bounds.position.z) - Vector2.ONE * AGENT_RADIUS
			var maximum := Vector2(bounds.end.x, bounds.end.z) + Vector2.ONE * AGENT_RADIUS
			# Redondear hacia fuera conserva el margen y evita aristas casi duplicadas.
			minimum = Vector2(floorf(minimum.x / CELL_SIZE), floorf(minimum.y / CELL_SIZE)) * CELL_SIZE
			maximum = Vector2(ceilf(maximum.x / CELL_SIZE), ceilf(maximum.y / CELL_SIZE)) * CELL_SIZE
			result.append(Rect2(minimum, maximum - minimum))
	return result


static func _unique_sorted(values: Array[float]) -> Array[float]:
	values.sort()
	var result: Array[float] = []
	for value: float in values:
		if result.is_empty() or not is_equal_approx(result[-1], value):
			result.append(value)
	return result


static func _blocked(point: Vector2, obstacles: Array[Rect2]) -> bool:
	for obstacle: Rect2 in obstacles:
		if obstacle.has_point(point):
			return true
	return false
