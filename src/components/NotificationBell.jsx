import { useState, useEffect } from "react";
import { requestPermission } from "../hooks/useNotifications";
import { db } from "../firebase";
import { collection, query, orderBy, limit, onSnapshot, updateDoc, doc } from "firebase/firestore";

export default function NotificationBell({ user }) {
  const [perm, setPerm] = useState(typeof Notification !== "undefined" ? Notification.permission : "default");
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const unread = notifs.filter(n => !n.leida).length;

  useEffect(() => {
    const q = query(collection(db, "notificaciones"), orderBy("createdAt", "desc"), limit(20));
    const unsub = onSnapshot(q, snap => {
      setNotifs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const activar = async () => {
    const result = await requestPermission();
    setPerm(result);
  };

  const marcarLeidas = async () => {
    notifs.filter(n => !n.leida).forEach(n => {
      updateDoc(doc(db, "notificaciones", n.id), { leida: true }).catch(() => {});
    });
  };

  const handleOpen = () => {
    setOpen(!open);
    if (!open && unread > 0) marcarLeidas();
  };

  const ICONOS = { venta:"💰", stock:"⚠️", proveedor:"🚚", meta:"🎯", pedido:"📋", resumen:"📊" };

  const fmtTiempo = (ts) => {
    if (!ts?.seconds) return "";
    const d = new Date(ts.seconds * 1000);
    const diff = Math.floor((Date.now() - d) / 60000);
    if (diff < 1) return "ahora";
    if (diff < 60) return `hace ${diff}m`;
    if (diff < 1440) return `hace ${Math.floor(diff/60)}h`;
    return d.toLocaleDateString("es-CO", { day:"numeric", month:"short" });
  };

  return (
    <div style={{position:"relative"}}>
      <button onClick={handleOpen}
        style={{position:"relative",background:"transparent",border:"1px solid #2a2a2a",borderRadius:10,padding:"7px 12px",color:"#ccc",cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontSize:13}}>
        🔔
        {unread > 0 && (
          <span style={{position:"absolute",top:-4,right:-4,background:"#C8E05A",color:"#0a0a0a",borderRadius:"50%",width:16,height:16,fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{position:"absolute",bottom:"calc(100% + 8px)",right:0,width:300,background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:14,zIndex:500,overflow:"hidden",boxShadow:"0 8px 32px rgba(0,0,0,.5)"}}>
          <div style={{padding:"12px 16px",borderBottom:"1px solid #222",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:13,fontWeight:600,color:"#f0f0f0"}}>Notificaciones</span>
            {perm !== "granted" && (
              <button onClick={activar} style={{fontSize:11,background:"#C8E05A",border:"none",borderRadius:6,padding:"3px 8px",color:"#0a0a0a",fontWeight:700,cursor:"pointer"}}>
                Activar
              </button>
            )}
          </div>
          <div style={{maxHeight:320,overflowY:"auto"}}>
            {notifs.length === 0 ? (
              <div style={{padding:"24px 16px",textAlign:"center",color:"#555",fontSize:13}}>
                Sin notificaciones aún
              </div>
            ) : notifs.map(n => (
              <div key={n.id} style={{padding:"10px 16px",borderBottom:"1px solid #1a1a1a",background:n.leida?"transparent":"#1e2a0e",transition:"background .2s"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600,color:n.leida?"#888":"#f0f0f0",marginBottom:2}}>{n.titulo}</div>
                    <div style={{fontSize:11,color:"#666",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.cuerpo}</div>
                  </div>
                  <span style={{fontSize:10,color:"#444",flexShrink:0,marginTop:2}}>{fmtTiempo(n.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
          {perm !== "granted" && (
            <div style={{padding:"10px 16px",background:"#1f1700",borderTop:"1px solid #2a2a2a",fontSize:11,color:"#EF9F27",textAlign:"center"}}>
              Activa las notificaciones para recibir alertas en el celular
            </div>
          )}
        </div>
      )}
    </div>
  );
}
