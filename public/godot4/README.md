# SIDE Ciudad de Bolsos — Godot 4

Proyecto Godot 4 independiente del simulador web que permanece en la raíz de
`SIDE1`. Abre `godot4/project.godot` con Godot 4.4 o posterior y ejecuta la escena principal.
El barrio tiene suelo físico continuo, jugador controlable y 24 NPC
persistentes distribuidos entre calles, plazas y tienda.

WASD/flechas para caminar, Mayús para correr, espacio para saltar, botón
derecho para girar la cámara y Tab para alternar el panorama del barrio.

## Estructura

- `scenes/Main.tscn` y `scripts/mapa.gd`: ciudad, suelo sólido y mobiliario.
- `scripts/world_navigation.gd`: navegación desde las colisiones reales.
- `scripts/world_ambience.gd`: iluminación, materiales y señalización urbana.
- `scenes/Player.tscn` y `scripts/player_controller.gd`: jugador y cámaras.
- `scenes/Shop.tscn` y `scripts/shop_controller.gd`: puerta con Area3D, aforo,
  vitrinas y tres variantes de bolso con materiales PBR originales.
- `scenes/Npc.tscn`, `scenes/NpcSpawner.tscn` y `scripts/npc_*.gd`: gestor
  persistente, FSM, navegación y detalle por distancia sin eliminar NPC.
- `CREDITS.md`: procedencia y licencias de los recursos usados.

## Comprobación

Ejecuta los comandos desde la raíz **SIDE1**. La
[guía de entrega a 1080p](../docs/GODOT_VALIDACION_1080_2026_10_09.md) incluye configuración,
lista de archivos, pruebas manuales y comandos PowerShell con logs locales.
Las pruebas cubren soporte físico, cruces con teclado real, rutas libres de
obstáculos, población persistente, aforo y visitas completas. La navegación
se genera al iniciar; sus polígonos no se guardan como recurso binario.

Para ejecutar la regresión desde SIDE1:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File tests/run_godot_qa.ps1
```
