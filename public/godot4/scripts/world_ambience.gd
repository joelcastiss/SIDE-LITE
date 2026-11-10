extends RefCounted
## Acabado urbano económico: materiales compartidos, carteles y lotes estáticos.
## La geometría ornamental no cambia el suelo ni la navegación del barrio.


static func configure(main: Node3D, city: Node3D, materials: Dictionary) -> void:
	var ambience := Node3D.new()
	ambience.name = "AmbienteUrbano"
	city.add_child(ambience)
	_finish_material(materials["road"], 0, 0.65)
	_finish_material(materials["paving"], 1, 0.4)
	_finish_material(materials["grass"], 2, 0.35)
	var sun := main.get_node("Sun") as DirectionalLight3D
	sun.light_color = Color("fff0d8")
	sun.light_energy = 0.8
	var world := main.get_node("WorldEnvironment") as WorldEnvironment
	# Color ambiental moderado evita superficies quemadas en OpenGL sin HDR.
	world.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	world.environment.ambient_light_color = Color("b9cbd8")
	world.environment.ambient_light_energy = 0.32
	world.environment.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	world.environment.tonemap_exposure = 0.85
	world.environment.fog_density = 0.0016
	# El sol es la única luz exterior; se conserva Compatibility sin coste de GI.
	_build_facade_details(ambience, materials)
	_build_plaza_details(ambience, materials)
	_build_boundary(ambience, materials)
	var shop_board: Array[Transform3D] = [_box_transform(Vector3(0, 4.05, 5.05), Vector3(4.6, 0.85, 0.08))]
	_batch(ambience, "RotuloTienda", materials["roof"], shop_board)
	_sign(ambience, "SIDE · BOLSOS", Vector3(0, 4.05, 5.10), 0.0, 56, 0.008, Color("fff3d9"))
	_sign(ambience, "ABIERTO", Vector3(0, 3.33, 5.045), 0.0, 40, 0.006, Color("273239"))


static func _finish_material(material: StandardMaterial3D, kind: int, scale: float) -> void:
	# Texturas originales de 64 px y mipmaps: sin descargas ni ruido temporal.
	var texture_image := Image.create(64, 64, false, Image.FORMAT_RGB8)
	for y in range(64):
		for x in range(64):
			var grain := sin(float(x * 73 + y * 37)) * sin(float(x * 19 - y * 61))
			var brightness := 0.95 + grain * 0.055
			if kind == 1:
				brightness = 0.9 if x % 32 == 0 or y % 32 == 0 else 0.98 + grain * 0.02
			elif kind == 2:
				brightness = 0.92 + grain * 0.08
			texture_image.set_pixel(x, y, Color(brightness, brightness, brightness))
	texture_image.generate_mipmaps()
	material.albedo_texture = ImageTexture.create_from_image(texture_image)
	material.uv1_triplanar = true
	material.uv1_scale = Vector3.ONE * scale
	material.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	material.roughness = 0.95


static func _build_facade_details(parent: Node3D, materials: Dictionary) -> void:
	var plinths: Array[Transform3D] = []
	var doors: Array[Transform3D] = []
	var canopies: Array[Transform3D] = []
	for x in [-62.0, -34.0, 34.0, 62.0]:
		for z in [-62.0, -34.0, 34.0, 62.0]:
			# Los remates permanecen en la envolvente de edificios ya sólidos.
			plinths.append(_box_transform(Vector3(x, 0.25, z + 8.025), Vector3(14.0, 0.5, 0.05)))
			doors.append(_box_transform(Vector3(x, 1.35, z + 8.06), Vector3(1.4, 2.7, 0.06)))
			canopies.append(_box_transform(Vector3(x, 2.85, z + 8.18), Vector3(2.2, 0.12, 0.6)))
	_batch(parent, "Zocalos", materials["roof"], plinths)
	_batch(parent, "Puertas", materials["wood"], doors)
	_batch(parent, "Marquesinas", materials["metal"], canopies)


