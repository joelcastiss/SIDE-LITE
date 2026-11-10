extends CharacterBody3D
class_name ShopNpc

enum State { IDLE, PATROL, INTERACT, WALK_TO_SHOP, ENTER_SHOP, BROWSE, EXIT_SHOP, WANDER }

@export var walk_speed: float = 2.15
@export var browse_min_seconds: float = 3.0
@export var browse_max_seconds: float = 7.0
@export var wander_radius: float = 24.0
@export_range(0.0, 1.0, 0.05) var shop_visit_chance: float = 0.20

@onready var navigation_agent: NavigationAgent3D = $NavigationAgent3D
@onready var visual: Node3D = $Visual
@onready var animation_player: AnimationPlayer = $AnimationPlayer
@onready var animation_tree: AnimationTree = $AnimationTree
@onready var wait_timer: Timer = $WaitTimer

var shop: Node3D
var state: State = State.IDLE
var browse_stops: int = 0
var inside_shop: bool = false
var home_position: Vector3 = Vector3.ZERO
var color: Color = Color.WHITE
var full_detail: bool = true
var _navigation_ready: bool = false
var _path_refresh_remaining: float = 0.0
var _next_path_point: Vector3 = Vector3.ZERO
var _gravity: float = 9.8
var _safe_horizontal_velocity: Vector3 = Vector3.ZERO
var _has_safe_velocity: bool = false
var _progress_elapsed: float = 0.0
var _progress_origin: Vector3 = Vector3.ZERO
var _blocked_samples: int = 0
var _resume_destination: Vector3 = Vector3.ZERO
var _taking_detour: bool = false
var _waiting_for_browse: bool = false
var _animation_playback: AnimationNodeStateMachinePlayback
var _rng := RandomNumberGenerator.new()
static var _color_materials: Dictionary = {}


func _ready() -> void:
	_rng.randomize()
	home_position = global_position
	add_to_group("world_npcs")
	floor_snap_length = 0.25
	safe_margin = 0.02
	up_direction = Vector3.UP
	floor_max_angle = deg_to_rad(45.0)
	_gravity = float(ProjectSettings.get_setting("physics/3d/default_gravity", 9.8))
	# Un peatón quieto o lejano sigue siendo un obstáculo para sus vecinos.
	navigation_agent.avoidance_enabled = true
	navigation_agent.avoidance_layers = 1
	navigation_agent.avoidance_mask = 3
	navigation_agent.radius = 0.38
	navigation_agent.max_speed = walk_speed
	navigation_agent.velocity_computed.connect(_on_safe_velocity)
	wait_timer.timeout.connect(_on_wait_complete)
	_build_animations()
	if shop != null:
		_connect_door()
	set_state(State.IDLE)


func start_persistent_life(visit_first: bool = false, start_inside: bool = false) -> void:
	# Los hijos existen antes de que Main construya y sincronice la navegación.
	var map_rid: RID = get_world_3d().navigation_map
	while NavigationServer3D.map_get_iteration_id(map_rid) == 0:
		await get_tree().physics_frame
	# Dejar también un tick para registrar los cuerpos estáticos del mapa.
	await get_tree().physics_frame
	_navigation_ready = true
	if start_inside and _enter_shop():
		browse_stops = _rng.randi_range(1, 3)
		_next_browse_stop()
	elif visit_first:
		start_visit()
	else:
		_begin_wander()


func set_full_detail(enabled: bool) -> void:
	full_detail = enabled
	# Las personas lejanas siguen moviéndose y colisionando, sin desaparecer.
	animation_tree.active = enabled
	_has_safe_velocity = false
	_path_refresh_remaining = 0.0


func configure(target_shop: Node3D, model_color: Color) -> void:
	shop = target_shop
	color = model_color
	if is_node_ready():
		_apply_color()
		_connect_door()


func start_visit() -> void:
	if shop == null:
		set_state(State.WANDER)
		return
	set_state(State.WALK_TO_SHOP)
	_set_destination(shop.get_exit_point())


func set_state(next_state: State) -> void:
	wait_timer.stop()
	state = next_state
	if state != State.IDLE:
		_waiting_for_browse = false
	var is_waiting := state == State.IDLE or state == State.INTERACT
	_has_safe_velocity = false
	_progress_elapsed = 0.0
	_progress_origin = global_position
	_blocked_samples = 0
	_taking_detour = false
	if is_waiting:
		velocity = Vector3.ZERO
	match state:
		State.IDLE, State.INTERACT, State.BROWSE:
			_play_animation("interact" if state != State.IDLE else "idle")
		_:
			_play_animation("walk")


