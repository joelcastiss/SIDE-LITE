extends SceneTree


func _initialize() -> void:
	print("NPC_TEST_STARTED")
	call_deferred("_run")


func _run() -> void:
	var main: Node3D = (load("res://scenes/Main.tscn") as PackedScene).instantiate()
	root.add_child(main)
	var spawner: Node3D = main.get_node("NpcSpawner")
	var shop: Node3D = main.get_node("Shop")
	var test_seed: int = 20261009
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("--seed="):
			test_seed = argument.trim_prefix("--seed=").to_int()
	for index: int in range(spawner.get_child_count()):
		(spawner.get_child(index) as ShopNpc)._rng.seed = test_seed + index
	print("NPC_FLOW_SEED=%d" % test_seed)
	await physics_frame
	assert(spawner.get_child_count() > 0, "El spawner no creó NPCs")
	var first: ShopNpc = spawner.get_child(0)
	var origin := first.global_position
	var saw_inside := false
	var saw_exit := false
	var travelled: float = 0.0
	var previous: Vector3 = first.global_position
	for frame in range(3600):
		await physics_frame
		travelled += first.global_position.distance_to(previous)
		previous = first.global_position
		if first.inside_shop:
			saw_inside = true
		elif saw_inside:
			saw_exit = true
		assert(shop._occupants.size() <= shop.max_capacity, "Aforo excedido")
	print("NPC_FLOW_MOVEMENT displacement=%.4f travelled=%.4f inside=%s exit=%s final=%s state=%d" % [first.global_position.distance_to(origin), travelled, saw_inside, saw_exit, first.global_position, first.state])
	# Un peatón puede regresar al origen: medir recorrido, no desplazamiento neto.
	if travelled <= 3.0:
		push_error("NPC_FLOW_FAILED: recorrido menor de 3 m; recorrido=%.4f inside=%s exit=%s" % [travelled, saw_inside, saw_exit])
		quit(1)
		return
	if not saw_inside or not saw_exit:
		for npc: ShopNpc in spawner.get_children():
			if npc.global_position.distance_to(shop.global_position) < 12.0:
				print("FLOW_DIAG name=%s pos=%s state=%d vel=%s target=%s detour=%s resume=%s blocked=%d stops=%d timer=%f inside=%s" % [npc.name, npc.global_position, npc.state, npc.velocity, npc.navigation_agent.target_position, npc._taking_detour, npc._resume_destination, npc._blocked_samples, npc.browse_stops, npc.wait_timer.time_left, npc.inside_shop])
		push_error("NPC_FLOW_FAILED seed=%d: entró=%s salió=%s first_pos=%s first_state=%d first_target=%s" % [test_seed, saw_inside, saw_exit, first.global_position, first.state, first.navigation_agent.target_position])
		quit(1)
		return
	print("NPC_FLOW_OK")
	quit()
