extends CharacterBody3D
class_name WorldPlayer

## Paseo básico: WASD/flechas, Mayús para correr, espacio para saltar.
## Tab cambia a la cámara panorámica y arrastrar botón derecho gira la cámara.
@export var walk_speed: float = 4.5
@export var run_speed: float = 7.0
@export var jump_speed: float = 5.0
@export var acceleration: float = 24.0
@export var braking: float = 30.0
@export_range(0.0, 0.4, 0.01) var step_height: float = 0.3

@onready var camera_pivot: Node3D = $CameraPivot
@onready var follow_camera: Camera3D = $CameraPivot/SpringArm3D/Camera3D
@onready var visual: Node3D = $Visual
@onready var avoidance_agent: NavigationAgent3D = $AvoidanceAgent

var _gravity: float = 9.8
var _overview: Camera3D
var _jump_was_pressed: bool = false
var _pending_camera_yaw: float = 0.0


func _ready() -> void:
	add_to_group("player")
	floor_snap_length = 0.3
	floor_max_angle = deg_to_rad(45.0)
	safe_margin = 0.01
	up_direction = Vector3.UP
	_gravity = float(ProjectSettings.get_setting("physics/3d/default_gravity", 9.8))
	_overview = get_parent().get_node_or_null("PlayerCamera") as Camera3D
	($CameraPivot/SpringArm3D as SpringArm3D).add_excluded_object(get_rid())
	follow_camera.make_current()
	avoidance_agent.max_speed = run_speed


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo and event.physical_keycode == KEY_TAB:
		if _overview != null and not _overview.current:
			_overview.make_current()
		else:
			follow_camera.make_current()
		get_viewport().set_input_as_handled()
	elif event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT):
		# Acumular input: la rotación y el cuerpo se actualizan en el mismo tick.
		_pending_camera_yaw -= event.relative.x * 0.008


func _physics_process(delta: float) -> void:
	camera_pivot.rotation.y += _pending_camera_yaw
	_pending_camera_yaw = 0.0
	var axes := Vector2(
		float(Input.is_physical_key_pressed(KEY_D) or Input.is_action_pressed("ui_right")) - float(Input.is_physical_key_pressed(KEY_A) or Input.is_action_pressed("ui_left")),
		float(Input.is_physical_key_pressed(KEY_S) or Input.is_action_pressed("ui_down")) - float(Input.is_physical_key_pressed(KEY_W) or Input.is_action_pressed("ui_up"))
	)
	var direction := camera_pivot.global_basis * Vector3(axes.x, 0.0, axes.y)
	direction.y = 0.0
	direction = direction.normalized()
	var speed := run_speed if Input.is_physical_key_pressed(KEY_SHIFT) else walk_speed
	var horizontal := Vector3(velocity.x, 0.0, velocity.z)
	horizontal = horizontal.move_toward(direction * speed, (braking if direction.is_zero_approx() else acceleration) * delta)
	velocity.x = horizontal.x
	velocity.z = horizontal.z
	var jump_pressed: bool = Input.is_physical_key_pressed(KEY_SPACE)
	var jump_started: bool = jump_pressed and not _jump_was_pressed and is_on_floor()
	_jump_was_pressed = jump_pressed
	if not is_on_floor():
		velocity.y -= _gravity * delta
	elif jump_started:
		velocity.y = jump_speed
	else:
		velocity.y = -0.1
	# RVO informa a los peatones; nunca modifica la dirección elegida por el usuario.
	avoidance_agent.velocity = horizontal
	var stepped: bool = false
	if is_on_floor() and not jump_started and step_height > 0.0 and horizontal.length_squared() > 0.0001:
		stepped = _try_step(horizontal * delta)
	if stepped:
		# El barrido ya consumió el desplazamiento horizontal de este tick.
		velocity.x = 0.0
		velocity.z = 0.0
	move_and_slide()
	if stepped:
		velocity.x = horizontal.x
		velocity.z = horizontal.z
	if direction.length_squared() > 0.01:
		visual.rotation.y = lerp_angle(visual.rotation.y, atan2(direction.x, direction.z), minf(delta * 10.0, 1.0))


func _try_step(motion: Vector3) -> bool:
	# Solo subir sólidos estáticos. Un peatón nunca puede convertirse en escalón.
	var blocked := PhysicsTestMotionResult3D.new()
	if not _sweep(global_transform, motion, blocked):
		return false
	if not blocked.get_collider() is StaticBody3D or blocked.get_collision_normal().dot(up_direction) >= cos(floor_max_angle):
		return false
	var raised := global_transform
	var lift: float = step_height + safe_margin * 2.0
	if _sweep(raised, up_direction * lift, PhysicsTestMotionResult3D.new()):
		return false
	raised.origin += up_direction * lift
	if _sweep(raised, motion, PhysicsTestMotionResult3D.new()):
		return false
	raised.origin += motion
	# La cápsula toca el canto con una normal oblicua antes de pisar la cara
	# superior. Muestrear esa cara evita confundir el canto con una pendiente.
	var capsule := ($CollisionShape3D as CollisionShape3D).shape as CapsuleShape3D
	var probe: Vector3 = raised.origin + motion.normalized() * capsule.radius
	var query := PhysicsRayQueryParameters3D.create(probe, probe - up_direction * (lift + safe_margin), 1, [get_rid()])
	var support: Dictionary = get_world_3d().direct_space_state.intersect_ray(query)
	if support.is_empty():
		return false
	if not support.collider is StaticBody3D or (support.normal as Vector3).dot(up_direction) < cos(floor_max_angle):
		return false
	var destination: Vector3 = raised.origin
	destination.y = (support.position as Vector3).y + safe_margin
	var rise: float = (destination - global_position).dot(up_direction)
	if rise <= safe_margin or rise > step_height + safe_margin:
		return false
	if _sweep(raised, destination - raised.origin, PhysicsTestMotionResult3D.new()):
		return false
	# Los tres tramos son barridos de la cápsula completa, incluidos paredes y techo.
	global_position = destination
	return true


func _sweep(from: Transform3D, motion: Vector3, result: PhysicsTestMotionResult3D) -> bool:
	var parameters := PhysicsTestMotionParameters3D.new()
	parameters.from = from
	parameters.motion = motion
	parameters.margin = safe_margin
	return PhysicsServer3D.body_test_motion(get_rid(), parameters, result)
