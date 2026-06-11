import { useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp } from "firebase/firestore";

export function requestPermission() {
  if (!("Notification" in window)) return Promise.resolve("denied");
  if (Notification.permission === "granted") return Promise.resolve("granted");
  return Notification.requestPermission();
}

export function notify(title, body, options = {}) {
  if (Notification.permission !== "granted") return;
  const n = new Notification(title, {
    body,
    tag: options.tag || "duppla",
    renotify: true,
    ...options
  });
  n.onclick = () => { window.focus(); n.close(); };
  return n;
}

// Guarda notificacion en Firestore para que el otro socio la reciba
export async function pushNotificacion(tipo, titulo, cuerpo) {
  try {
    await addDoc(collection(db, "notificaciones"), {
      tipo, titulo, cuerpo,
      leida: false,
      createdAt: serverTimestamp()
    });
  } catch(e) { console.error(e); }
}

export function notifyVenta(producto, cliente, total) {
  const cuerpo = `${producto}${cliente ? ` — ${cliente}` : ""} · $${Number(total).toLocaleString("es-CO")}`;
  notify("💰 Nueva venta registrada", cuerpo, { tag: "venta" });
  pushNotificacion("venta", "💰 Nueva venta registrada", cuerpo);
}

export function notifyStockBajo(productos) {
  if (!productos.length) return;
  const cuerpo = productos.map(p => `${p.nombre} (${p.stock} uds.)`).join(", ");
  notify("⚠️ Stock bajo", cuerpo, { tag: "stock", requireInteraction: true });
  pushNotificacion("stock", "⚠️ Stock bajo", cuerpo);
}

export function notifyProveedorAlerta(proveedor, productos) {
  const cuerpo = `Productos por agotarse: ${productos.map(p => p.nombre).join(", ")}`;
  notify(`🚚 Pedir a ${proveedor}`, cuerpo, { tag: `prov-${proveedor}`, requireInteraction: true });
  pushNotificacion("proveedor", `🚚 Pedir a ${proveedor}`, cuerpo);
}

export function notifyMetaAlcanzada(pct) {
  const cuerpo = pct >= 100 ? "¡Meta del mes alcanzada! 🎉" : `Vas al ${pct}% de la meta mensual`;
  notify("🎯 Meta mensual", cuerpo, { tag: "meta" });
  pushNotificacion("meta", "🎯 Meta mensual", cuerpo);
}

export function notifyPedidoEstado(proveedor, estado) {
  const cuerpo = `Pedido a ${proveedor} → ${estado}`;
  notify("📋 Pedido actualizado", cuerpo, { tag: "pedido" });
  pushNotificacion("pedido", "📋 Pedido actualizado", cuerpo);
}

// Hook: escucha notificaciones nuevas en Firestore y las muestra en el browser
export function useNotificacionesEnVivo(userEmail) {
  useEffect(() => {
    if (!userEmail) return;
    const q = query(collection(db, "notificaciones"), orderBy("createdAt", "desc"), limit(1));
    let first = true;
    const unsub = onSnapshot(q, snap => {
      if (first) { first = false; return; } // ignora la carga inicial
      snap.docChanges().forEach(change => {
        if (change.type === "added") {
          const d = change.doc.data();
          notify(d.titulo, d.cuerpo, { tag: d.tipo });
        }
      });
    });
    return unsub;
  }, [userEmail]);
}

// Hook: resumen diario a las 8pm
export function useResumenDiario(ventas, gastos) {
  useEffect(() => {
    if (Notification.permission !== "granted") return;
    const ahora = new Date();
    if (ahora.getHours() !== 20) return;
    const hoy = ahora.toISOString().slice(0, 10);
    const key = "duppla_resumen_" + hoy;
    if (localStorage.getItem(key)) return;
    const tv = ventas.filter(v=>v.fecha===hoy).reduce((s,v)=>s+Number(v.total||0),0);
    const tg = gastos.filter(g=>g.fecha===hoy).reduce((s,g)=>s+Number(g.valor||0),0);
    const cuerpo = `Ventas: $${tv.toLocaleString("es-CO")} · Gastos: $${tg.toLocaleString("es-CO")} · Utilidad: $${(tv-tg).toLocaleString("es-CO")}`;
    notify("📊 Resumen del día — DUPPLA", cuerpo, { tag: "resumen" });
    pushNotificacion("resumen", "📊 Resumen del día — DUPPLA", cuerpo);
    localStorage.setItem(key, "1");
  }, [ventas, gastos]);
}
