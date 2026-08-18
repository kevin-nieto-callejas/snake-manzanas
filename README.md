# Snake Manzanas 🍎🐍

> **Modo de pruebas activo:** los cuatro mundos están desbloqueados y perder
> la campaña no vuelve a bloquearlos. Cambia `MODO_PRUEBAS` a `false` para
> restaurar la progresión normal.

Snake clásico con una campaña de 4 mundos. Cada mundo cambia el tablero
y añade una mecánica nueva: maduración de manzanas, un gusano cazador
y un rastro que envenena tu propio camino.

## Controles

* **Teclado**: flechas ↑ ↓ ← →
* **Pausa**: barra espaciadora para pausar o continuar. Esc solo pausa;
  no reanuda la partida. Desde la pausa también puedes reiniciar el mundo
  o volver al selector de mundos.
* **Táctil**: swipe sobre el tablero en la dirección deseada
* **D-pad en pantalla**: aparece automáticamente en dispositivos táctiles o pantallas angostas

## Los 4 mundos

| # | Mundo | Meta (cosecha) | Mecánica |
|---|---|---|---|
| 1 | El Huerto | 12 manzanas | Muros sólidos. Las manzanas sanas se pudren si tardas. Si las 3 quedan podridas, comienza una cuenta de 3 segundos y tres invasores salen de esquinas elegidas al azar y te persiguen durante 10; sobrevivir recupera una manzana sana y ser atrapado cuesta una vida. |
| 2 | La Bodega | 15 manzanas | El gusano señala y devora cualquier manzana, sana o podrida, y crece 2 segmentos. Cada manzana que come reaparece podrida. Cuando las 3 manzanas están podridas se vuelve rojo, acelera y persigue a la serpiente. |
| 3 | El Manzano Podrido | 18 manzanas | Muros sólidos. Empieza con 4 obstáculos mortales y cada manzana que comes, buena o podrida, agrega 2 más en posiciones aleatorias. Cada celda por la que pasas también deja un rastro mortal temporal; la manzana con gusano parte tu longitud a la mitad. |
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
* Al agotar las 3 vidas, la partida termina. El botón de reinicio vuelve
  a **El Huerto** con 0 puntos, 0 cosecha y las 3 vidas restauradas.
* No se descuentan puntos al perder: el marcador nunca puede ser negativo.
* Al quedarse sin vidas se pierde el progreso de la campaña: solo queda
  desbloqueado El Huerto. El mejor puntaje se conserva como récord.
* El mundo máximo desbloqueado y el mejor puntaje se guardan en
  `localStorage` mientras la campaña continúa.

## Tecnologías

HTML5 (`<canvas>`), CSS3 y JavaScript vanilla — **sin frameworks, sin
dependencias ni build**. Se juega abriendo `index.html` directamente
en el navegador (doble clic), sin servidor.
