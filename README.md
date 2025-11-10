# **🚀 Rastreador de Metas Diarias (Streaks Tracker)**

**Un sistema simple y robusto para seguir rachas de hábitos y metas, con persistencia de datos a través de Google Sheets como Backend.**

Este proyecto es una aplicación web de una sola página (GoalTracker\_Sheets.html) que utiliza JavaScript para gestionar un calendario de hábitos. Emplea la metodología **"Don't Break The Chain"** (No Rompas la Cadena) y almacena todos los datos de forma persistente y segura en una Google Sheet a través de una API personalizada (Web App de Google Apps Script).

## **✨ Características Principales**

* **Persistencia en Google Sheets:** Tus datos (fechas fallidas y fecha de inicio) se guardan directamente en una hoja de cálculo.  
* **Seguimiento de Rachas:** Muestra la racha actual de días exitosos.  
* **Gamificación (Puntuación):** Calcula una puntuación (simulada como "Dinero Acumulado") en función del tiempo y las rachas mantenidas.  
* **Interfaz Responsiva:** Visualización clara en formato de calendario para móvil y escritorio.  
* **Sincronización:** Botón explícito para guardar los cambios en tu Google Sheet.  
* **Importación/Exportación:** Permite exportar e importar datos localmente en formato JSON.

## **🛠️ Estructura del Proyecto**

El proyecto se compone de dos partes esenciales:

1. **GoalTracker\_Sheets.html:** La aplicación frontend. Contiene todo el HTML, CSS (con Tailwind CSS) y JavaScript necesario para la interfaz de usuario, la lógica del calendario y la comunicación con la API de Sheets.  
2. **Code.gs:** El backend o script de la API. Este código debe desplegarse como una **Web App de Google Apps Script** y se encarga de recibir las peticiones de la aplicación, leer/escribir datos en tu hoja de cálculo y devolver respuestas JSON.

## **⚙️ Configuración del Backend (Google Sheets y Apps Script)**

Para que la aplicación funcione, es crucial configurar y desplegar correctamente el backend en Google:

### **Paso 1: Crear la Hoja de Cálculo**

1. Crea una nueva Google Sheet (e.g., "Mi Rastreador de Metas DB").  
2. El script Apps Script creará automáticamente una hoja llamada User\_Data con las cabeceras userId, startDateString, y failedDatesArray al ejecutarse por primera vez. **No es necesario crear la hoja manualmente.**

### **Paso 2: Configurar y Desplegar el Apps Script**

1. Abre el editor de Google Apps Script desde tu hoja de cálculo: Haz clic en **"Extensiones"** \> **"Apps Script"**.  
2. **Copia el contenido completo del archivo Code.gs** y pégalo en el editor de Apps Script, reemplazando cualquier código existente.  
3. **Configuración y Despliegue de la Web App:**  
   * Haz clic en el botón **"Deploy" (Desplegar)** y selecciona **"New deployment" (Nuevo despliegue)**.  
   * En el campo **"Select type" (Seleccionar tipo)**, elige **"Web App"**.  
   * **Configuración CRÍTICA:**  
     * **Execute as (Ejecutar como):** Me (Tu cuenta de Google).  
     * **Who has access (Quién tiene acceso):** **Anyone (Cualquier usuario)**. *Esto es fundamental para evitar el error Failed to fetch y problemas de CORS.*  
   * Haz clic en **"Deploy" (Desplegar)**.  
   * Si es la primera vez, se te pedirá que autorices el script para acceder a tu hoja de cálculo.  
4. **Guarda la URL:** Una vez desplegada, **copia la "Web App URL"** proporcionada. Esta URL es la clave de tu API de backend.

## **🔑 Puesta en Marcha del Frontend**

Una vez que tengas la URL de la Web App:

1. Abre el archivo GoalTracker\_Sheets.html en tu navegador (o en el entorno donde se esté ejecutando).  
2. Al inicio, o haciendo clic en el icono de **"Configuración" (engranaje)**, aparecerá el menú. 
https://script.google.com/macros/s/AKfycbwR_Em8RzDR5dE3UJXtFeqAwXM-zxQEjYrbhG-5tsf0-kXKwEOBWCfUsyJN5TGSHDWucw/exec
3. Pega la **Web App URL** que obtuviste en el paso anterior.  
4. Haz clic en **"Guardar URL y Cargar Datos"**.

La aplicación intentará conectarse a Google Sheets. Si la configuración fue correcta, verás un mensaje de éxito y la aplicación estará lista para usarse y guardar datos.

## **💻 Desarrollo**

El frontend está construido usando HTML5, JavaScript y la librería Tailwind CSS para los estilos.

**Dependencias:**

* **Tailwind CSS:** Cargado vía CDN para estilos rápidos y responsivos.  
* **Google Apps Script:** Utilizado como una API de datos sin servidor.

### **Licencia**

Este proyecto está bajo la Licencia MIT.
