extends Node3D
## Tienda, exhibidores y control de aforo compartido por los NPC.

signal capacity_changed(occupied: int, capacity: int)
signal door_body_entered(body: Node3D)
signal door_body_exited(body: Node3D)

@export_range(1, 30, 1) var max_capacity: int = 6
@onready var door_area: Area3D = $DoorArea
@onready var _entry: Marker3D = $ShopEntry
@onready var _exit: Marker3D = $ShopExit
@onready var _browse_points: Node3D = $BrowsePoints
@onready var _display: Node3D = $Display

var _occupants: Array[Node3D] = []
var _browse_cursor: int = 0
var _browse_reservations: Dictionary = {}
var _box_batches: Dictionary = {}
var _torus_batches: Dictionary = {}
var _grain_cache: Dictionary = {}


func _ready() -> void:
	door_area.body_entered.connect(func(body: Node3D) -> void: door_body_entered.emit(body))
	door_area.body_exited.connect(func(body: Node3D) -> void: door_body_exited.emit(body))
	_build_shop()


func has_capacity() -> bool:
	for i in range(_occupants.size() - 1, -1, -1):
		if not is_instance_valid(_occupants[i]):
			_occupants.remove_at(i)
	return _occupants.size() < max_capacity


func try_enter(npc: Node3D) -> bool:
	if not is_instance_valid(npc):
		return false
	if _occupants.has(npc):
		return true
	if not has_capacity():
		return false
	_occupants.append(npc)
	capacity_changed.emit(_occupants.size(), max_capacity)
	return true


func exit_shop(npc: Node3D) -> void:
	release_browse_point(npc)
	if _occupants.has(npc):
		_occupants.erase(npc)
		capacity_changed.emit(_occupants.size(), max_capacity)


func leave(npc: Node3D) -> void:
	exit_shop(npc)


func get_entry_point() -> Vector3:
	return _entry.global_position


func get_exit_point() -> Vector3:
	return _exit.global_position


func get_browse_point(visitor: Node3D = null) -> Vector3:
	var count := _browse_points.get_child_count()
	if count == 0:
		return _entry.global_position
	if visitor != null:
		release_browse_point(visitor)
	# Reservar también mientras se camina: nadie espera sobre el destino de otro.
	for offset: int in range(count):
		var slot: int = (_browse_cursor + offset) % count
		var point := _browse_points.get_child(slot) as Marker3D
		if _browse_reservations.has(point):
			var occupant: Node3D = _browse_reservations[point] as Node3D
			if is_instance_valid(occupant):
				continue
			_browse_reservations.erase(point)
		_browse_cursor = slot + 1
		if visitor != null:
			_browse_reservations[point] = visitor
		return point.global_position
	return Vector3(INF, INF, INF)


func release_browse_point(visitor: Node3D) -> void:
	for point: Variant in _browse_reservations.keys():
		if not is_instance_valid(_browse_reservations[point]) or _browse_reservations[point] == visitor:
			_browse_reservations.erase(point)


