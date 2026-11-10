extends CanvasLayer

## Presets de calidad compartidos por el barrio; Alto usa la resolución completa.
const CONFIG_PATH := "user://quality.cfg"
const QUALITY_LOW := 0
const QUALITY_MEDIUM := 1
const QUALITY_HIGH := 2

@onready var _selector: OptionButton = $PanelContainer/MarginContainer/Row/Quality


func _ready() -> void:
	_selector.add_item("Bajo", QUALITY_LOW)
	_selector.add_item("Medio", QUALITY_MEDIUM)
	_selector.add_item("Alto", QUALITY_HIGH)
	_selector.item_selected.connect(_on_quality_selected)
	var config := ConfigFile.new()
	var quality := QUALITY_HIGH
	if config.load(CONFIG_PATH) == OK:
		quality = clampi(int(config.get_value("graphics", "quality", QUALITY_HIGH)), QUALITY_LOW, QUALITY_HIGH)
	_selector.select(quality)
	# El mapa crea el entorno y el sol en Main._ready(), después de este hijo.
	_apply_quality.call_deferred(quality)


func _on_quality_selected(index: int) -> void:
	_apply_quality(index)
	var config := ConfigFile.new()
	config.set_value("graphics", "quality", index)
	config.save(CONFIG_PATH)


func _apply_quality(quality: int) -> void:
	var world := get_parent().get_node_or_null("WorldEnvironment") as WorldEnvironment
	var sun := get_parent().get_node_or_null("Sun") as DirectionalLight3D
	if world == null or sun == null:
		return
	match quality:
		QUALITY_LOW:
			get_viewport().scaling_3d_scale = 0.7
			get_viewport().msaa_3d = Viewport.MSAA_DISABLED
			sun.shadow_enabled = false
			world.environment.fog_enabled = false
		QUALITY_MEDIUM:
			get_viewport().scaling_3d_scale = 0.85
			get_viewport().msaa_3d = Viewport.MSAA_DISABLED
			sun.shadow_enabled = true
			sun.directional_shadow_max_distance = 65.0
			world.environment.fog_enabled = true
		_:
			get_viewport().scaling_3d_scale = 1.0
			# MSAA 2x suaviza siluetas y asas sin desenfoque temporal en Compatibility.
			get_viewport().msaa_3d = Viewport.MSAA_2X
			sun.shadow_enabled = true
			sun.directional_shadow_max_distance = 100.0
			world.environment.fog_enabled = true
