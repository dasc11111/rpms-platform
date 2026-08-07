# Design System — RPMS / SIGR

Version 1.0.0 · Fase 3.5

Este documento es la referencia oficial y obligatoria para el desarrollo de
cualquier pantalla, componente o modulo dentro de la plataforma RPMS
(Radiation Protection Management System), incluyendo el SIGR (Sistema
Integral de Gestion de Radioterapia) y todos los modulos futuros.

Ningun modulo debe definir sus propios colores, tipografias, iconos,
semaforos, tablas o formularios. Todo debe reutilizar lo definido aqui.

---

## 1. Identidad visual

- **Nombre del sistema:** RPMS — Radiation Protection Management System.
- **Submodulo:** SIGR — Sistema Integral de Gestion de Radioterapia.
- **Logotipo:** aun no se ha definido un isotipo grafico; el sistema queda
  preparado para incorporarlo en el header del sidebar (frontend/web/src/components/layout/sidebar.tsx)
  sin requerir cambios estructurales, reemplazando el icono placeholder actual.
- **Estilo general:** interfaz hospitalaria moderna, oscura por defecto,
  limpia, con alto contraste para uso clinico y operativo bajo presion de
  tiempo (turnos, salas de control de acelerador, emergencias radiologicas).

### 1.1 Paleta cromatica institucional

La paleta vive como variables CSS HSL en `frontend/web/src/app/globals.css`
y se expone a Tailwind en `tailwind.config.js`. Nunca se debe escribir un
color hexadecimal o rgb directamente en un componente: siempre usar las
clases semanticas.

| Token | Uso | Modo claro | Modo oscuro |
|---|---|---|---|
| background / foreground | Fondo y texto base de la app | blanco / gris oscuro | gris casi negro / blanco |
| surface / surface-elevated / surface-overlay | Tarjetas, paneles, modales | blancos | grises oscuros escalonados |
| border / input | Bordes y controles | gris claro | gris oscuro |
| accent | Color de marca, acciones primarias | azul | azul |
| success / warning / danger / info | Estados semanticos | verde / ambar / rojo / azul | variantes ajustadas para oscuro |
| *-subtle | Fondos suaves para badges y alertas | version muy clara del color | version muy oscura del color |

### 1.2 Colores de apoyo, alertas y semaforo

Ver seccion 4 (Semaforo institucional). Los graficos usan una paleta fija
adicional (`CHART_PALETTE` en `lib/design-system.ts`) para mantener
coherencia entre todos los graficos de la plataforma.

### 1.3 Colores para impresion

Los reportes PDF (jsPDF) y vistas de impresion deben usar texto negro sobre
fondo blanco sin depender de las variables CSS (que no se aplican en el
render de PDF). Usar las clases `printBody` y `printHeader` de
`TYPOGRAPHY.scale` como referencia de tamano tipografico impreso.

---

## 2. Tipografia

Definida en `frontend/web/src/lib/design-system.ts`, objeto `TYPOGRAPHY`.

- **Fuente principal:** system-ui / -apple-system / Segoe UI / Roboto (sans-serif del sistema, sin carga externa, maxima velocidad).
- **Fuente secundaria (monoespaciada):** usada solo para codigos, numeros de serie, folios y valores tecnicos.
- **Escala:** display, h1, h2, h3, subtitle, body, bodyLg, small, kpiValue, kpiLabel, tableHeader, tableCell, printBody, printHeader.

Cada pantalla debe importar `TYPOGRAPHY.scale.<nombre>` en vez de escribir
clases de tamano/peso a mano, para que un cambio futuro de escala se
propague a toda la plataforma.

---

## 3. Iconografia

Biblioteca unica en `frontend/web/src/lib/icons.ts`, basada en
`lucide-react` (ya incluido en el proyecto). Expone un registro `ICONS`
con una clave por dominio funcional (dashboard, radioterapia, acelerador,
qc, comisionamiento, dosimetria, proteccionRadiologica, instrumentos,
blindajes, mantenimiento, documentos, reportes, usuarios, alertas,
emergencias, incidentes, auditorias, configuracion, calendario, hospital,
bunker, paciente, equipo, empresa, archivo, pdf, excel, csv, qr, firma,
historial, timeline). Ningun modulo debe importar un icono de lucide-react
directamente: siempre `import { ICONS } from "@/lib/icons"`.

---

## 4. Semaforo institucional unico

Definido en `lib/design-system.ts` (`SEMAPHORE`, `semaphoreFromStatus`,
`semaphoreFromDaysRemaining`) y consumido visualmente por
`components/ui/Badge.tsx` (`StatusBadge`, `SemaphoreDot`).

