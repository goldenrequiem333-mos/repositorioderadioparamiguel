# SEO y publicación en buscadores

La página está preparada para publicarse en `https://emisorasvirtuales.com/`. Incluye un título y una descripción centrados en Emisoras Virtuales y la radio online de Colombia y Latinoamérica, `WebSite` con el nombre alternativo `emisorasvirtuales.com`, etiquetas para compartir, datos estructurados de la organización, un favicon, `robots.txt` y un sitemap para la página principal.

## Antes de publicar

1. Publica el contenido de esta carpeta en el alojamiento del dominio, incluidos `robots.txt`, `sitemap.xml` y `favicon.svg`.
2. Activa HTTPS y configura el dominio preferido para que `https://www.emisorasvirtuales.com/` redirija permanentemente a `https://emisorasvirtuales.com/`. El canonical y el sitemap usan el dominio sin `www`.
3. Comprueba que estas direcciones sean accesibles públicamente y respondan sin iniciar sesión:
   - `https://emisorasvirtuales.com/`
   - `https://emisorasvirtuales.com/robots.txt`
   - `https://emisorasvirtuales.com/sitemap.xml`
4. En Google Search Console, crea una propiedad de dominio para `emisorasvirtuales.com` y verifica la propiedad con el registro DNS TXT que Google proporciona.
5. Después de publicar y verificar el dominio, envía `https://emisorasvirtuales.com/sitemap.xml` desde el informe **Sitemaps** de Search Console. Usa **Inspección de URLs** para solicitar la indexación de la página principal.

La verificación de Search Console requiere acceso a la cuenta del registrador o proveedor DNS del dominio; no se puede completar desde los archivos de la web. Solicitar indexación tampoco garantiza que Google muestre la página con un nombre determinado, la incluya ni fija un plazo: Google debe rastrear y evaluar el sitio después de publicarlo.

Por ahora el sitio tiene una página pública en el sitemap. Las emisoras se cargan dinámicamente desde Supabase y no tienen una URL pública individual; para que Google encuentre cada emisora como una página independiente hará falta crear rutas públicas por emisora y hacer que su contenido esté disponible en el HTML rastreable.
