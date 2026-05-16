# Instrucciones para creación de sitio web

Actúa como un Desarrollador Full-Stack Senior experto en React, Tailwind CSS y la librería `@supabase/supabase-js`.

Necesito crear una aplicación web SPA (Single Page Application) que sea 100% responsiva (optimizada para PC y dispositivos móviles) para el pase de lista de un evento, conectada a las tablas que acabamos de crear en Supabase.

Por favor, genera el código estructurado con los siguientes requerimientos:

1. AUTENTICACIÓN Y ROLES:

- Una pantalla de Login que valide los usuarios contra la autenticación de Supabase.
- Al iniciar sesión, la app debe identificar el rol del usuario ('super_admin' o 'staff').
- El 'super_admin' debe tener acceso a 3 pestañas: "Registro de Asistencia", "Registro de Usuarios" y "Estadísticas".
- El usuario 'staff' solo debe ver y tener acceso a las pestañas: "Registro de Asistencia" y "Estadísticas".

2. PESTAÑA: REGISTRO DE ASISTENCIA:

- Debe mostrar un buscador global rápido por texto y selectores para filtrar por "Dependencia" y "Salón". El filtrado debe ejecutarse sobre toda la base de datos, no solo sobre los visibles.
- Una lista o tabla inferior con paginación que muestre un máximo de 50 registros por página.
- Al hacer clic en la fila de un asistente, se debe abrir un Modal con todos sus datos detallados: Nombre de la Dependencia, Nombre(s), Apellido Paterno, Apellido Materno, Cargo, Puesto y Salón.
- Si el asistente NO ha ingresado (asistio = false), mostrar un botón grande en ROJO que diga "Marcar su asistencia". Al hacer clic, debe actualizar el campo en Supabase, registrar el ID del usuario actual en 'registrado_por' y actualizar la vista de forma inmediata.
- Si el asistente YA ingresó (asistio = true), el botón dentro del modal debe cambiar a color VERDE, estar deshabilitado y mostrar el texto "En el evento".

3. PESTAÑA: REGISTRO DE USUARIOS (Solo Super Admin):

- Un formulario limpio para registrar nuevos usuarios de apoyo (staff), guardando sus credenciales de manera correcta en el sistema de usuarios.

4. PESTAÑA: ESTADÍSTICAS:

- Tarjetas informativas con los totales: Total de invitados en la lista, Total de personas que asistieron, Total de ausentes.
- Gráficos sencillos o desgloses visuales que muestren las asistencias por Dependencia y por Salón.
- Un botón para "Descargar Reporte en PDF" que utilice la librería jsPDF (o similar) para generar un documento limpio con estos datos estadísticos.

Por favor, proporciona el código limpio utilizando componentes funcionales de React, Hooks para el manejo de estados (useState, useEffect) y clases de Tailwind CSS para asegurar un diseño moderno y Mobile-First.
