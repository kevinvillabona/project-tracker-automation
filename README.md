# 🚀 Automated Project Tracker & Dashboard (JS Port)

## Sobre este Repositorio

Este proyecto es una **recreación Frontend (Vanilla JS)** de un sistema originalmente desarrollado en **ASP.NET Core (C#)**.

* **Lógica Migrada:** La lógica de negocio (procesamiento de horas, cálculo de avances, parseo de CSVs) que residía en el Controlador de C# fue portada a JavaScript puro para permitir la visualización estática en GitHub sin necesidad de un backend .NET activo.
* **Datos Mock:** Los datos mostrados provienen de Google Sheets públicos con información ficticia/anonimizada para fines demostrativos. No se exponen datos reales de producción.

---

## Contexto

Identifiqué que el equipo perdía horas valiosas en reuniones de estado (dailies extensas de "salida") y reportes manuales constantes. Además los stakeholders (RRHH y PMs) carecían de visibilidad en tiempo real sobre el avance real de los módulos frente al roadmap planificado.

## El Problema

* **Fricción:** Los desarrolladores olvidaban completar reportes complejos en Jira.
* **Opacidad:** La información del Roadmap (Hoja de Ruta) vivía aislada del progreso diario (horas imputadas), o ni siquiera era tenído en cuenta.
* **Silos de Información:** El PM actualizaba un Excel, los devs otro sistema, y la gerencia no tenía un tablero unificado ni una buena presentación.

## La Solución

Diseñé una arquitectura híbrida que centraliza la ingesta de datos y automatiza la visualización.

### Arquitectura del Flujo

1. **Ingesta Ágil:** Los desarrolladores cargan sus avances vía **Google Forms**.
2. **Gestión:** El PM actualiza fechas y fases en **Google Sheets**.
3. **Procesamiento (Original vs Demo):**
* *Prod:* **C# (ASP.NET)** procesa los datos, cruza tablas y sirve la vista Razor.
* *Demo (Este Repo):* **JavaScript** hace fetch directo a los CSVs, realiza el ETL en el cliente y renderiza el DOM.


4. **Visualización:** Dashboard interactivo con cálculo automático de horas vs. porcentaje de avance.

## Tecnologías

### Stack de la Demo (Portabilidad)

* **Vanilla JavaScript:** Sin frameworks. Uso de `Async/Await`, Clases y Módulos para replicar la lógica de negocio de C#.
* **CSS Moderno:** Variables CSS, Grid Layout y Glassmorphism.
* **Fetch API:** Consumo de datos crudos (CSV) desde la nube.

### Stack Original (Producción)

* **Backend:** ASP.NET Core (C#).
* **Vista:** Razor Pages.

## Features Destacados (Lógica de Negocio)

Aun siendo una versión "estática", este dashboard incluye lógica compleja portada del backend:

* **Cálculo Inteligente de Avance:** Diferenciación visual entre horas imputadas y porcentaje completado.
* **Agrupación de "Bugfix":** Lógica específica para sumar horas de mantenimiento correctivo a sus módulos padres.
* **UX/UI:** Implementación de **Skeleton Loading** para mejorar la percepción de velocidad durante la carga de datos asincrónica.
* **Data Parsing:** Algoritmo propio para parsear CSVs complejos respetando comillas y saltos de línea (replicando la lógica de `SplitCsvLine` de C#).

## Resultados

* **Eliminación** de reportes manuales por parte del Lead.
* **Transparencia Total:** Los stakeholders pueden ver el estado del proyecto sin interrumpir al equipo de desarrollo.
* **Adopción:** La simplicidad de la interfaz (Forms) aseguró que el 100% del equipo imputara sus horas correctamente.
