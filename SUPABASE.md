# Configurar Supabase al clonar el proyecto

Esta guía sirve para conectar una copia del sitio a un proyecto Supabase nuevo, creado por otra persona. Supabase guarda los datos, las cuentas y las imágenes; el sitio (archivos HTML, CSS y JavaScript) se publica por separado en un hosting web.

## 1. Crear el proyecto y conectar el sitio

1. La otra persona debe crear un proyecto en su propia cuenta de Supabase y esperar a que termine el aprovisionamiento.
2. En **Project Settings → API** (o **API Keys**, según la versión del panel), copiar:
   - La **Project URL**.
   - Una clave pública **Publishable** (`sb_publishable_...`) o la clave pública heredada **anon**.
3. En el clon, editar `supabase-config.js` y reemplazar los valores del proyecto anterior:

   ```js
   window.ondaSupabaseConfig = {
     url: "https://<project-ref>.supabase.co",
     anonKey: "<publishable-key-o-anon-key>",
   };
   ```

   `supabase-config.js` forma parte del sitio y está versionado en este proyecto. Un clon seguirá apuntando al proyecto anterior hasta que se cambien estos dos valores. La clave pública se usa en el navegador; **no** poner aquí ni publicar la clave `service_role` o una clave `secret`.

## 2. Crear tablas, permisos, función y almacenamiento

1. Abrir **SQL Editor → New query** en el proyecto nuevo.
2. Abrir el archivo `supabase-setup.sql` del clon, copiar **todo su contenido** y ejecutarlo.
3. Confirmar que la consulta termine sin errores.

El script prepara los objetos que necesita el sitio:

- Tabla `public.stations`, con nombre, género, ciudad, URL del audio, portada, propietario y fecha de creación.
- Tabla `public.radio_admins`, que identifica a las cuentas administradoras.
- Funciones `is_radio_admin()` y `create_radio_station(...)`.
- Políticas de seguridad RLS para que cualquiera pueda leer las emisoras, los usuarios puedan administrar las propias y los administradores puedan gestionar todas.
- Límite de cinco emisoras por usuario normal, aplicado también en la base de datos.
- Bucket público `radio-images` y sus políticas de lectura, carga y borrado. El bucket acepta imágenes WebP de hasta 10 MB; el sitio optimiza las portadas antes de cargarlas.

No hay que crear el bucket ni las tablas manualmente. El SQL se puede volver a ejecutar para aplicar esta versión del esquema; al hacerlo, no copia ni borra las emisoras existentes. Si se ejecuta en una base que ya tenía emisoras, las columnas antiguas de ciudad pueden quedar vacías; las nuevas publicaciones sí requieren una ciudad.

## 3. Crear y autorizar la cuenta administradora

1. En **Authentication → Users**, crear o invitar el correo que será administrador. También se puede crear una cuenta desde el sitio si el registro por correo está habilitado.
2. En SQL Editor, sustituir el correo de ejemplo y ejecutar:

   ```sql
   insert into public.radio_admins (user_id)
   select id
   from auth.users
   where lower(email) = lower('admin@ejemplo.com')
   on conflict (user_id) do nothing;
   ```

3. Iniciar sesión en el panel del sitio. Si la cuenta ya estaba iniciada, pulsar **Volver a comprobar**.

Iniciar sesión por sí solo no da permisos de administrador. Solo las cuentas incluidas en `radio_admins` pueden ver y administrar todas las emisoras. Los demás usuarios pueden publicar y borrar sus propias emisoras, hasta cinco.

Para comprobar la autorización:

```sql
select u.email, r.user_id is not null as es_admin
from auth.users u
left join public.radio_admins r on r.user_id = u.id
where lower(u.email) = lower('admin@ejemplo.com');
```

El resultado de `es_admin` debe ser `true`.

## 4. Configurar acceso por correo y enlaces de retorno

En **Authentication → Sign In / Providers → Email**:

- Habilitar Email.
- Permitir el registro si se desea que las personas creen sus propias cuentas.
- Decidir si se exige confirmación del correo. Si se exige, cada usuario debe confirmarlo antes de iniciar sesión.

En **Authentication → URL Configuration**:

- Configurar **Site URL** con la URL pública final del sitio.
- Agregar a **Redirect URLs** cada URL exacta desde la que se usarán los enlaces de autenticación y recuperación.

Ejemplos que se deben adaptar a las direcciones reales:

```text
https://emisorasvirtuales.com/
http://127.0.0.1:5500/
http://127.0.0.1:5500/index.html
```

La aplicación devuelve los enlaces de recuperación a la página que se está usando. Si se accede por una URL distinta, esa dirección también debe estar permitida.

## 5. Correo de confirmación y recuperación de contraseña

Para que Supabase pueda enviar enlaces, configurar un proveedor de correo en **Authentication → SMTP Settings** (o el servicio de correo habilitado en el proyecto). Sin un servicio de correo operativo, los mensajes podrían no llegar o quedar sujetos a límites del proveedor.

La plantilla personalizada de recuperación es opcional:

1. Abrir **Authentication → Email Templates → Reset Password**.
2. Usar como asunto `Restablece tu contraseña de Emisoras Virtuales`.
3. Copiar el HTML de `reset-password-email.html` al editor de la plantilla y guardar.
4. Conservar `{{ .ConfirmationURL }}` en los enlaces de la plantilla; Supabase lo usa para validar el token.
5. Si el sitio usa otro dominio o marca, actualizar el pie de la plantilla y las URL de autenticación para que coincidan. El nombre del remitente se configura en SMTP, no en el HTML.

Los enlaces vencidos o ya utilizados no se pueden reutilizar; se debe solicitar uno nuevo.

## 6. Datos e imágenes al cambiar de proyecto

El SQL crea el esquema y los permisos, pero **no migra** desde el proyecto anterior:

- Emisoras publicadas.
- Cuentas, contraseñas ni autorizaciones de usuarios.
- Imágenes que ya estuvieran guardadas en el bucket.

El proyecto nuevo empieza vacío. Si también se quieren conservar esos datos, hay que exportar e importar las filas e imágenes por separado, y recrear las cuentas/autorizaciones de acuerdo con el proceso seguro de Supabase. No compartir contraseñas ni claves `service_role`.

No se deben subir los archivos HTML/CSS/JavaScript a Supabase: se publican en el hosting del sitio. En Supabase solo se configura el backend, se ejecuta `supabase-setup.sql` y, opcionalmente, se personalizan las plantillas y el correo.

## 7. Comprobación final

1. Revisar que `supabase-config.js` tenga la URL y la clave pública del proyecto nuevo.
2. Confirmar que `supabase-setup.sql` se ejecutó sin errores.
3. Iniciar sesión con la cuenta autorizada como administradora.
4. Publicar una emisora de prueba con nombre, género, ciudad, URL de audio e imagen de portada.
5. Confirmar que aparece en la galería pública y que el audio y la portada funcionan.

Si aparece un error indicando que falta la columna `city`, ejecutar de nuevo el `supabase-setup.sql` completo en el proyecto configurado en `supabase-config.js`. Si el panel no reconoce al administrador, comprobar que el correo exista en **Authentication → Users**, que la fila correspondiente esté en `radio_admins` y que ambos pasos se hayan hecho en el mismo proyecto.
