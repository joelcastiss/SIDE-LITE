# Verificación de fuentes CC0 para NPC

## Continuación local del 09-10-2026

Se contrastaron nuevamente las páginas oficiales de [Ultimate Modular Men](https://quaternius.com/packs/ultimatemodularcharacters.html), [Ultimate Modular Women](https://quaternius.com/packs/ultimatemodularwomen.html), [Animated Men](https://quaternius.com/packs/animatedmen.html) y [Animated Women](https://quaternius.com/packs/animatedwomen.html). Todas identifican a Quaternius y enlazan CC0. Esta comprobación de licencia no aprueba automáticamente modelos ni sustituye la revisión de ropa, rig y deformación.

El manifiesto local ya tenía **16 NPC**. Se conservaron sus entradas y GLB sin cambios; esta tanda no constituye una nueva aprobación técnica de esos archivos. Los errores de cuota registrados abajo describen intentos anteriores, no el inventario actual obtenido mediante espejos.

| Modelo entrante | Procedencia y licencia | Resultado de esta tanda |
| --- | --- | --- |
| `man_farmer.gltf` → `city_man_farmer.glb` | Quaternius, Ultimate Modular Men, CC0 1.0. [Archivo del espejo](https://github.com/agentkaerf/FreeModels/blob/main/Ultimate%20Modular%20Men-%20Feb%202022/Individual%20Characters/glTF/Farmer.gltf), contrastado byte a byte con el archivo local el 09-10-2026. | **Aprobado e incorporado** para almacén/proveedor: camisa, overol, botas cerradas; rig con skin, Idle/Walk/Run In Place y revisión visual de los tres renders. |
| `man_punk.gltf` | Candidato local de Ultimate Modular Men; no se publica ni se amplía su acreditación individual. | Supera la validación numérica; excluido por el vestuario Punk y pantalón roto de la curación existente. |
| `woman_punk.gltf` | Candidato local de Ultimate Modular Women; no se publica ni se amplía su acreditación individual. | Supera la validación numérica; excluido por el vestuario Punk y pantalón roto de la curación existente. |

SHA-256 del glTF Farmer local y remoto: `46d3e85fa8d848ee479ab8e4672c16724ee4ea51f3af5733705a153937f93555`.
SHA-256 del GLB aprobado: `f8de24356098eb479d882f22f87e3a0d485f9bc828352adfc1e0e901ce4618ca`.
La referencia de licencia del lote está en `Quaternius_Ultimate_Modular_City_CC0.txt`; no se presenta como una licencia extraída de un ZIP de Farmer. La declaración del autor está en la página oficial del pack y remite a [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

Resultado actual: **17 NPC en el manifiesto**, con una única alta en esta tanda. Medidas y decisiones: [informe](../reports/quaternius_validation_2026-10-09.md) y [evidencia JSON](../reports/quaternius_validation_2026-10-09.json). Las bases Superhero, bibliotecas de animación, Mixamo y En3D no reciben nuevas aprobaciones. Los cuatro avatares elegibles del jugador permanecen intactos.

## Registro histórico del 29-09-2026 (anterior al catálogo incorporado)

Comprobado el 29-09-2026. Autor de los packs Quaternius: **Quaternius**. Las páginas oficiales enlazan a CC0 y permiten uso personal, educativo y comercial. La licencia CC0 1.0 se consulta en https://creativecommons.org/publicdomain/zero/1.0/.

| Pack | Página oficial | Contenido anunciado | Resultado para este lote |
| --- | --- | --- | --- |
| Universal Base Characters | https://quaternius.com/packs/universalbasecharacters.html | Bases humanoides compatibles con Universal Animation Library; CC0 | ZIP Standard existente, pero contiene solo bases Superhero masculina y femenina sin ropa de ciudad. Excluido por vestuario. Licencia del ZIP copiada aquí. |
| Universal Animation Library 2 | https://quaternius.com/packs/universalanimationlibrary2.html | 130+ animaciones humanoides; CC0 | ZIP Standard existente; no aporta el trío Idle/Walk/Run civil requerido y probado en el mismo rig. Licencia del ZIP copiada aquí. |
| Ultimate Modular Men | https://quaternius.com/packs/ultimatemodularcharacters.html | 11 personajes y 24 animaciones; CC0 | Descarga oficial de Google Drive limitada por cuota. No se obtuvo ni validó ningún personaje. |
| Ultimate Modular Women | https://quaternius.com/packs/ultimatemodularwomen.html | 10 personajes y 24 animaciones; CC0 | La carpeta oficial de Drive se pudo listar; `Humanoid Rigs/Individual Characters/FBX/Casual.fbx` y `License.txt` devolvieron "Too many users have viewed or downloaded this file recently" con gdown. No se obtuvo ni validó ningún personaje. |
| Animated Women | https://quaternius.com/packs/animatedwomen.html | 4 personajes animados; CC0 | `FBX/Female_Casual.fbx` de la carpeta oficial devolvió el mismo error de cuota. No se obtuvo ni validó ningún personaje. |
| Animated Men | https://quaternius.com/packs/animatedmen.html | 4 personajes animados; CC0 | Fuente localizada, sin modelo descargado o validado. |
| Kenney Blocky Characters | https://kenney.nl/assets/blocky-characters | 20 archivos 3D animados; CC0 | Excluido por estilo blocky, fuera del requisito realista/semirrealista. |
| Kenney Mini Characters | https://kenney.nl/assets/mini-characters | 25 archivos 3D animados; CC0 | Excluido por estilo mini caricaturesco. |

El sello CC0 de una página no acredita que un modelo cumpla vestuario, rig, desplazamiento In Place o calidad de deformación. **Ningún modelo de estas fuentes se aprobó para el manifiesto.** Las licencias de los dos ZIP locales se adjuntan como archivos separados; para los packs bloqueados por cuota se registra la evidencia de su página oficial, sin atribuirles una licencia extraída de archivos no descargados.
