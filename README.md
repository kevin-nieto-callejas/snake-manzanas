# Snake Manzanas 🍎🐍

Snake clásico con una campaña de cuatro mundos, enemigos, obstáculos,
manzanas podridas y un jefe final.

> **Modo de pruebas activo:** los cuatro mundos están desbloqueados.
> Para restaurar la progresión normal, cambia `MODO_PRUEBAS` a `false`
> en `script.js`.

## Controles

- **Flechas ↑ ↓ ← →:** mover la serpiente.
- **Barra espaciadora:** pausar o reanudar la partida.
- **Esc:** pausar la partida. Esc no reanuda.
- **Pantallas táctiles:** deslizar sobre el tablero.
- **Pantallas pequeñas:** aparece un control direccional táctil.

## Los 4 mundos

| # | Mundo | Objetivo | Mecánica principal | Dificultad |
|---|---|---:|---|---|
| 1 | **El Huerto** | 12 manzanas | Las manzanas sanas se pudren con el tiempo. Si todas se pudren, aparecen tres gusanos invasores durante 10 segundos. | ⭐⭐ |
| 2 | **La Bodega** | 15 manzanas | Un gusano café señala y persigue cualquier manzana, sana o podrida. Cuando todas quedan podridas, se vuelve rojo y aumenta su velocidad. | ⭐⭐⭐ |
| 3 | **El Manzano Podrido** | 18 manzanas | Hay obstáculos naranjas mortales. Cada manzana comida agrega dos obstáculos nuevos y también puede aparecer un rastro peligroso. | ⭐⭐⭐⭐ |
| 4 | **El Corazón de la Plaga** | Derrotar al jefe | Batalla final por fases. Las manzanas se mueven lentamente y el jefe tiene una barra de vida. | ⭐⭐⭐⭐⭐ |

## Mundo 1: El Huerto

Debes conseguir 12 manzanas sanas.

Las manzanas pueden pudrirse si tardas demasiado. Cuando las tres manzanas
están podridas:

- El tablero cambia a un tono oscuro.
- Aparece una cuenta regresiva.
- Tres gusanos invasores aparecen desde esquinas aleatorias.
- Los gusanos persiguen a la serpiente durante 10 segundos.
- Si sobrevives, una manzana podrida vuelve a estar sana.
- Si un gusano alcanza a la serpiente, pierdes una vida.

## Mundo 2: La Bodega

Debes conseguir 15 manzanas.

El gusano café señala una manzana y se dirige hacia ella. Puede comer
manzanas sanas o podridas.

Cuando el gusano come una manzana:

- Crece dos segmentos.
- La manzana reaparece podrida.
- Cuando todas las manzanas están podridas, el gusano cambia a color rojo.
- En su forma roja se mueve más rápido y persigue directamente al jugador.

## Mundo 3: El Manzano Podrido

Debes conseguir 18 manzanas.

- Aparecen obstáculos naranjas que provocan la pérdida de una vida.
- Cada manzana comida agrega dos obstáculos nuevos.
- Los obstáculos permanecen al reaparecer después de perder una vida.
- La serpiente reaparece en una zona segura.
- El rastro de la serpiente puede convertirse en un peligro temporal.
- Una manzana con gusano reduce la longitud de la serpiente a la mitad.

## Mundo 4: El Corazón de la Plaga

Este es el mundo final y consiste en una batalla contra un jefe.

- El mundo tiene varias fases.
- Cada fase muestra una pantalla de preparación.
- El jefe tiene una barra de vida.
- Las manzanas se mueven lentamente por el tablero.
- Debes conseguir manzanas y evitar los ataques del jefe.
- La dificultad aumenta durante las fases.
- Al derrotar al jefe aparece una animación especial.

### Dominio Infinito

Después de derrotar al jefe comienza el modo **Dominio Infinito**.

- La serpiente conserva su tamaño.
- Se conserva la cantidad de manzanas recogidas.
- Se conserva la puntuación.
- Desaparecen los obstáculos y el jefe.
- Solo aparecen manzanas sanas.
- Las manzanas siguen moviéndose por el tablero.
- El objetivo es llenar todas las casillas posibles.
- La partida continúa hasta completar todo el tablero.

## Reglas de cosecha y vidas

- Cada mundo comienza con tres vidas.
- Perder una vida reinicia la posición de la serpiente.
- La serpiente reaparece con cuatro segmentos.
- La cosecha acumulada se conserva al perder una vida.
- Los puntos nunca pueden ser negativos.
- Comer una manzana sana aumenta la cosecha.
- Comer una manzana con gusano reduce la serpiente a la mitad.
- Al perder las tres vidas, la partida termina.
- El botón de reinicio devuelve la partida al primer mundo.
- En modo de pruebas, los mundos permanecen desbloqueados.
- El mejor puntaje se guarda como récord en `localStorage`.

## Tecnologías

- HTML5 Canvas
- CSS3
- JavaScript vanilla
- Sin frameworks
- Sin dependencias externas
- Sin proceso de compilación

## Cómo jugar

Abre el archivo `index.html` directamente en cualquier navegador moderno.

También puedes jugar desde GitHub Pages:

[Snake Manzanas](https://kevin-nieto-callejas.github.io/snake-manzanas/)