static func _build_plaza_details(parent: Node3D, materials: Dictionary) -> void:
	var bench_feet: Array[Transform3D] = []
	var sign_posts: Array[Transform3D] = []
	var sign_boards: Array[Transform3D] = []
	var centers: Array[Vector3] = [Vector3(-36, 0, 0), Vector3(36, 0, 0), Vector3(0, 0, -36), Vector3(0, 0, 36)]
	for i in centers.size():
		var center := centers[i]
		for side in [-0.85, 0.85]:
			bench_feet.append(_box_transform(center + Vector3(-4.2 + side, 0.26, 4.8), Vector3(0.12, 0.52, 0.55)))
		# El cartel queda junto a la jardinera; el eje peatonal sigue despejado.
		var sign_at := center + Vector3(5.3, 0.0, 5.3)
		sign_posts.append(_box_transform(sign_at + Vector3(0, 1.55, 0), Vector3(0.08, 2.6, 0.08)))
		sign_boards.append(_box_transform(sign_at + Vector3(0, 2.65, 0), Vector3(2.15, 0.68, 0.09)))
		_sign(parent, ["PLAZA OESTE", "PLAZA ESTE", "PLAZA NORTE", "PLAZA SUR"][i], sign_at + Vector3(0, 2.65, 0.055), 0.0, 32, 0.0045, Color("fff3d9"))
	_batch(parent, "PatasBancosYPostes", materials["metal"], bench_feet + sign_posts)
	_batch(parent, "CartelesPlaza", materials["roof"], sign_boards)


static func _build_boundary(parent: Node3D, materials: Dictionary) -> void:
	# Valla visible y sólida: contiene a los actores incluso durante un salto.
	var fence: Array[Transform3D] = []
	for side in [-1.0, 1.0]:
		for height in [0.45, 1.0, 1.65, 2.2]:
			fence.append(_box_transform(Vector3(side * 87.92, height, 0), Vector3(0.12, 0.12, 176)))
			fence.append(_box_transform(Vector3(0, height, side * 87.92), Vector3(176, 0.12, 0.12)))
		for coordinate in range(-88, 89, 4):
			fence.append(_box_transform(Vector3(side * 87.92, 1.2, coordinate), Vector3(0.16, 2.4, 0.16)))
			fence.append(_box_transform(Vector3(coordinate, 1.2, side * 87.92), Vector3(0.16, 2.4, 0.16)))
		_boundary_solid(parent, Vector3(side * 87.92, 1.2, 0), Vector3(0.16, 2.4, 176))
		_boundary_solid(parent, Vector3(0, 1.2, side * 87.92), Vector3(176, 2.4, 0.16))
	_batch(parent, "LimiteVisibleDelBarrio", materials["wood"], fence)


static func _boundary_solid(parent: Node3D, at: Vector3, size: Vector3) -> void:
	var body := StaticBody3D.new()
	body.name = "BoundaryCollision"
	body.position = at
	body.collision_layer = 1
	body.collision_mask = 6
	var box := BoxShape3D.new()
	box.size = size
	var collider := CollisionShape3D.new()
	collider.shape = box
	body.add_child(collider)
	parent.add_child(body)


static func _box_transform(at: Vector3, size: Vector3) -> Transform3D:
	return Transform3D(Basis.IDENTITY.scaled(size), at)


static func _batch(parent: Node3D, node_name: String, surface: Material, transforms: Array[Transform3D]) -> void:
	var multi := MultiMesh.new()
	multi.transform_format = MultiMesh.TRANSFORM_3D
	multi.mesh = BoxMesh.new()
	multi.instance_count = transforms.size()
	for i in transforms.size():
		multi.set_instance_transform(i, transforms[i])
	var instance := MultiMeshInstance3D.new()
	instance.name = node_name
	instance.multimesh = multi
	instance.material_override = surface
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(instance)


static func _sign(parent: Node3D, text: String, at: Vector3, heading: float, font_size: int, pixel_size: float, color: Color) -> void:
	var label := Label3D.new()
	label.text = text
	label.position = at
	label.rotation.y = heading
	label.font_size = font_size
	label.pixel_size = pixel_size
	label.modulate = color
	label.outline_size = 3
	label.outline_modulate = Color("273239")
	label.no_depth_test = false
	label.shaded = false
	label.double_sided = true
	label.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# También los carteles conservan continuidad visual al recorrer el barrio.
	parent.add_child(label)