| Nivel | Emoji | Significado | Ejemplo de uso |
|---|---|---|---|
| ok | Verde | Correcto | Equipo operativo, dosimetria vigente |
| warning | Amarillo | Atencion | Documento pendiente de revision |
| urgent | Naranjo | Proximo vencimiento | Calibracion vence en menos de 15 dias |
| critical | Rojo | Critico | Equipo fuera de servicio, incidente abierto |
| unknown | Blanco | Sin informacion | Campo no registrado aun |
| disabled | Negro/gris | Deshabilitado | Equipo dado de baja |

Toda la plataforma debe derivar el color de un estado usando
`semaphoreFromStatus(status)` o `semaphoreFromDaysRemaining(dias)`, nunca
mediante condicionales ad-hoc dentro de cada componente.

---

## 5. Componentes reutilizables

Ubicados en `frontend/web/src/components/ui/`, exportados desde un unico
barrel (`components/ui/index.ts`):

- **Button** — variantes primary/secondary/outline/ghost/danger/success, tamanos sm/md/lg/icon, soporta estado `loading`.
- **Card / CardHeader / CardTitle / CardDescription / CardContent / CardFooter** — contenedor estandar para paneles, KPIs y formularios.
- **Badge / StatusBadge / SemaphoreDot** — etiquetas de estado con la logica de semaforo unica.
- **KpiCard** — tarjeta de indicador con icono, valor, tendencia y color de semaforo opcional.
- **Modal** — dialogo centrado con overlay, tamanos sm/md/lg/xl, cierre con Escape o click fuera.
- **FormField / Input / Textarea / Select** — primitivas de formulario con label, indicador de obligatoriedad, error y hint.
- **Tabs** — navegacion por pestanas reutilizada en todos los modulos con multiples secciones (igual patron que Radioterapia y Acelerador Lineal).
- **SmartTable** — tabla inteligente unica (ver seccion 6).
- **BarChartCard / LineChartCard / AreaChartCard / DonutChartCard / RadarChartCard / GaugeChartCard** — biblioteca de graficos estandar (ver seccion 8).
- **Alert / EmptyState / Spinner** — feedback visual (mensajes, estados vacios, carga).

Regla de oro: si una pantalla necesita un boton, tarjeta, tabla, modal o
badge, debe importarlo desde `@/components/ui`. Nunca duplicar su
implementacion dentro de un modulo especifico.

---

## 6. Tabla inteligente (SmartTable)

Componente generico `SmartTable<T>` en `components/ui/Table.tsx`. Recibe
columnas tipadas (`accessor`, `sortValue`, `width`, `frozen`) y un arreglo
de datos. Funcionalidad incluida:

- Busqueda global instantanea.
- Ordenamiento por columna (ascendente/descendente).
- Ocultar/mostrar columnas mediante un menu, con persistencia en
  `localStorage` por `storageKey` (config por tabla y por usuario del navegador).
- Vista compacta / extendida (alterna el alto de fila).
- Columnas congeladas (`frozen: true`) mediante `position: sticky`.
- Copiar la tabla visible al portapapeles en formato TSV.
- Exportar a Excel (`.xlsx`) usando la libreria `xlsx` ya incluida en el proyecto.

Todas las categorias (equipos, dosimetria, transporte, incidentes,
auditorias, etc.) deben usar este componente en lugar de tablas HTML
manuales.

---

## 7. Formularios

Estandar unico mediante `FormField`, `Input`, `Textarea` y `Select`
(`components/ui/Form.tsx`):

- Etiqueta siempre visible sobre el campo.
- Asterisco rojo para campos obligatorios (`required`).
- Mensaje de error en rojo bajo el campo cuando la validacion falla.
- Mensaje de ayuda (`hint`) en gris cuando no hay error.
- Bordes en color `danger` cuando `invalid` es verdadero, para retroalimentacion inmediata.

Los modulos existentes (Radioterapia, Acelerador Lineal, Dosimetria,
Transporte) deben migrar progresivamente sus formularios a estas
primitivas al modificarse; los formularios nuevos deben usarlas desde el
primer commit.

---

## 8. Dashboards y graficos

Estructura estandar de dashboard: fila superior de `KpiCard` (indicadores
rapidos con semaforo), seguida de una grilla de tarjetas `Card` que
contienen graficos de `components/ui/Charts.tsx`.

Biblioteca de graficos (basada en `recharts`, ya incluido en el proyecto),
con paleta de colores fija (`CHART_PALETTE`) para que las series se vean
siempre igual sin importar el modulo:

- **BarChartCard** — comparaciones discretas (incidentes por severidad, equipos por estado).
- **LineChartCard** — tendencias temporales (dosis acumulada, mediciones periodicas).
- **AreaChartCard** — tendencias con enfasis de magnitud acumulada.
- **DonutChartCard** — distribucion porcentual (equipos por tipo, hallazgos por categoria).
- **RadarChartCard** — comparacion multivariable (cumplimiento por area).
- **GaugeChartCard** — un unico indicador contra un maximo (ocupacion de bodega de residuos, avance de un plan de calibracion).

