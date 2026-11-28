# Dashboard Multi-Panel Dosimetría POE — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el dashboard simple de dosimetría con un panel multi-vista profesional (Institución / Departamentos / Trabajador) con gráficos CSS-only, KPIs de alerta, y correcciones de bugs existentes.

**Architecture:** El tab "Dashboard" existente en `page.tsx` gana un estado `dashTab` que controla 3 sub-vistas renderizadas condicionalmente. Todos los gráficos se hacen con barras CSS (inline `style={{ width }}`) y clases Tailwind estáticas — sin dependencias externas. Las clases dinámicas de los KPI cards del Resumen se migran a un mapa estático de colores.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS (JIT — sin clases dinámicas), @vercel/postgres

**Spec:** `docs/superpowers/specs/2026-11-26-dosimetria-dashboard-design.md` (ver notas de brainstorming — Opción B aprobada)

## Global Constraints

- No instalar librerías de gráficos externas — solo CSS bars con `style={{ width: X% }}`
- Clases Tailwind deben ser estáticas (nunca `border-${color}-100` interpolado) para evitar purge en JIT
- Archivo a modificar: `frontend/web/src/app/dosimetria/page.tsx` (1407 líneas, seguir sus patrones)
- API endpoint existente: `/api/dosimetria?view=dashboard` — extender con `&period=anual|trimestral`
- Límite anual DS 3/1985: 20 mSv; umbrales: >15 rojo, >10 naranja, >5 amarillo, ≤5 verde
- El h1 de la página sigue diciendo "CCHEN" — corregirlo en esta misma entrega

## Review Focus

1. **Tailwind JIT purge**: Cualquier clase dinámica (`text-${x}-600`) no renderiza en prod — verificar que todos los colores usen mapas estáticos antes de cada commit.
2. **Datos vacíos en sub-vistas**: Si `dashData` es null o arrays vacíos, las vistas deben mostrar un empty-state, no crashear con `.map` sobre undefined.
3. **RUT sin resultados**: La sub-vista Trabajador con un RUT que no existe debe mostrar mensaje claro, no silencio ni error 500.
4. **Normalización del gráfico de tendencia**: El cálculo actual `(v/2)*100` no normaliza correctamente cuando el max > 20 — usar `Math.min((v / maxVal) * 100, 100)` con `maxVal = Math.max(...valores, 20)`.
5. **Estado `dashTab` al cambiar de tab principal**: Al salir del tab Dashboard y volver, `dashTab` debe permanecer en su sub-vista (estado React persiste — solo verificar que el fetch se rehaga si `dashData` es null).

---

### Task 1: Corregir bugs existentes (h1 CCHEN + Tailwind dinámico en KPI cards)

**Files:**
- Modify: `frontend/web/src/app/dosimetria/page.tsx` (líneas ~40 h1, ~800-860 KPI cards)

**Interfaces:**
- Consumes: nada de otras tareas
- Produces: `KPI_COLOR_MAP` — objeto estático `Record<string, { border: string; text: string; bg: string }>` usado en Task 3

- [ ] **Step 1: Localizar y corregir el h1**

Buscar `"☢️ Dosimetría POE — CCHEN"` en page.tsx y cambiar a `"☢️ Dosimetría POE"`.

- [ ] **Step 2: Localizar el bloque de KPI cards del Resumen**

Buscar el array de KPIs con `border-${k.color}-100` y `text-${k.color}-600`. Reemplazar con un mapa estático:

```typescript
const KPI_COLOR_MAP: Record<string, { border: string; text: string; bg: string }> = {
  blue:   { border: "border-blue-100",   text: "text-blue-600",   bg: "bg-blue-50" },
  indigo: { border: "border-indigo-100", text: "text-indigo-600", bg: "bg-indigo-50" },
  orange: { border: "border-orange-100", text: "text-orange-600", bg: "bg-orange-50" },
  red:    { border: "border-red-100",    text: "text-red-600",    bg: "bg-red-50" },
  rose:   { border: "border-rose-100",   text: "text-rose-600",   bg: "bg-rose-50" },
};
```

Luego en el JSX de cada card: `KPI_COLOR_MAP[k.color].border`, `KPI_COLOR_MAP[k.color].text`.

- [ ] **Step 3: Verificar visualmente que los 5 KPI cards del Resumen renderizan con color**