func _build_shop() -> void:
	var wall := _mat(Color("#d8c9b3"), 0.88)
	var wood := _mat(Color("#73523b"), 0.57)
	var dark_wood := _mat(Color("#3d2e29"), 0.65)
	var metal := _mat(Color("#b39b69"), 0.26, 0.75)
	var floor_mat := _mat(Color("#b79772"), 0.72)
	var glass := _mat(Color(0.70, 0.86, 0.91, 0.24), 0.08, 0.05)
	glass.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	glass.shading_mode = BaseMaterial3D.SHADING_MODE_PER_PIXEL
	# La planta conserva un pasillo central libre desde la puerta sur.
	# El piso comparte la losa física del mundo; solo se añade su acabado visual.
	_box(_display, Vector3(0, -0.044, 0), Vector3(12, 0.10, 10), floor_mat)
	_box(_display, Vector3(0, 2.45, -4.94), Vector3(12, 4.9, 0.12), wall, true)
	for side in [-1.0, 1.0]:
		_box(_display, Vector3(side * 5.94, 2.45, 0), Vector3(0.12, 4.9, 10), wall, true)
		_box(_display, Vector3(side * 3.55, 2.45, 4.94), Vector3(4.9, 4.9, 0.12), glass, true)
		_box(_display, Vector3(side * 1.08, 2.45, 4.94), Vector3(0.14, 4.9, 0.18), metal, true)
		_box(_display, Vector3(side * 3.55, 4.83, 4.97), Vector3(4.9, 0.14, 0.2), metal)
		_box(_display, Vector3(side * 5.45, 0.12, 0), Vector3(0.68, 0.24, 10), dark_wood)
	_box(_display, Vector3(0, 3.9, 4.94), Vector3(2.25, 1.95, 0.14), wall, true)
	# Cornisa abierta: la cámara elevada debe ver la exhibición desde arriba.
	for side in [-1.0, 1.0]:
		_box(_display, Vector3(side * 5.9, 4.86, 0), Vector3(0.2, 0.13, 10), wall)
		_box(_display, Vector3(0, 4.86, side * 4.9), Vector3(12, 0.13, 0.2), wall)
	# Cuatro vitrinas laterales y una mesa central dejan los puntos de visita despejados.
	for x in [-4.75, 4.75]:
		for z in [-2.65, 2.1]:
			_shelf(Vector3(x, 0, z), wood, metal)
	_table(Vector3(0, 0, -1.55), dark_wood, metal)
	_box(_display, Vector3(4.7, 0.58, -4.05), Vector3(2.1, 1.16, 0.65), dark_wood, true)
	_box(_display, Vector3(4.7, 1.19, -4.05), Vector3(2.2, 0.08, 0.72), wood)
	var leather := _textured_mat(Color("#a65f38"), false)
	var navy := _textured_mat(Color("#314d70"), false)
	var canvas := _textured_mat(Color("#b8a78a"), true)
	var trim := _mat(Color("#392a23"), 0.48)
	var gold := _mat(Color("#d0a948"), 0.22, 0.92)
	var zipper := _mat(Color("#c5c7c8"), 0.24, 0.8)
	var palette := [leather, navy, canvas]
	var index := 0
	for x in [-4.75, 4.75]:
		for z in [-2.65, 2.1]:
			# La base del producto coincide con la cara superior de cada estante.
			for y in [0.56, 1.39, 2.22]:
				_bag(Vector3(x, y, z), index % 3, palette[index % 3], trim, gold, zipper)
				index += 1
	for x in [-0.72, 0.72]:
		_bag(Vector3(x, 0.82, -1.55), (index + 1) % 3, palette[(index + 1) % 3], trim, gold, zipper)
		index += 1
	for x in [-3.6, -1.8, 0.0, 1.8, 3.6]:
		var lamp := OmniLight3D.new()
		lamp.position = Vector3(x, 3.85, 0)
		lamp.light_color = Color("#ffe5bb")
		lamp.light_energy = 0.45
		lamp.omni_range = 5.0
		lamp.shadow_enabled = false
		_display.add_child(lamp)
	for x in [-4.75, 4.75]:
		for z in [-2.65, 2.1]:
			var spot := SpotLight3D.new()
			spot.position = Vector3(x, 3.35, z)
			spot.light_color = Color("#ffdab2")
			spot.light_energy = 0.65
			spot.spot_range = 3.3
			spot.spot_angle = 32.0
			spot.rotation.x = -PI / 2.0
			spot.shadow_enabled = false
			_display.add_child(spot)
	_flush_mesh_batches()


func _shelf(at: Vector3, wood: Material, metal: Material) -> void:
	# Una envolvente por vitrina conserva los lotes visuales y despeja su navegación.
	_solid(_display, at + Vector3(0, 1.45, 0), Vector3(0.63, 2.9, 2.0))
	for side in [-0.9, 0.9]:
		_box(_display, at + Vector3(0, 1.45, side), Vector3(0.38, 2.9, 0.07), metal)
	for y in [0.52, 1.35, 2.18]:
		_box(_display, at + Vector3(0, y, 0), Vector3(0.63, 0.08, 2.0), wood)
		_box(_display, at + Vector3(0, y - 0.07, 0.92), Vector3(0.52, 0.025, 0.06), metal)