Regla de seleccion: series temporales -> linea o area; comparacion entre
categorias -> barras; proporcion de un total -> donut; una sola metrica
contra un limite -> gauge; comparacion de varias dimensiones -> radar.

---

## 9. Diseno responsive

Breakpoints de referencia (`BREAKPOINTS` en `lib/design-system.ts`),
alineados con los breakpoints por defecto de Tailwind (`md`, `lg`, `xl`):
notebook (1366px), desktop Full HD (1920px), QHD (2560px) y tablet
(768px). El layout de dashboards usa grillas que colapsan de 4 columnas en
desktop a 1 columna en tablet. Se deja reservado un breakpoint movil futuro
(390px) para cuando se aborde una version movil dedicada; por ahora el
enfoque prioritario es notebook/desktop/QHD, uso tipico de un servicio de
radioterapia.

---

## 10. Accesibilidad

- Modo claro y oscuro totalmente soportados mediante la clase `.dark` (ya usado en toda la plataforma).
- Contraste verificado entre texto y fondo en ambos modos usando los tokens `foreground`/`background` y `-subtle` para fondos de estado.
- Todos los elementos interactivos (`Button`, `Input`, `Select`, filas de `SmartTable`, pestanas de `Tabs`) son elementos nativos de HTML (`button`, `input`, `select`) para heredar navegacion por teclado y compatibilidad con lectores de pantalla sin trabajo adicional.
- `Modal` se cierra con la tecla Escape y bloquea el scroll de fondo mediante el overlay.
- Los estados de foco usan `focus-visible:ring-2` en vez de eliminar el outline, para no penalizar la navegacion por teclado.

---

## 11. Microinteracciones

- Transiciones de color de 150ms en botones, pestanas y filas de tabla (`transition-colors duration-150`) — perceptibles pero sin retrasar la operacion.
- Estado de carga en `Button` (`loading`) muestra un spinner inline en vez de deshabilitar sin explicacion.
- `Spinner` reutilizable para cargas de secciones completas (dashboards, tablas remotas).
- Sin animaciones decorativas de entrada/salida: se prioriza la velocidad de uso clinico sobre el efecto visual.

---

## 12. Reglas de uso y buenas practicas

1. Nunca definir un color hexadecimal nuevo dentro de un modulo: usar los tokens de `globals.css` / `tailwind.config.js` o `CHART_PALETTE` para graficos.
2. Nunca duplicar un componente de `components/ui`: si falta una variante, se extiende el componente base, no se crea uno nuevo en el modulo.
3. Todo estado (equipo, documento, incidente, auditoria, capacitacion) debe pasar por `semaphoreFromStatus` o `semaphoreFromDaysRemaining` antes de pintarse.
4. Toda tabla de datos tabulares usa `SmartTable`; toda tarjeta de indicador usa `KpiCard`.
5. Todo icono se referencia desde `@/lib/icons`, nunca desde `lucide-react` directamente en un componente de modulo.
6. Los formularios nuevos usan `FormField`/`Input`/`Select`/`Textarea`.
7. Este documento se actualiza cada vez que se agrega un componente nuevo a `components/ui`.

---

## 13. Ejemplo minimo de uso combinado

```tsx
import { Card, CardHeader, CardTitle, CardContent, KpiCard, StatusBadge, SmartTable } from "@/components/ui";
import { ICONS } from "@/lib/icons";

<KpiCard label="Equipos activos" value={12} icon={<ICONS.equipo className="h-5 w-5" />} level="ok" />
<StatusBadge status="Operativo" />
```

---

## 14. Validacion final (checklist Fase 3.5)

- [x] Todos los componentes base son reutilizables y viven en `components/ui`.
- [x] No existen estilos duplicados: los colores y la tipografia se centralizan en `globals.css` y `lib/design-system.ts`.
- [x] Toda la plataforma comparte la misma identidad visual (tema oscuro por defecto, tokens HSL semanticos ya usados por todos los modulos previos).
- [x] Los formularios cuentan con un estandar unico disponible para adopcion.
- [x] Las tablas cuentan con un estandar unico (`SmartTable`) disponible para adopcion.
- [x] Los dashboards cuentan con una biblioteca de KPIs y graficos comun.
- [x] El sistema puede crecer (nuevos modulos QC, Aceptacion, Comisionamiento, etc.) sin modificar el Design System, solo consumiendolo.

Fase 3.5 completada. Los modulos nuevos y las revisiones de modulos
existentes (Radioterapia SIGR, Acelerador Lineal, Dosimetria, Transporte)
deben adoptar progresivamente estos componentes en sus proximas
iteraciones de Fase 3.
