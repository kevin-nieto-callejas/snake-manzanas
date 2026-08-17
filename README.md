# Snake Manzanas 🍎🐍

Snake clásico con una campaña de 4 mundos. Cada mundo cambia el tablero
y añade una mecánica nueva: maduración de manzanas, un gusano cazador
y un rastro que envenena tu propio camino.

## Controles

* **Teclado**: flechas ↑ ↓ ← →
* **Táctil**: swipe sobre el tablero en la dirección deseada
* **D-pad en pantalla**: aparece automáticamente en dispositivos táctiles o pantallas angostas

## Los 4 mundos

| # | Mundo | Meta (cosecha) | Mecánica |
|---|---|---|---|
| 1 | El Huerto | 12 manzanas | Muros sólidos. Las manzanas sanas se pudren solas si tardas en comerlas: mira el anillo que se vacía y el parpadeo antes de que sea tarde. |
| 2 | La Bodega | 15 manzanas | Muros wrap (atraviesas los bordes) + 4 cajas fijas. Un gusano cazador persigue la manzana sana más cercana; si llega antes que tú, la infecta. |
| 3 | El Manzano Podrido | 18 manzanas | Muros sólidos. Cada celda por la que pasas queda mortal un rato (rastro translúcido, más tenue cuanto más cerca de liberarse). Aquí la manzana con gusano es tu botón de pánico: parte tu longitud a la mitad para escapar del rastro. |
| 4 | Cosecha Infinita | Sin límite | Muros wrap + obstáculos + maduración + gusano cazador, todo a la vez. Se desbloquea al completar el mundo 3; aquí el marcador relevante son los puntos, y es donde se guarda el récord. |

Solo se puede jugar un mundo desbloqueado; los bloqueados aparecen en
gris con candado en la pantalla de inicio.

## Reglas de cosecha y vidas

* La meta de cada mundo se mide en **cosecha** (manzanas *sanas*
  comidas), no en puntos.
* Comer una manzana con gusano resta 1 a la cosecha (mínimo 0),
  además de reducir la serpiente a la mitad de su longitud y restar
  puntos.
* Cada mundo empieza con **3 vidas**. Perder una vida reaparece con
  la serpiente a 4 segmentos, conservando la cosecha acumulada.
* Al agotar las 3 vidas, el mundo se reinicia por completo (cosecha a
  0, vidas restauradas) con una penalización de −25 puntos.
* Los puntos se acumulan entre reinicios; la longitud y la cosecha, no.
* El progreso (mundo máximo desbloqueado y mejor puntaje) se guarda en
  `localStorage` y persiste entre partidas.

## Tecnologías

HTML5 (`<canvas>`), CSS3 y JavaScript vanilla — **sin frameworks, sin
dependencias ni build**. Se juega abriendo `index.html` directamente
en el navegador (doble clic), sin servidor.