func _table(at: Vector3, wood: Material, metal: Material) -> void:
	_solid(_display, at + Vector3(0, 0.41, 0), Vector3(2.75, 0.82, 1.35))
	_box(_display, at + Vector3(0, 0.76, 0), Vector3(2.75, 0.12, 1.35), wood)
	for x in [-1.18, 1.18]:
		for z in [-0.53, 0.53]:
			_box(_display, at + Vector3(x, 0.36, z), Vector3(0.07, 0.72, 0.07), metal)


func _bag(at: Vector3, style: int, main: Material, trim: Material, gold: Material, zipper: Material) -> void:
	var bag := Node3D.new()
	bag.name = ["Bolso_Esencial", "Bolso_Urbano", "Bolso_Premium"][style]
	bag.position = at
	bag.rotation.y = PI / 2.0 if at.x < 0.0 else -PI / 2.0
	_display.add_child(bag)
	var width: float = [0.56, 0.66, 0.59][style]
	var height: float = [0.45, 0.48, 0.57][style]
	_box(bag, Vector3(0, height * 0.5, 0), Vector3(width, height, 0.22), main)
	_box(bag, Vector3(0, height * 0.92, 0.116), Vector3(width * 0.94, 0.09, 0.035), trim)
	for side in [-1.0, 1.0]:
		_box(bag, Vector3(side * (width * 0.43), height * 0.51, 0.125), Vector3(0.032, height * 0.8, 0.028), trim)
		_torus(bag, Vector3(side * width * 0.32, height + 0.12, 0), 0.13, 0.016, trim)
	if style == 0:
		_box(bag, Vector3(0, height * 0.73, 0.128), Vector3(width * 0.8, 0.19, 0.035), main)
		_box(bag, Vector3(0, height * 0.57, 0.155), Vector3(0.07, 0.045, 0.018), gold)
	elif style == 1:
		_box(bag, Vector3(0, height * 0.47, 0.128), Vector3(width * 0.62, 0.16, 0.025), main)
		_box(bag, Vector3(0, height * 0.94, 0.153), Vector3(width * 0.72, 0.018, 0.022), zipper)
	else:
		_box(bag, Vector3(0, height * 0.58, 0.13), Vector3(0.09, height * 0.75, 0.036), trim)
		_box(bag, Vector3(0, height * 0.3, 0.155), Vector3(0.10, 0.05, 0.025), gold)
	# Puntadas visibles sobre la banda frontal.
	for i in range(13):
		var sx: float = -width * 0.39 + float(i) * width * 0.065
		_box(bag, Vector3(sx, height * 0.16, 0.133), Vector3(0.013, 0.008, 0.008), trim)


func _box(parent: Node3D, at: Vector3, size: Vector3, surface: Material, collision: bool = false) -> void:
	# Una caja unidad por material conserva forma y UV; el tamaño vive en cada instancia.
	# No fragmentar por medidas evita una llamada de dibujo por cada pieza diferente.
	var transforms: Array = _box_batches.get_or_add(surface, [])
	var local := Transform3D(Basis.IDENTITY.scaled(size), at)
	transforms.append(parent.transform * local if parent != _display else local)
	if collision:
		_solid(parent, at, size)


func _solid(parent: Node3D, at: Vector3, size: Vector3) -> void:
	var body := StaticBody3D.new()
	body.name = "Solid"
	body.collision_layer = 1
	body.collision_mask = 6
	body.position = at
	var shape := BoxShape3D.new()
	shape.size = size
	var collider := CollisionShape3D.new()
	collider.shape = shape
	body.add_child(collider)
	parent.add_child(body)


func _torus(parent: Node3D, at: Vector3, radius: float, tube: float, surface: Material) -> void:
	var by_shape: Dictionary = _torus_batches.get_or_add(surface, {})
	var shape := Vector2(radius, tube)
	var transforms: Array = by_shape.get_or_add(shape, [])
	var local := Transform3D(Basis(Vector3.RIGHT, PI / 2.0), at)
	transforms.append(parent.transform * local if parent != _display else local)


