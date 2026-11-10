extends Node3D
class_name NPCManager
## Población persistente del mundo; la puerta nunca genera ni elimina personas.

@export var shop_path: NodePath = NodePath("../Shop")
@export var observer_path: NodePath = NodePath("../Player")
@export_range(1, 100, 1) var max_npcs: int = 24
@export_range(0, 100, 1) var max_initial_npcs: int = 24
@export_range(0.5, 60.0, 0.5) var spawn_interval: float = 4.0
@export_range(10.0, 180.0, 1.0) var detail_distance: float = 70.0
@export_range(1.0, 40.0, 1.0) var detail_hysteresis: float = 12.0
@export var spawn_positions: Array[Vector3] = [
	Vector3(-20, 0, 15), Vector3(19, 0, 16),
	Vector3(-3.2, 0, 2.2), Vector3(3.2, 0, 2.2),
	Vector3(-36, 0, 0), Vector3(36, 0, 0),
	Vector3(0, 0, -36), Vector3(0, 0, 36),
	Vector3(-76, 0, -12), Vector3(76, 0, 12),
	Vector3(-12, 0, -76), Vector3(12, 0, 76),
	Vector3(-50, 0, -50), Vector3(50, 0, 50),
	Vector3(-50, 0, 50), Vector3(50, 0, -50),
	Vector3(-76, 0, 52), Vector3(76, 0, -52),
	Vector3(-52, 0, -76), Vector3(52, 0, 76),
	Vector3(-24, 0, -48), Vector3(24, 0, 48),
	Vector3(-48, 0, 24), Vector3(48, 0, -24)
]

const NPC_SCENE: PackedScene = preload("res://scenes/Npc.tscn")
const COLORS: Array[Color] = [
	Color("719ab2"), Color("bd7b85"), Color("a39b6b"),
	Color("8a79ae"), Color("75a285"), Color("b98968")
]

var _shop: Node3D
var _observer: Node3D
var _spawn_index: int = 0
var _lod_elapsed: float = 0.0
var _spawn_elapsed: float = 0.0


func _ready() -> void:
	add_to_group("npc_managers")
	_shop = get_node_or_null(shop_path) as Node3D
	# La población completa existe desde _ready, incluso sin tienda o jugador.
	for index in range(mini(max_initial_npcs, max_npcs)):
		_spawn_one(true)


func _process(delta: float) -> void:
	_lod_elapsed += delta
	_spawn_elapsed += delta
	if _lod_elapsed >= 0.5:
		_lod_elapsed = 0.0
		_update_detail()
	if _spawn_elapsed >= maxf(0.5, spawn_interval):
		_spawn_elapsed = 0.0
		if get_population().size() < max_npcs:
			_spawn_one(false)


func get_population() -> Array[ShopNpc]:
	var population: Array[ShopNpc] = []
	for child: Node in get_children():
		if child is ShopNpc:
			population.append(child as ShopNpc)
	return population


func _spawn_one(initial: bool) -> void:
	if spawn_positions.is_empty() or get_population().size() >= max_npcs:
		return
	var slot: int = _spawn_index % spawn_positions.size()
	var camera: Camera3D = get_viewport().get_camera_3d()
	var found: bool = false
	var spawn: Vector3 = Vector3.ZERO
	var population: Array[ShopNpc] = get_population()
	for offset in range(spawn_positions.size()):
		var candidate_slot: int = (_spawn_index + offset) % spawn_positions.size()
		var candidate: Vector3 = to_global(spawn_positions[candidate_slot])
		var occupied: bool = false
		for other: ShopNpc in population:
			if other.global_position.distance_to(candidate) < 1.1:
				occupied = true
				break
		if occupied:
			continue
		if not initial:
			# Buscar todos los puntos libres; nunca reponer dentro del encuadre.
			if camera != null and camera.is_position_in_frustum(candidate + Vector3.UP):
				continue
			if candidate.distance_to(_observer_position()) < detail_distance + detail_hysteresis:
				continue
			var supported: Vector3 = _supported_spawn(candidate)
			if not supported.is_finite():
				continue
			candidate = supported
		slot = candidate_slot
		spawn = to_local(candidate)
		found = true
		break
	if not found:
		return
	var npc: ShopNpc = NPC_SCENE.instantiate() as ShopNpc
	npc.name = "Vecino_%02d" % _spawn_index
	# Separación inicial para que la cápsula se asiente desde arriba de la losa.
	npc.position = spawn + Vector3.UP * 0.05
	# Sólo el grupo central visita la tienda; los barrios conservan sus peatones.
	npc.shop_visit_chance = 0.35 if slot < 4 else 0.0
	npc.wander_radius = 18.0
	npc.configure(_shop, COLORS[_spawn_index % COLORS.size()])
	add_child(npc)
	_spawn_index += 1
	npc.call_deferred("start_persistent_life", slot == 0, slot == 2 or slot == 3)


func _supported_spawn(candidate: Vector3) -> Vector3:
	# Sólo reposiciones: al arrancar Main todavía está construyendo sus sólidos.
	var invalid: Vector3 = Vector3(INF, INF, INF)
	var map_rid: RID = get_world_3d().navigation_map
	if NavigationServer3D.map_get_iteration_id(map_rid) == 0:
		return invalid
	var projected: Vector3 = NavigationServer3D.map_get_closest_point(map_rid, candidate)
	if projected.distance_to(candidate) > 0.30:
		return invalid
	var space: PhysicsDirectSpaceState3D = get_world_3d().direct_space_state
	var ray := PhysicsRayQueryParameters3D.create(projected + Vector3.UP * 0.5, projected - Vector3.UP, 1)
	var ground: Dictionary = space.intersect_ray(ray)
	if ground.is_empty() or (ground.normal as Vector3).dot(Vector3.UP) < cos(deg_to_rad(45.0)):
		return invalid
	var supported: Vector3 = ground.position as Vector3
	if absf(supported.y - projected.y) > 0.25:
		return invalid
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.34
	capsule.height = 1.8
	var query := PhysicsShapeQueryParameters3D.new()
	query.shape = capsule
	query.collision_mask = 7
	query.transform = Transform3D(Basis.IDENTITY, supported + Vector3.UP * 0.95)
	return supported if space.intersect_shape(query, 1).is_empty() else invalid


func _observer_position() -> Vector3:
	if not is_instance_valid(_observer):
		_observer = get_node_or_null(observer_path) as Node3D
		if _observer == null:
			_observer = get_tree().get_first_node_in_group("player") as Node3D
	if _observer != null:
		return _observer.global_position
	var camera: Camera3D = get_viewport().get_camera_3d()
	return camera.global_position if camera != null else global_position


func _update_detail() -> void:
	var focus: Vector3 = _observer_position()
	for npc: ShopNpc in get_population():
		var offset: Vector3 = npc.global_position - focus
		offset.y = 0.0
		var distance: float = offset.length()
		if npc.full_detail and distance > detail_distance + detail_hysteresis:
			npc.set_full_detail(false)
		elif not npc.full_detail and distance < detail_distance:
			npc.set_full_detail(true)
