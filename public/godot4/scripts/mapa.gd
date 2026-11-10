extends Node3D

const WorldNavigation = preload("res://scripts/world_navigation.gd")
const WorldAmbience = preload("res://scripts/world_ambience.gd")

## Ciudad transitable. La tienda está en el origen y su puerta sur en z=5.
const HALF_MAP := 88.0
const NAV_STEP := 4.0
const BUILDING_CENTERS := [-62.0, -34.0, 34.0, 62.0]
const BUILDING_WIDTH := 14.0
const BUILDING_DEPTH := 16.0

@onready var navigation_region: NavigationRegion3D = $NavigationRegion3D

var _city: Node3D
var _materials: Dictionary = {}


func _ready() -> void:
	_city = Node3D.new()
	_city.name = "Ciudad"
	add_child(_city)
	_make_materials()
	_make_environment()
	_make_ground_and_roads()
	_make_buildings()
	_make_plazas()
	_make_street_furniture()
	_make_vegetation()
	WorldAmbience.configure(self, _city, _materials)
	_make_navigation_mesh()


func _material(color: Color, roughness: float = 0.9, metallic: float = 0.0) -> StandardMaterial3D:
	var result := StandardMaterial3D.new()
	result.albedo_color = color
	result.roughness = roughness
	result.metallic = metallic
	return result


func _make_materials() -> void:
	_materials = {
		"grass": _material(Color("638663")),
		"road": _material(Color("444b50")),
		"paving": _material(Color("c8c2b4")),
		"line": _material(Color("e9e4d6")),
		"brick": _material(Color("ae8775")),
		"sand": _material(Color("d3c0a3")),
		"blue": _material(Color("91a7ae")),
		"roof": _material(Color("58656a"), 0.65, 0.2),
		"glass": _material(Color("79a5b7"), 0.2, 0.15),
		"wood": _material(Color("825f43")),
		"metal": _material(Color("323b40"), 0.45, 0.65),
		"leaves": _material(Color("477a52")),
		"leaves_light": _material(Color("6c985e"))
	}


func _box(name: String, position: Vector3, size: Vector3, material: Material, parent: Node3D = _city, collision: bool = false) -> MeshInstance3D:
	var mesh := MeshInstance3D.new()
	mesh.name = name
	var box := BoxMesh.new()
	box.size = size
	mesh.mesh = box
	mesh.material_override = material
	mesh.position = position
	mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	# El barrio completo conserva su geometría; ningún sólido se oculta por distancia.
	parent.add_child(mesh)
	if collision:
		_solid_box(name + "Collision", position, size, parent)
	return mesh


func _solid_box(node_name: String, at: Vector3, size: Vector3, parent: Node3D = _city) -> void:
	# El tamaño vive en Shape3D: no escalar nodos físicos ni la cápsula del actor.
	var body := StaticBody3D.new()
	body.name = node_name
	body.position = at
	body.collision_layer = 1
	body.collision_mask = 6
	var collider := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = size
	collider.shape = box
	body.add_child(collider)
	parent.add_child(body)


func _make_environment() -> void:
	var sky_material := ProceduralSkyMaterial.new()
	sky_material.sky_top_color = Color("6e9bc2")
	sky_material.sky_horizon_color = Color("c6d7dc")
	sky_material.ground_bottom_color = Color("61705c")
	var sky := Sky.new()
	sky.sky_material = sky_material
	var environment := Environment.new()
	environment.background_mode = Environment.BG_SKY
	environment.sky = sky
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	environment.reflected_light_source = Environment.REFLECTION_SOURCE_BG
	environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	environment.fog_enabled = true
	environment.fog_light_color = Color("c4d4d7")
	environment.fog_density = 0.003
	var world := WorldEnvironment.new()
	world.name = "WorldEnvironment"
	world.environment = environment
	add_child(world)
	var sun := DirectionalLight3D.new()
	sun.name = "Sun"
	sun.rotation_degrees = Vector3(-48.0, -30.0, 0.0)
	sun.light_energy = 1.45
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 100.0
	add_child(sun)