Correr `npm run dev` en `frontend/web/` y navegar a Dosimetría → Resumen. Confirmar que los 5 cards muestran borde e ícono con color (no gris).

- [ ] **Step 4: Commit**

```bash
cd /home/claude/rpms-platform/frontend/web
git add src/app/dosimetria/page.tsx
git commit -m "fix: corregir h1 CCHEN y clases Tailwind dinámicas en KPI cards del Resumen

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RUe6sDAAiBnGZdrmKpBrsf"
```

---

### Task 2: Agregar estado `dashTab` y navegación de sub-vistas

**Files:**
- Modify: `frontend/web/src/app/dosimetria/page.tsx` (sección de estado, ~líneas 50-120)

**Interfaces:**
- Consumes: nada
- Produces: `dashTab: "institucion" | "departamentos" | "trabajador"` — estado React usado en Tasks 3, 4, 5

- [ ] **Step 1: Agregar el estado dashTab junto a los otros estados del componente**

Agregar después del bloque de `useState` existente:

```typescript
const [dashTab, setDashTab] = useState<"institucion" | "departamentos" | "trabajador">("institucion");
```

- [ ] **Step 2: Agregar el renderizado de la barra de navegación de sub-vistas**

Dentro del bloque `{activeTab === "dashboard" && (` y antes del contenido actual del dashboard, insertar:

```tsx
{/* Sub-nav del dashboard */}
<div className="flex gap-2 mb-6 border-b pb-2">
  {(["institucion","departamentos","trabajador"] as const).map(t => (
    <button
      key={t}
      onClick={() => setDashTab(t)}
      className={`px-4 py-2 rounded-t text-sm font-medium transition-colors ${
        dashTab === t
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      { t === "institucion" ? "🏥 Institución"
      : t === "departamentos" ? "🏢 Departamentos"
      : "👤 Trabajador" }
    </button>
  ))}
</div>
```

- [ ] **Step 3: Verificar que la barra de 3 botones aparece en el tab Dashboard sin romper lo existente**

Nav a Dosimetría → Dashboard. Deben verse 3 botones. El contenido actual del dashboard sigue visible debajo.

- [ ] **Step 4: Commit**

```bash
git add src/app/dosimetria/page.tsx
git commit -m "feat: agregar estado dashTab y nav de sub-vistas en Dashboard

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RUe6sDAAiBnGZdrmKpBrsf"
```

---

### Task 3: Sub-vista Institución — KPIs globales + tendencia anual normalizada

**Files:**
- Modify: `frontend/web/src/app/dosimetria/page.tsx` (reemplazar bloque actual del dashboard JSX)

**Interfaces:**
- Consumes: `dashTab` (Task 2), `dashData` (ya existe: `{ por_departamento: DashDepto[]; tendencia_anual: DashAnio[] }`)
- Produces: JSX renderizado cuando `dashTab === "institucion"`

Los datos existentes de `tendencia_anual` son suficientes para esta sub-vista. No requiere cambio en API.

- [ ] **Step 1: Envolver el contenido actual del dashboard en `{dashTab === "institucion" && ...}`**

El bloque actual (gráfico barras horizontales + gráfico tendencia + KPI global + footnote) se mueve adentro de este condicional.

- [ ] **Step 2: Agregar 4 KPI cards de alerta al inicio de la sub-vista Institución**

Calcular desde `dashData.por_departamento`:

```typescript
const totalTrabajadores = dashData.por_departamento.reduce((s, d) => s + Number(d.n), 0);
const sobreAlerta = dashData.por_departamento.reduce((s, d) => s + Number(d.sobre_alerta), 0);
const pctAlerta = totalTrabajadores > 0 ? Math.round((sobreAlerta / totalTrabajadores) * 100) : 0;
const maxHp10 = Math.max(...dashData.por_departamento.map(d => Number(d.max_hp10)));
const avgGlobal = dashData.tendencia_anual.length > 0
  ? Number(dashData.tendencia_anual[dashData.tendencia_anual.length - 1].avg_hp10)
  : 0;
