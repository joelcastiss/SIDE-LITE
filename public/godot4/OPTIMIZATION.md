# Optimización de Godot 4

## Línea base antes de cambios

Medición: Godot 4.7.2, Windows, OpenGL Compatibility, RTX 3050 Laptop GPU, escena `Main.tscn`, ventana predeterminada. Ocho muestras cada 30 fotogramas entre los fotogramas 120 y 330, con los cuatro NPC iniciales. Script de medición local: `.codex-work/godot/profile.gd`; datos: `.codex-work/godot/profile.json`. El FPS varía con VSync y el calentamiento de shaders, por lo que se muestran promedio y rango.

| Monitor de Godot | Inicial |
| --- | ---: |
| FPS | 112 promedio (67–139) |
| Draw calls / objetos dibujados | 1 559,6 |
| Primitivas renderizadas | 501 540 |
| Tiempo de proceso | 11 ms |
| Tiempo de física | 1 ms |
| Memoria estática | 46,56 MiB |
| Memoria de video | 16,60 MiB |
| Nodos | 1 085 |
| Recursos | 11 |
| Nodos huérfanos | 0 |
| Objetos físicos activos | 4 |
| Tamaño de `godot4/` sin caché | 37 561 bytes, 21 archivos |

Las primitivas son triángulos/líneas reportados por el monitor, no vértices individuales. El profiler de scripts no está accesible desde ejecución automatizada; los tiempos de proceso y física provienen de `Performance`, la misma fuente de los monitores del editor.

## Diez cuellos de botella identificados antes de editar

1. **Ciudad:** las ventanas de 16 edificios se crean como `MeshInstance3D` individuales; contribuyen a más de 1 500 draw calls.
2. **Tienda:** cada puntada y pieza de bolso crea una malla/nodo propio; los 14 bolsos multiplican llamadas de dibujo y nodos.
3. **Ciudad:** marcas viales y pasos de peatones usan cientos de `BoxMesh` y draw calls independientes.
4. **Inicio:** toda la ciudad, los 16 edificios, la tienda y la malla de navegación se generan sincrónicamente en `_ready`.
5. **Materiales PBR:** tres materiales generan nueve imágenes píxel a píxel y recalculan ruido por píxel en el inicio.
6. **Navegación:** la malla crea cuadrículas y polígonos individuales sobre 176 × 176 m, incluidas zonas fuera de la vista actual.
7. **NPC:** cada NPC consulta `get_next_path_position()` y hace avoidance en cada tick de física, incluso mientras está lejos de la cámara.
8. **NPC:** cada instancia construye su propia biblioteca y máquina de animación.
9. **Spawner:** `_process` corre cada frame solo para contar hasta el siguiente NPC.
10. **Iluminación:** una sombra direccional de 100 m cubre una zona amplia, con costo potencial de GPU, aunque las luces de la tienda ya tienen sombras desactivadas.

Estos puntos son hipótesis ordenadas por impacto probable y verificables con las medidas posteriores; los tres primeros se apoyan además en las 1 559,6 llamadas de dibujo de la línea base.

## Cambios y resultados posteriores

Medición final: mismo ejecutable, GPU, renderizador, escena, cámara y script que la línea base; preset **Alto**. Se repitió la ejecución gráfica para descartar una muestra de calentamiento de 1 FPS. La tabla usa la repetición estable de ocho muestras; los valores de FPS y tiempos fluctúan entre ejecuciones y no prueban una mejora causal por sí solos.

