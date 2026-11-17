# MiniTask — Gestor de Tareas Cloud

**MiniTask** es una aplicación web moderna, funcional y responsive diseñada para demostrar la integración armónica entre tres de las plataformas más potentes del desarrollo web moderno:

- **GitHub:** Repositorio de código y control de versiones con integración CI/CD continua.
- **Supabase:** Base de datos PostgreSQL con autenticación anónima y políticas de seguridad estrictas a nivel de fila (Row Level Security - RLS).
- **Vercel:** Despliegue continuo en la red global Edge Network, actualizándose automáticamente en cada push a la rama principal (`main`).
- **Model Context Protocol (MCP):** Gestión programática y orquestación asistida de repositorios, base de datos y despliegue a través de servidores MCP estandarizados.

---

## 🚀 Arquitectura y Tecnologías

- **Frontend:** HTML5 semántico, CSS3 moderno (diseño responsivo, temas oscuros elegantes, micro-animaciones, componentes accesibles), JavaScript ES Modules.
- **Tooling:** [Vite](https://vitejs.dev/) para desarrollo y compilación ultrarrápida.
- **Backend / Database:** [Supabase](https://supabase.com/) (`@supabase/supabase-js`, PostgreSQL, RLS, Auth Anónimo).
- **Hosting:** [Vercel](https://vercel.com/) Edge Platform.

---

## 🛠️ Funcionalidades

1. **Crear tareas:** Validación en tiempo real y persistencia en Supabase.
2. **Listado completo:** Carga ordenada cronológicamente de las tareas del usuario.
3. **Marcar como completada / pendiente:** Sincronización optimista y persistencia en base de datos.
4. **Eliminar tareas con confirmación:** Diálogo modal accesible para prevenir eliminaciones accidentales.
5. **Filtrado dinámico:** Filtro instantáneo por *Todas*, *Pendientes* y *Completadas*.
6. **Contador de pendientes:** Indicador reactivo del número de tareas por resolver.
7. **Autenticación Anónima transparente:** Sin formularios molestos; cada visitante recibe un `user_id` único mediante `supabase.auth.signInAnonymously()`.
8. **Seguridad RLS (Row Level Security):** Cada usuario solo puede ver, insertar, modificar y eliminar sus propias tareas en PostgreSQL.
9. **Simulador de cambio de usuario:** Botón para generar una nueva sesión anónima y verificar en vivo el aislamiento de datos entre usuarios.

---

## 📋 Estructura de la Base de Datos (`supabase/schema.sql`)

```sql
create table if not exists public.tasks (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    title text not null check (char_length(trim(title)) > 0),
    completed boolean not null default false,
    created_at timestamptz not null default now()
);

alter table public.tasks enable row level security;
```

Las políticas RLS garantizan que:
- `SELECT`: Solo filas donde `(select auth.uid()) = user_id`.
- `INSERT`: Solo filas donde `(select auth.uid()) = user_id`.
- `UPDATE`: Tanto en `USING` como en `WITH CHECK` se valida `(select auth.uid()) = user_id`.
- `DELETE`: Solo filas donde `(select auth.uid()) = user_id`.

---

## 📦 Instalación y Ejecución Local

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/aquinobritezzkoika-max/minitask-demo.git
   cd minitask-demo
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno:**
   Copia el archivo `.env.example` como `.env`:
   ```bash
   cp .env.example .env
   ```
   Define los valores de tu proyecto en Supabase:
   ```env
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-clave-anonima-publica
   ```

4. **Ejecutar en desarrollo:**
   ```bash
   npm run dev
   ```

5. **Compilar para producción:**
   ```bash
   npm run build
   ```

---

## 🌐 Despliegue en Vercel

La aplicación está preparada para Vercel sin configuración adicional:
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Environment Variables:**
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

Cada vez que se sube un cambio a GitHub (`git push origin main`), Vercel compila y despliega automáticamente la nueva versión.
