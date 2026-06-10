# 🌽 San Choclito - Sistema de Gestión de Restaurante

## 📖 Descripción del Sistema
El **Panel de Control San Choclito** es una aplicación web Frontend diseñada para optimizar y gestionar las operaciones diarias de un restaurante. El sistema permite la administración integral del menú, el registro de pedidos por mesa, la visualización de órdenes en cocina y la facturación. 

Todo el sistema está diseñado bajo una interfaz de usuario uniforme, responsiva e intuitiva, asegurando una experiencia fluida.

## 📸 Fotografía del Equipo

<div align="center">
  <img src="equipo.jpeg" alt="Fotografía del Equipo San Choclito" width="600" style="border-radius: 10px;">
  <br>
  
</div>

---

## 👨‍💻 Integrantes

| Nombre                               | Módulo Principal                   |
| :----------------------------------- | :--------------------------------- |
| **Rodrigo Sebastian Asmat Mendoza**       | Módulo de Platos |
| **Junior Moises Aliaga Cueva**  | Módulo de Pedidos                    |
| **Blanca Melisa Bustos Montañez**    | Módulo de Cocina                   |
| **Maria Rebeca de la Cruz Antezana** | Módulo de Facturación              |


---
## 🧩 Módulos Desarrollados

El proyecto se divide en 4 módulos principales que se comunican entre sí mediante el almacenamiento local (`localStorage`):

1. **Gestión de Platos:** Registro, edición y eliminación de ítems del menú. Permite establecer categorías, precios, tiempo estimado de preparación, control de alérgenos y estado (Activo/Inactivo).
2. **Registro de Pedidos:** Interfaz para que los mozos asignen pedidos a mesas específicas. Cuenta con un carrito dinámico, cálculo automático del total, justificación obligatoria para pedidos urgentes y selección de niveles de prioridad.
3. **Panel de Cocina:** Visualización en tiempo real de los pedidos enviados por los mozos. Permite a los cocineros cambiar el flujo de los platos (En preparación, Listo para servir).
4. **Facturación y Cierre:** Módulo para el cobro final de las mesas, generación de comprobantes y resumen estadístico de las ventas del día.

---

## 🛠️ División de Responsabilidades

Para asegurar una entrega eficiente y ordenada con control de versiones, el equipo distribuyó el trabajo de la siguiente manera:

* **Rodrigo Sebastian Asmat Mendoza:** Estructuración y lógica del **Módulo de Platos**. Creación del CRUD base para alimentar la carta del restaurante y enviar datos al módulo de pedidos.
* **Junior Moises Aliaga Cueva:** Desarrollo lógico y visual del **Módulo de Pedidos**. Encargado de la lógica matemática del carrito y validación de prioridades. 
* **Blanca Melisa Bustos Montañez:** Desarrollo interactivo del **Módulo de Cocina**. Manejo de arrays en JavaScript para actualizar y filtrar el estado de las órdenes.
* **Maria Rebeca de la Cruz Antezana:** Implementación del **Módulo de Facturación**. Cálculos finales y cierre de procesos.

---

## 🚀 Instrucciones para Ejecutar el Proyecto

### 📋 Paso a paso
 
**Clonar el repositorio:**
```bash
git clone https://github.com/tu-usuario/san-choclito.git
cd san-choclito
```
 
**Abrir el proyecto:**
 
**Opción A — Con VS Code + Live Server *(recomendado)*:**
```
1. Abrir la carpeta del proyecto en VS Code
2. Clic derecho sobre index.html → "Open with Live Server"
```
 
**Opción B — Directamente en el navegador:**
```
Abrir el archivo index.html con doble clic desde el explorador de archivos
```
 
> ⚠️ Se recomienda Live Server para evitar restricciones de CORS al leer localStorage entre páginas.
 
---

### 🔄 Flujo de uso
```
Home → Platos (registrar platos) → Pedidos (crear pedido)
     → Cocina (gestionar preparación) → Facturación (cerrar cuenta)
```
---
 
### 💾 Almacenamiento de datos
 
Los datos se guardan automáticamente en `localStorage` del navegador bajo las claves:
 
| Clave | Descripción |
|---|---|
| `platos` | Platos registrados en el sistema |
| `sc_pedidos` | Pedidos creados por los mozos |
 
> 🧹 **Para limpiar todos los datos durante pruebas:**  
> `F12 → Application → Local Storage → clic derecho → Clear`