| Monitor de Godot | Antes | Después | Cambio |
| --- | ---: | ---: | ---: |
| FPS | 112 (67–139) | 115,9 (99–144) | +3,5 %, no concluyente |
| Draw calls | 1 559,6 | 332,5 | **−78,7 %** |
| Primitivas | 501 540 | 504 416 | +0,6 %; mismo orden de geometría |
| Tiempo de proceso | ~11 ms | 7,31 ms | ~−33 %, sensible a carga externa |
| Tiempo de física | ~0,6–0,7 ms | 1,01 ms | variación/regresión a vigilar |
| Memoria estática | 46,56 MiB | 42,30 MiB | **−9,2 %** |
| Memoria de video | 16,60 MiB | 14,02 MiB | **−15,6 %** |
| Nodos | 1 085 | 296 | **−72,7 %** |
| Recursos | 11 | 12 | +1 por interfaz de calidad |
| Nodos huérfanos | 0 | 0 | sin cambio |
| Objetos físicos activos | 4 | 4 | sin cambio |

El tiempo de física aumentó en la última ejecución, aunque una ejecución intermedia con los cambios de ciudad, tienda y NPC midió 0,58 ms. No hay evidencia suficiente para atribuir la diferencia al selector de calidad o a un cambio concreto; repetir el perfil en el equipo de destino con mayor duración antes de alterar el tick o la navegación.

### Medición por área

| Área | Cambio aplicado | Medida antes → después | Decisión |
| --- | --- | --- | --- |
| Renderizado | MultiMesh para ventanas, marcas viales y pasos de peatones; lotes locales conservan distancia de visibilidad | Draw calls globales 1 559,6 → 332,5 junto con el cambio de tienda | Mantener. La geometría no se simplificó, para conservar apariencia. |
| Scripts/tienda | MultiMesh para piezas repetidas; caché de grano PBR; limpieza de aforo in situ | Nodos globales 1 085 → 296 y memoria estática 46,56 → 42,30 MiB, junto con renderizado | Mantener. |
| NPC/navegación | Timer durante espera y para spawn; avoidance detenido durante espera; material compartido por color | Cuatro objetos físicos activos antes/después; prueba de visita completa pasó | Mantener. El efecto de CPU aislado no es medible con cuatro NPC iniciales. |
| Recursos/carga | Auditoría; sin cambios | 0 texturas, modelos o audios externos en el proyecto Godot; 0 huérfanos antes/después | No añadir streaming, atlas ni carga por zonas a 22 archivos fuente de ~44 KB antes del selector. |
| Física/calidad | Selector Bajo/Medio/Alto persistente; Alto conserva sombra de 100 m, niebla y escala 1,0 | Alto: cifras de la tabla; tres presets probados funcionalmente | Mantener. Las colisiones existentes ya son cajas/cápsulas. |

El tamaño fuente de `godot4/` sin `.godot/` pasó de 37 561 a 46 808 bytes, principalmente por este informe y el selector. No hay assets importados que comprimir. Los lotes MultiMesh reducen llamadas de dibujo y nodos, no triángulos ni el tamaño de las imágenes PBR. No se cambiaron los destinos de navegación, el aforo, las sombras del preset Alto ni la apariencia geométrica.

### Verificación

- `--headless --path godot4 --editor --quit`: sin errores de parseo.
- `tests/map_navigation.gd`: tres rutas conectadas.
- `tests/smoke.gd`: malla, aforo y ciclo de visita correctos.
- `tests/npc_flow_smoke.gd`: `NPC_FLOW_OK` tras 3 600 frames.
- Presets Bajo, Medio y Alto: comprobación funcional del selector.
- `git diff --check`: sin errores de formato.

### Recomendaciones pendientes

- Repetir la captura de FPS, proceso y física durante varios minutos y con los 14 NPC máximos en hardware objetivo; las muestras actuales son cortas y tienen ruido.
- Revisar oclusión, LOD y sombras con comparaciones visuales antes de reducir geometría o alcance. La escena no tiene modelos ni texturas importados, por lo que compresión VRAM, atlas, audio streaming y carga threaded no aplican aún.
- Si el proyecto incorpora nuevos barrios o modelos pesados, perfilar la carga inicial y entonces considerar zonas cargables, bake de luz y NavMesh por región. El mapa actual es procedural y compacto.