func _make_ground_and_roads() -> void:
	# Una sola losa sólida evita juntas físicas entre terreno, calle y acera.
	# Las capas decorativas se separan milímetros para evitar parpadeo de profundidad.
	_box("Terrain", Vector3(0, -0.2, 0), Vector3(176, 0.4, 176), _materials.grass, _city, true)
	# Tres bucles viales dan acceso al centro desde todos los bordes del mapa.
	var unit_box := BoxMesh.new()
	for coordinate in [-76.0, -24.0, 24.0, 76.0]:
		_box("Road_NS", Vector3(coordinate, -0.019, 0), Vector3(9, 0.04, 176), _materials.road)
		_box("Road_EW", Vector3(0, -0.018, coordinate), Vector3(176, 0.04, 9), _materials.road)
		var lane_ns_near: Array[Transform3D] = []
		var lane_ns_far: Array[Transform3D] = []
		var lane_ew_near: Array[Transform3D] = []
		var lane_ew_far: Array[Transform3D] = []
		for stripe in range(-84, 85, 8):
			if stripe < 0:
				lane_ns_near.append(_box_transform(Vector3(coordinate, 0.003, stripe), Vector3(0.13, 0.002, 3.3)))
				lane_ew_near.append(_box_transform(Vector3(stripe, 0.003, coordinate), Vector3(3.3, 0.002, 0.13)))
			else:
				lane_ns_far.append(_box_transform(Vector3(coordinate, 0.003, stripe), Vector3(0.13, 0.002, 3.3)))
				lane_ew_far.append(_box_transform(Vector3(stripe, 0.003, coordinate), Vector3(3.3, 0.002, 0.13)))
		# Lotes por tramo conservan el descarte por encuadre, sin cortes de distancia.
		_multimesh("LaneMarks_NS", unit_box, _materials.line, lane_ns_near, _city, true)
		_multimesh("LaneMarks_NS", unit_box, _materials.line, lane_ns_far, _city, true)
		_multimesh("LaneMarks_EW", unit_box, _materials.line, lane_ew_near, _city, true)
		_multimesh("LaneMarks_EW", unit_box, _materials.line, lane_ew_far, _city, true)
	# Los paseos centrales conectan la tienda con ambas plazas.
	_box("CentralWalk_EW", Vector3(0, -0.022, 0), Vector3(42, 0.05, 15), _materials.paving)
	_box("CentralWalk_NS", Vector3(0, -0.021, 0), Vector3(15, 0.05, 42), _materials.paving)
	for coordinate in [-50.0, 0.0, 50.0]:
		_box("Sidewalk_NS", Vector3(coordinate, -0.022, 0), Vector3(3.4, 0.05, 176), _materials.paving)
		_box("Sidewalk_EW", Vector3(0, -0.021, coordinate), Vector3(176, 0.05, 3.4), _materials.paving)
	for x in [-24.0, 24.0]:
		for z in [-24.0, 24.0]:
			var crosswalk: Array[Transform3D] = []
			for offset in range(-4, 5):
				crosswalk.append(_box_transform(Vector3(x + offset * 0.85, 0.005, z), Vector3(0.5, 0.002, 7.4)))
			_multimesh("Crosswalk", unit_box, _materials.line, crosswalk, _city, true)


func _make_buildings() -> void:
	var palette := [_materials.brick, _materials.sand, _materials.blue]
	var unit_box := BoxMesh.new()
	var index := 0
	for x in BUILDING_CENTERS:
		for z in BUILDING_CENTERS:
			var height := 8.0 + float((index * 7) % 5) * 2.2
			var building := Node3D.new()
			building.name = "Building_%02d" % index
			building.position = Vector3(x, 0, z)
			_city.add_child(building)
			_box("Facade", Vector3(0, height * 0.5, 0), Vector3(BUILDING_WIDTH, height, BUILDING_DEPTH), palette[index % 3], building, true)
			_box("Roof", Vector3(0, height + 0.18, 0), Vector3(BUILDING_WIDTH + 0.5, 0.36, BUILDING_DEPTH + 0.5), _materials.roof, building)
			# Las ventanas permanecen presentes en toda la extensión del barrio.
			var windows: Array[Transform3D] = []
			for floor_index in range(1, int(height / 3.0)):
				for side in [-1.0, 1.0]:
					for window_x in [-4.5, -1.5, 1.5, 4.5]:
						windows.append(_box_transform(Vector3(window_x, floor_index * 3.0, side * (BUILDING_DEPTH * 0.5 + 0.025)), Vector3(1.5, 1.6, 0.05)))
			# Un lote por edificio mantiene el descarte local por encuadre.
			_multimesh("Windows", unit_box, _materials.glass, windows, building, true)
			index += 1