func _flush_mesh_batches() -> void:
	for surface: Material in _box_batches:
		var mesh := BoxMesh.new()
		mesh.size = Vector3.ONE
		mesh.material = surface
		_add_multimesh(mesh, _box_batches[surface])
	for surface: Material in _torus_batches:
		var by_shape: Dictionary = _torus_batches[surface]
		for shape: Vector2 in by_shape:
			var mesh := TorusMesh.new()
			mesh.inner_radius = shape.x - shape.y
			mesh.outer_radius = shape.x + shape.y
			mesh.material = surface
			_add_multimesh(mesh, by_shape[shape])
	_box_batches.clear()
	_torus_batches.clear()


func _add_multimesh(mesh: Mesh, transforms: Array) -> void:
	var multi := MultiMesh.new()
	multi.transform_format = MultiMesh.TRANSFORM_3D
	multi.mesh = mesh
	multi.instance_count = transforms.size()
	for i in transforms.size():
		multi.set_instance_transform(i, transforms[i])
	var node := MultiMeshInstance3D.new()
	node.multimesh = multi
	_display.add_child(node)


func _mat(color: Color, roughness: float, metallic: float = 0.0) -> StandardMaterial3D:
	var result := StandardMaterial3D.new()
	result.albedo_color = color
	result.roughness = roughness
	result.metallic = metallic
	return result


func _textured_mat(color: Color, woven: bool) -> StandardMaterial3D:
	# Mapas PBR originales generados a partir de ruido determinista; no usan assets externos.
	var grains: Array = _grain_cache.get(woven, [])
	if grains.is_empty():
		grains.resize(128 * 128)
		for y in range(128):
			for x in range(128):
				grains[y * 128 + x] = _grain(x, y, woven)
		_grain_cache[woven] = grains
	var albedo := Image.create(128, 128, false, Image.FORMAT_RGBA8)
	var normal := Image.create(128, 128, false, Image.FORMAT_RGBA8)
	var rough := Image.create(128, 128, false, Image.FORMAT_RGBA8)
	for y in range(128):
		for x in range(128):
			var grain: float = grains[y * 128 + x]
			var dx: float = grains[y * 128 + ((x + 1) % 128)] - grains[y * 128 + ((x + 127) % 128)]
			var dy: float = grains[((y + 1) % 128) * 128 + x] - grains[((y + 127) % 128) * 128 + x]
			var shade := 0.89 + grain * 0.19
			albedo.set_pixel(x, y, Color(color.r * shade, color.g * shade, color.b * shade))
			normal.set_pixel(x, y, Color(clampf(0.5 - dx * 0.45, 0.0, 1.0), clampf(0.5 - dy * 0.45, 0.0, 1.0), 0.98))
			var rv := (0.78 if woven else 0.54) + grain * 0.12
			rough.set_pixel(x, y, Color(rv, rv, rv))
	# Filtrar a distancia evita que la trama fina de tela/cuero parpadee al caminar.
	albedo.generate_mipmaps()
	normal.generate_mipmaps(true)
	rough.generate_mipmaps()
	var result := StandardMaterial3D.new()
	result.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	result.albedo_texture = ImageTexture.create_from_image(albedo)
	result.normal_enabled = true
	result.normal_texture = ImageTexture.create_from_image(normal)
	result.roughness = 1.0
	result.roughness_texture = ImageTexture.create_from_image(rough)
	result.metallic = 0.0
	return result


func _grain(x: int, y: int, woven: bool) -> float:
	if woven:
		return 0.5 + 0.25 * sin(float(x) * PI / 2.0) + 0.25 * sin(float(y) * PI / 2.0)
	var fine := sin(float(x * 73 + y * 37) * 0.21) * sin(float(x * 19 - y * 61) * 0.17)
	return 0.5 + 0.30 * fine + 0.20 * sin(float(x + y) * 0.35)