func _physics_process(delta: float) -> void:
	if not _navigation_ready:
		return
	var desired_velocity: Vector3 = Vector3.ZERO
	var is_waiting: bool = state == State.IDLE or state == State.INTERACT
	if not is_waiting:
		if navigation_agent.is_navigation_finished():
			_on_destination_reached()
		else:
			_path_refresh_remaining -= delta
			if full_detail or _path_refresh_remaining <= 0.0 or global_position.distance_to(_next_path_point) < 0.45:
				_next_path_point = navigation_agent.get_next_path_position()
				_path_refresh_remaining = 0.20
			var direction: Vector3 = _next_path_point - global_position
			direction.y = 0.0
			if direction.length_squared() >= 0.0001:
				desired_velocity = direction.normalized() * walk_speed
				visual.rotation.y = lerp_angle(visual.rotation.y, atan2(direction.x, direction.z), minf(1.0, delta * 8.0))
	# Un solo paso físico por tick, también al esperar o cambiar de nivel de detalle.
	# El callback RVO sólo entrega velocidad: no puede duplicar move_and_slide.
	velocity.y = -0.1 if is_on_floor() else velocity.y - _gravity * delta
	var horizontal_velocity: Vector3 = desired_velocity
	if navigation_agent.avoidance_enabled:
		navigation_agent.set_velocity(desired_velocity)
		if _has_safe_velocity and desired_velocity.length_squared() > 0.0001:
			horizontal_velocity = _safe_horizontal_velocity
	velocity.x = horizontal_velocity.x
	velocity.z = horizontal_velocity.z
	move_and_slide()
	_update_progress(delta, desired_velocity)


func _on_safe_velocity(safe_velocity: Vector3) -> void:
	if not navigation_agent.avoidance_enabled:
		return
	_safe_horizontal_velocity = Vector3(safe_velocity.x, 0.0, safe_velocity.z)
	_has_safe_velocity = true


func _set_destination(point: Vector3) -> void:
	var map_rid: RID = get_world_3d().navigation_map
	navigation_agent.target_position = NavigationServer3D.map_get_closest_point(map_rid, point) if _navigation_ready else point
	_path_refresh_remaining = 0.0
	_progress_elapsed = 0.0
	_progress_origin = global_position
	_blocked_samples = 0
	_taking_detour = false


func _update_progress(delta: float, desired_velocity: Vector3) -> void:
	# Recuperar rutas bloqueadas sin mover cuerpos por teletransporte ni cambiar FSM.
	if desired_velocity.length_squared() < 0.01:
		_progress_elapsed = 0.0
		_progress_origin = global_position
		return
	_progress_elapsed += delta
	if _progress_elapsed < 1.5:
		return
	var travelled: Vector3 = global_position - _progress_origin
	travelled.y = 0.0
	_progress_elapsed = 0.0
	_progress_origin = global_position
	if travelled.length() >= 0.15:
		_blocked_samples = 0
		return
	_blocked_samples += 1
	_path_refresh_remaining = 0.0
	_has_safe_velocity = false
	# Volver a consultar el corredor permite resolver pequeños bloqueos transitorios.
	navigation_agent.target_position = navigation_agent.target_position
	if _blocked_samples < 2:
		return
	_try_local_detour()


func _try_local_detour() -> void:
	var original: Vector3 = _resume_destination if _taking_detour else navigation_agent.target_position
	var forward: Vector3 = original - global_position
	forward.y = 0.0
	forward = forward.normalized() if forward.length_squared() > 0.01 else Vector3.FORWARD
	var map_rid: RID = get_world_3d().navigation_map
	var space: PhysicsDirectSpaceState3D = get_world_3d().direct_space_state
	var capsule: Shape3D = ($CollisionShape3D as CollisionShape3D).shape
	for angle: float in [PI * 0.5, -PI * 0.5, PI * 0.75, -PI * 0.75]:
		var desired: Vector3 = global_position + forward.rotated(Vector3.UP, angle) * 1.8
		var candidate: Vector3 = NavigationServer3D.map_get_closest_point(map_rid, desired)
		if candidate.distance_to(desired) > 0.3 or candidate.distance_to(global_position) < 0.8:
			continue
		var path: PackedVector3Array = NavigationServer3D.map_get_path(map_rid, global_position, candidate, true)
		if path.size() < 2 or path[-1].distance_to(candidate) > 0.15:
			continue
		var query := PhysicsShapeQueryParameters3D.new()
		query.shape = capsule
		query.collision_mask = 7
		query.exclude = [get_rid()]
		query.transform = Transform3D(Basis.IDENTITY, candidate + Vector3.UP * 0.92)
		if not space.intersect_shape(query, 1).is_empty():
			continue
		_set_destination(candidate)
		_resume_destination = original
		_taking_detour = true
		return


func _on_destination_reached() -> void:
	if _taking_detour:
		var destination: Vector3 = _resume_destination
		_set_destination(destination)
		return
	match state:
		State.WALK_TO_SHOP:
			if shop == null or not shop.has_capacity():
				_begin_wander()
			else:
				set_state(State.ENTER_SHOP)
				_set_destination(shop.get_entry_point())
		State.ENTER_SHOP:
			if not inside_shop and not _enter_shop():
				_begin_wander()
				return
			browse_stops = _rng.randi_range(1, 3)
			_next_browse_stop()
		State.BROWSE:
			set_state(State.INTERACT)
			_begin_wait(_rng.randf_range(browse_min_seconds, browse_max_seconds))
		State.EXIT_SHOP:
			if inside_shop and shop != null:
				shop.exit_shop(self)
			inside_shop = false
			_begin_wander()
		State.WANDER, State.PATROL:
			set_state(State.IDLE)
			_begin_wait(_rng.randf_range(0.6, 2.3))
		_:
			_begin_wander()