func _make_plazas() -> void:
	for center in [Vector3(-36, 0, 0), Vector3(36, 0, 0), Vector3(0, 0, -36), Vector3(0, 0, 36)]:
		_box("Plaza", center + Vector3(0, -0.021, 0), Vector3(15, 0.05, 15), _materials.paving)
		_box("Planter", center + Vector3(5.3, 0.28, 5.3), Vector3(2.1, 0.55, 2.1), _materials.brick, _city, true)
		_box("BenchSeat", center + Vector3(-4.2, 0.57, 4.8), Vector3(2.2, 0.14, 0.65), _materials.wood, _city, true)
		_box("BenchBack", center + Vector3(-4.2, 0.96, 5.1), Vector3(2.2, 0.9, 0.12), _materials.wood, _city, true)


func _box_transform(position: Vector3, size: Vector3) -> Transform3D:
	return Transform3D(Basis.IDENTITY.scaled(size), position)


func _multimesh(name: String, mesh: Mesh, material: Material, transforms: Array[Transform3D], parent: Node3D = null, shadows: bool = false) -> void:
	var batch := MultiMesh.new()
	batch.transform_format = MultiMesh.TRANSFORM_3D
	batch.mesh = mesh
	batch.instance_count = transforms.size()
	for i in transforms.size():
		batch.set_instance_transform(i, transforms[i])
	var instance := MultiMeshInstance3D.new()
	instance.name = name
	instance.multimesh = batch
	instance.material_override = material
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if shadows else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	if parent == null:
		_city.add_child(instance)
	else:
		parent.add_child(instance)


func _make_street_furniture() -> void:
	var posts: Array[Transform3D] = []
	var heads: Array[Transform3D] = []
	# Alinear las farolas con las calles, fuera del volumen de los edificios.
	for x in [-70.0, -18.0, 18.0, 70.0]:
		for z in range(-64, 65, 16):
			posts.append(Transform3D(Basis.IDENTITY.scaled(Vector3(0.13, 5.8, 0.13)), Vector3(x, 2.9, z)))
			heads.append(Transform3D(Basis.IDENTITY.scaled(Vector3(1.1, 0.2, 0.55)), Vector3(x, 5.8, z)))
			_solid_box("StreetLampCollision", Vector3(x, 2.9, z), Vector3(0.13, 5.8, 0.13))
	var unit_box := BoxMesh.new()
	_multimesh("StreetLampPosts", unit_box, _materials.metal, posts)
	_multimesh("StreetLampHeads", unit_box, _materials.line, heads)


func _make_vegetation() -> void:
	var trunks: Array[Transform3D] = []
	var crowns: Array[Transform3D] = []
	for x in [-54.0, -18.0, 18.0, 54.0]:
		for z in [-54.0, -18.0, 18.0, 54.0]:
			# Se deja despejada la puerta y el eje comercial sur.
			if absf(x) < 20.0 and absf(z) < 20.0:
				continue
			trunks.append(Transform3D(Basis.IDENTITY.scaled(Vector3(0.35, 4.2, 0.35)), Vector3(x, 2.1, z)))
			crowns.append(Transform3D(Basis.IDENTITY.scaled(Vector3(3.0, 3.2, 3.0)), Vector3(x, 5.1, z)))
			# Envolvente conservadora del tronco cilíndrico; también alimenta el navmesh.
			_solid_box("TreeTrunkCollision", Vector3(x, 2.1, z), Vector3(0.35, 4.2, 0.35))
	var trunk_mesh := CylinderMesh.new()
	var crown_mesh := SphereMesh.new()
	_multimesh("TreeTrunks", trunk_mesh, _materials.wood, trunks)
	_multimesh("TreeCrowns", crown_mesh, _materials.leaves, crowns)


func _make_navigation_mesh() -> void:
	# La navegación usa las mismas cajas físicas que detienen al jugador.
	WorldNavigation.build(navigation_region, self)


func _inside_building(x: float, z: float) -> bool:
	for bx in BUILDING_CENTERS:
		for bz in BUILDING_CENTERS:
			if absf(x - bx) < BUILDING_WIDTH * 0.5 + NAV_STEP * 0.5 + 0.5 and absf(z - bz) < BUILDING_DEPTH * 0.5 + NAV_STEP * 0.5 + 0.5:
				return true
	return false


func _inside_shop_wall(x: float, z: float) -> bool:
	# Reservar una celda a ambos lados del muro evita rutas a través de la fachada.
	var side_wall := absf(x) >= 4.0 and absf(x) <= 8.0 and absf(z) <= 8.0
	var end_wall := absf(z) >= 4.0 and absf(z) <= 8.0 and absf(x) <= 8.0
	var door_opening := z > 0.0 and absf(x) <= 2.0
	return side_wall or (end_wall and not door_opening)
