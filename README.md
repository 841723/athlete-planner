# Athlete Planner

Athlete Planner es una aplicación personal para organizar y revisar la
preparación de un Ironman 70.3. Reúne tus actividades reales, tus sesiones
planificadas, tus objetivos y el asesoramiento de una IA en un mismo lugar.

## Inicio de sesión

Entra con tu cuenta de Google. Si tienes acceso a más de un atleta, puedes
cambiar de tenant desde el selector situado junto a tu perfil.

Cada atleta tiene sus propios entrenamientos, objetivos, perfil, planes,
configuración y conversación con el entrenador.

## Inicio

La pantalla de Inicio muestra:

- El objetivo principal y los hitos próximos.
- El progreso general y los días restantes.
- La racha de entrenamiento.
- El volumen semanal.
- Las sesiones de hoy y mañana.
- Las actividades realizadas más recientes.

El botón **Sincronizar** actualiza las actividades de Garmin Connect cuando tú
lo solicitas. La aplicación no sincroniza datos automáticamente.

## Calendario

El calendario reúne en una sola vista:

- Actividades realizadas.
- Sesiones que todavía están planificadas.
- Filtros por deporte y rango de fechas.
- El detalle de cada día y de cada sesión.

El calendario es la única vista general que utiliza días del mes para orientarse
visualmente. En móvil presenta una versión compacta y permite abrir las sesiones
del día en una vista inferior.

## Actividades realizadas

Cada actividad sincronizada conserva sus datos disponibles, como:

- Deporte, duración y distancia.
- Ritmo, velocidad, frecuencia cardiaca y potencia.
- Desnivel, calorías, efecto del entrenamiento y temperatura.
- Vueltas, segmentos, mejores esfuerzos y zonas de frecuencia cardiaca.
- RPE, sensación y notas personales.

Puedes editar el título y las notas de una actividad. El detalle de una sesión
muestra su fecha completa y permite navegar a la actividad anterior o siguiente.

## Planificadas

En **Planificadas** puedes:

- Crear sesiones manuales.
- Generar planes con IA.
- Abrir cada plan y revisar sus sesiones.
- Ver el progreso de sesiones realizadas frente al total del plan.
- Reintentar una generación que haya fallado.

Las fechas de planificación se muestran como `martes #14`. Los rangos de un
plan se muestran como `jueves #15 - miércoles #17`.

Cuando una actividad real coincide con una sesión planificada, la aplicación las
fusiona automáticamente. La sesión planificada no desaparece: queda marcada como
realizada y ofrece el enlace **Ver actividad realizada**.

Un plan solo aparece como **Completado** cuando se han realizado todas sus
sesiones. Mientras queden sesiones pendientes aparece como **En curso**.

## Chat con el entrenador

Cada plan tiene una conversación con la IA. El entrenador recibe:

- El perfil y los deportes de enfoque.
- Las sesiones del plan.
- Todas las actividades reales anteriores del atleta.
- Las métricas y notas escritas en esas actividades.
- El historial de la conversación.

Al enviar un mensaje, aparece inmediatamente en el hilo aunque la IA todavía
esté pensando o termine dando un error. Si la IA propone cambios, las sesiones
ya realizadas no se borran.

Al generar un plan nuevo, la IA utiliza el detalle de las actividades reales de
las últimas cuatro semanas.

## Semanal y Estadísticas

**Semanal** resume las sesiones realizadas por semana de entrenamiento, deporte,
horas, distancia y desnivel.

**Estadísticas** muestra totales, evolución del volumen, distribución por
deporte, ritmos, velocidades y récords personales.

Las sesiones planificadas no cuentan como entrenamiento realizado hasta que se
fusionan con una actividad real.

## Objetivos

En Configuración puedes definir el objetivo principal y los hitos intermedios,
con fecha, deporte, ritmo objetivo, color y enlace opcional.

Los objetivos se muestran con el formato `domingo semana #24`.

## Configuración

La configuración permite gestionar:

- Nombre del atleta o tenant.
- Fecha de inicio y semana de entrenamiento.
- Deportes principales.
- Perfil deportivo usado por la IA.
- Objetivos y hitos.
- Proveedor, modelo y precios de IA.
- Prompts personalizados.
- Equipamiento disponible.
- Miembros, roles y claves de acceso.
- Conexión y rango de fechas de Garmin Connect.

La interfaz solo muestra Garmin Connect como fuente de sincronización activa.

## Notificaciones

Las confirmaciones y errores importantes aparecen como avisos breves y también
se guardan en el **Buzón de notificaciones**, accesible desde el icono de la
campana.

El buzón conserva avisos como:

- Respuestas del entrenador.
- Pruebas de conexión o de modelos de IA.
- Formularios guardados correctamente.
- Errores de sincronización o configuración.

Puedes consultar avisos anteriores o vaciar el buzón cuando quieras.

### Notificaciones push del navegador

Para activar las notificaciones push hay que configurar un par de claves VAPID
en el backend. Genéralas con:

```bash
cd backend
npx web-push generate-vapid-keys --json
```

Añade los valores obtenidos al `.env` del backend:

```env
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:tu-correo@dominio.com
```

La clave privada nunca se envía al navegador. Después de cambiar estas
variables hay que reiniciar el backend. En producción, la aplicación debe
servirse mediante HTTPS; `localhost` es la excepción para desarrollo.

## Roles

- **Athlete**: propietario y acceso completo.
- **Admin**: puede gestionar el tenant y sus miembros, salvo al propietario.
- **Visitor**: puede consultar la información, pero no modificarla ni iniciar
  acciones de escritura.
