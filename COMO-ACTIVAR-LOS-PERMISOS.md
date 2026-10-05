# Cómo activar los permisos (una sola vez)

Son cuatro pasos y hay que hacerlos **en este orden**. Si se cambia el orden,
Jero y Ángel pueden quedar sin permisos y toca arreglarlo a mano en la consola.

## 1. Crear la cuenta del visitante

Firebase → proyecto **dupplafitness** → **Authentication** → pestaña **Users**
→ **Add user**. Un correo y una contraseña (por ejemplo `visitante@duppla.co`).

Las cuentas de Jero y Ángel ya existen; no hay que tocarlas.

## 2. Que entren los dos administradores

**Antes de publicar las reglas.** Jero y Ángel abren la app y entran con su
correo. Con eso la app les crea su ficha en la colección `usuarios`.

- El primero que entre queda como **administrador** automáticamente.
- El segundo entra como **solo lectura**. El primero lo asciende en un clic
  desde **Operación → Usuarios**.

Comprobación: en **Usuarios** tienen que aparecer los dos con la etiqueta
🔑 Administrador.

## 3. Que entre el visitante una vez

Para que se le cree su ficha. Queda en **solo lectura**, que es lo correcto.

## 4. Publicar las reglas

Firebase → **Firestore Database** → pestaña **Reglas** → se borra todo lo que
haya y se pega el contenido de `firestore.rules` → **Publicar**.

## Cómo comprobar que quedó bien

Entrar con la cuenta del visitante y:

1. No debe verse ningún botón de registrar, editar ni borrar.
2. **La prueba que importa**: abrir la consola del navegador (F12) y escribir

   ```js
   await window.guardarGasto?.()
   ```

   Si las reglas están publicadas, no se guarda nada. Si se guardara, las
   reglas no quedaron aplicadas: revisar el paso 4.

## Si algo sale mal

Si los dos administradores quedaron como visitantes, se arregla desde
Firebase → Firestore Database → colección `usuarios` → se busca el documento
de cada uno y se cambia el campo `rol` a `admin` a mano.