```

Cards (4 en grid `grid-cols-2 md:grid-cols-4`):
- "Trabajadores monitorizados" — `totalTrabajadores` — icon 👷
- "En alerta (>10 mSv)" — `sobreAlerta` (`pctAlerta`%) — rojo si >0
- "Dosis máx. registrada" — `maxHp10.toFixed(2)` mSv — color según ALERTA_COLOR
- "Promedio año actual" — `avgGlobal.toFixed(2)` mSv — color según ALERTA_COLOR

- [ ] **Step 3: Corregir la normalización del gráfico de tendencia anual**

El cálculo actual usa `(v/2)*100` como altura en px — reemplazar con:

```typescript
const tMax = Math.max(...dashData.tendencia_anual.map(d => Number(d.avg_hp10)), 20);
// En cada barra: style={{ height: `${Math.min((Number(d.avg_hp10) / tMax) * 160, 160)}px` }}
```

- [ ] **Step 4: Verificar sub-vista Institución renderiza KPIs + tendencia sin errores de consola**

- [ ] **Step 5: Commit**

```bash
git add src/app/dosimetria/page.tsx
git commit -m "feat: sub-vista Institución con KPIs de alerta y tendencia normalizada

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RUe6sDAAiBnGZdrmKpBrsf"
```

---

### Task 4: Sub-vista Departamentos — barras para Hp(10), Hp(3) y Hp(0.07)

**Files:**
- Modify: `frontend/web/src/app/dosimetria/page.tsx`

**Interfaces:**
- Consumes: `dashTab` (Task 2), `dashData.por_departamento` que ya incluye `avg_hp3` y `avg_hp007`
- Produces: JSX renderizado cuando `dashTab === "departamentos"`

`avg_hp3` y `avg_hp007` ya vienen en `DashDepto` pero no se muestran actualmente.

- [ ] **Step 1: Agregar estado de magnitud seleccionada**

```typescript
const [deptMag, setDeptMag] = useState<"hp10"|"hp3"|"hp007">("hp10");
```

- [ ] **Step 2: Implementar el JSX de la sub-vista Departamentos**

Estructura:
```tsx
{dashTab === "departamentos" && dashData && (
  <div>
    {/* Selector de magnitud */}
    <div className="flex gap-2 mb-4">
      {(["hp10","hp3","hp007"] as const).map(m => (
        <button key={m} onClick={() => setDeptMag(m)}
          className={deptMag === m ? "bg-primary text-primary-foreground px-3 py-1 rounded text-sm" : "px-3 py-1 rounded text-sm bg-muted"}>
          { m === "hp10" ? "Hp(10) cuerpo" : m === "hp3" ? "Hp(3) cristalino" : "Hp(0.07) piel" }
        </button>
      ))}
    </div>
    {/* Barras horizontales ordenadas por valor desc */}
    { [...dashData.por_departamento]
        .sort((a,b) => Number(b[`avg_${deptMag}` as keyof DashDepto]) - Number(a[`avg_${deptMag}` as keyof DashDepto]))
        .map(d => {
          const val = Number(d[`avg_${deptMag}` as keyof DashDepto]);
          const pct = Math.min((val / 20) * 100, 100);
          // usar MiniBar existente
        })
    }
  </div>
)}
```

Nota: `avg_hp3` y `avg_hp007` están en `DashDepto`; `avg_hp10` también. Para acceso tipado usar:
```typescript
const MAG_KEY: Record<"hp10"|"hp3"|"hp007", keyof DashDepto> = {
  hp10: "avg_hp10", hp3: "avg_hp3", hp007: "avg_hp007"
};
```

- [ ] **Step 3: Mostrar también `n` (n° trabajadores) y `sobre_alerta` por departamento como texto secundario**

Debajo de cada barra: `{d.departamento} · {d.n} trabajadores · {d.sobre_alerta} en alerta`

- [ ] **Step 4: Verificar que cambiar entre Hp(10)/Hp(3)/Hp(0.07) reordena las barras correctamente**

- [ ] **Step 5: Commit**

```bash
git add src/app/dosimetria/page.tsx
git commit -m "feat: sub-vista Departamentos con selector de magnitud Hp(10)/Hp(3)/Hp(0.07)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RUe6sDAAiBnGZdrmKpBrsf"
```

---

### Task 5: Sub-vista Trabajador — búsqueda por RUT e historial individual

**Files:**
- Modify: `frontend/web/src/app/dosimetria/page.tsx`

**Interfaces:**
- Consumes: `dashTab` (Task 2), fetch a `/api/dosimetria?view=dashboard&rut=X` (ya implementado en la API)
- Produces: JSX renderizado cuando `dashTab === "trabajador"`

El filtro por RUT ya existe en el fetch del dashboard (el input `fRut` y la query `&rut=`). La sub-vista Trabajador usa ese mismo mecanismo.

- [ ] **Step 1: Reutilizar `fRut` y el input de RUT existente dentro de la sub-vista Trabajador**

El input de RUT que actualmente aparece en el dashboard general se mueve adentro del bloque `{dashTab === "trabajador" && ...}`.

- [ ] **Step 2: Implementar el JSX de la sub-vista Trabajador**

```tsx
{dashTab === "trabajador" && (
  <div>
    {/* Buscador de RUT */}
    <div className="flex gap-2 mb-6">
      <input
        type="text" value={fRut} onChange={e => setFRut(e.target.value)}
        placeholder="RUT trabajador (ej: 12345678-9)"
        className="border rounded px-3 py-2 text-sm flex-1"
      />
      <button onClick={() => loadTab("dashboard")}
        className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm">
        Buscar
      </button>
    </div>
    
    {/* Estado vacío */}
    {(!dashData || dashData.por_departamento.length === 0) && fRut === "" && (
      <p className="text-muted-foreground text-sm">Ingresa un RUT para ver el historial individual.</p>
    )}
    
    {/* Sin resultados */}
    {fRut !== "" && dashData && dashData.por_departamento.length === 0 && (
      <p className="text-orange-600 text-sm">No se encontraron registros para el RUT ingresado.</p>
    )}
    
    {/* Semáforo de riesgo + historial */}
    {dashData && dashData.tendencia_anual.length > 0 && (
      /* Ver Step 3 */
    )}
  </div>
)}
```

- [ ] **Step 3: Implementar el semáforo de riesgo del trabajador**

Calcular desde `tendencia_anual` (que para un RUT específico representa su historial):

```typescript
const latestDosis = dashData.tendencia_anual.length > 0
  ? Number(dashData.tendencia_anual[dashData.tendencia_anual.length - 1].avg_hp10)
  : 0;