func _on_wait_complete() -> void:
	if _waiting_for_browse:
		_next_browse_stop()
		return
	match state:
		State.INTERACT:
			browse_stops -= 1
			if browse_stops > 0:
				_next_browse_stop()
			else:
				shop.release_browse_point(self)
				set_state(State.EXIT_SHOP)
				_set_destination(shop.get_exit_point())
		State.IDLE:
			if shop != null and shop_visit_chance > 0.0 and _rng.randf() < shop_visit_chance:
				start_visit()
			else:
				_begin_wander()


func _begin_wait(seconds: float) -> void:
	wait_timer.start(maxf(0.01, seconds))


func _next_browse_stop() -> void:
	if shop == null:
		_begin_wander()
		return
	var point: Vector3 = shop.get_browse_point(self)
	_waiting_for_browse = not point.is_finite()
	if _waiting_for_browse:
		# Una espera por aforo de exhibición no consume las paradas de la visita.
		set_state(State.IDLE)
		_begin_wait(0.5)
		return
	set_state(State.BROWSE)
	_set_destination(point)


func _begin_wander() -> void:
	set_state(State.PATROL)
	var map_rid: RID = get_world_3d().navigation_map
	# Sólo aceptar destinos conectados y evitar que un peatón cruce paredes de tienda.
	for attempt in range(10):
		var angle: float = _rng.randf_range(-PI, PI)
		var radius: float = _rng.randf_range(5.0, wander_radius)
		var desired: Vector3 = home_position + Vector3(cos(angle) * radius, 0.0, sin(angle) * radius)
		if shop != null and desired.distance_to(shop.global_position) < 8.0:
			continue
		var destination: Vector3 = NavigationServer3D.map_get_closest_point(map_rid, desired)
		var path: PackedVector3Array = NavigationServer3D.map_get_path(map_rid, global_position, destination, true)
		if path.size() >= 2 and destination.distance_to(global_position) > 2.0:
			_set_destination(destination)
			return
	set_state(State.IDLE)
	_begin_wait(1.0)


func _enter_shop() -> bool:
	if inside_shop:
		return true
	if shop == null or not shop.try_enter(self):
		return false
	inside_shop = true
	return true


func _connect_door() -> void:
	if shop == null or not is_instance_valid(shop):
		return
	var door := shop.get_node_or_null("DoorArea") as Area3D
	if door != null and not door.body_entered.is_connected(_on_door_body_entered):
		door.body_entered.connect(_on_door_body_entered)
	if door != null and not door.body_exited.is_connected(_on_door_body_exited):
		door.body_exited.connect(_on_door_body_exited)


func _on_door_body_entered(body: Node3D) -> void:
	if body != self or state != State.ENTER_SHOP or inside_shop:
		return
	if not _enter_shop():
		_begin_wander()


func _on_door_body_exited(body: Node3D) -> void:
	if body != self or state != State.EXIT_SHOP or not inside_shop:
		return
	shop.exit_shop(self)
	inside_shop = false


func _build_animations() -> void:
	var library := AnimationLibrary.new()
	for name in ["idle", "walk", "interact"]:
		var animation := Animation.new()
		animation.length = 1.0
		animation.loop_mode = Animation.LOOP_LINEAR
		var track := animation.add_track(Animation.TYPE_VALUE)
		# El gesto anima la cabeza; los pies permanecen apoyados durante la marcha.
		animation.track_set_path(track, NodePath("Visual/Head:rotation"))
		animation.track_insert_key(track, 0.0, Vector3.ZERO)
		animation.track_insert_key(track, 0.5, Vector3(0.0, 0.0, 0.04 if name == "walk" else 0.025))
		animation.track_insert_key(track, 1.0, Vector3.ZERO)
		library.add_animation(name, animation)
	animation_player.add_animation_library("", library)
	var machine := AnimationNodeStateMachine.new()
	for name in ["idle", "walk", "interact"]:
		var node := AnimationNodeAnimation.new()
		node.animation = name
		machine.add_node(name, node)
	for from_name in ["idle", "walk", "interact"]:
		for to_name in ["idle", "walk", "interact"]:
			if from_name == to_name:
				continue
			var transition := AnimationNodeStateMachineTransition.new()
			transition.xfade_time = 0.2
			machine.add_transition(from_name, to_name, transition)
	animation_tree.tree_root = machine
	animation_tree.active = true
	_animation_playback = animation_tree.get("parameters/playback") as AnimationNodeStateMachinePlayback
	_apply_color()


func _play_animation(name: String) -> void:
	if _animation_playback != null:
		_animation_playback.travel(name)


func _apply_color() -> void:
	var material: StandardMaterial3D = _color_materials.get(color)
	if material == null:
		material = StandardMaterial3D.new()
		material.albedo_color = color
		_color_materials[color] = material
	for mesh in [$Visual/Body, $Visual/Head]:
		mesh.material_override = material


func _exit_tree() -> void:
	if inside_shop and is_instance_valid(shop):
		shop.exit_shop(self)