const riesgoColor = latestDosis > 15 ? "bg-red-500"
  : latestDosis > 10 ? "bg-orange-400"
  : latestDosis > 5  ? "bg-yellow-400"
  : "bg-green-500";
const riesgoLabel = latestDosis > 15 ? "RIESGO ALTO"
  : latestDosis > 10 ? "RIESGO MEDIO"
  : latestDosis > 5  ? "ATENCIÓN"
  : "NORMAL";
```

Mostrar: círculo grande con color + label + dosis + porcentaje del límite anual (20 mSv).

- [ ] **Step 4: Mostrar historial anual del trabajador como tabla**

Columnas: Año | Dosis Hp(10) mSv | % Límite anual | Estado

- [ ] **Step 5: Verificar búsqueda con RUT válido muestra semáforo; RUT inexistente muestra mensaje**

- [ ] **Step 6: Commit**

```bash
git add src/app/dosimetria/page.tsx
git commit -m "feat: sub-vista Trabajador con semáforo de riesgo e historial individual

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RUe6sDAAiBnGZdrmKpBrsf"
```

---

### Task 6: Push y verificación en Vercel

**Files:**
- ninguno

**Interfaces:**
- Consumes: todos los commits de Tasks 1-5

- [ ] **Step 1: Verificar que no hay clases Tailwind dinámicas restantes**

```bash
grep -n 'border-${' src/app/dosimetria/page.tsx
grep -n 'text-${' src/app/dosimetria/page.tsx
grep -n 'bg-${' src/app/dosimetria/page.tsx
```

Expected: 0 resultados.

- [ ] **Step 2: Verificar que el h1 no dice CCHEN**

```bash
grep 'CCHEN' src/app/dosimetria/page.tsx
```

Expected: 0 resultados.

- [ ] **Step 3: Push a rama principal**

```bash
git push
```

- [ ] **Step 4: Esperar despliegue Vercel y verificar las 3 sub-vistas en producción**

Navegar a la URL de Vercel → Dosimetría → Dashboard → verificar Institución, Departamentos, Trabajador.
