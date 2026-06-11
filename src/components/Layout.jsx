import { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useNotificacionesEnVivo } from "../hooks/useNotifications";
import Dashboard from "../pages/Dashboard";
import Ventas from "../pages/Ventas";
import Inventario from "../pages/Inventario";
import Clientes from "../pages/Clientes";
import Gastos from "../pages/Gastos";
import Proveedores from "../pages/Proveedores";
import Pedidos from "../pages/Pedidos";
import Metas from "../pages/Metas";
import NotificationBell from "./NotificationBell";

const MENU = [
  { id:"dashboard", label:"Dashboard", icon:"📊" },
  { id:"ventas", label:"Ventas", icon:"🛒" },
  { id:"inventario", label:"Inventario", icon:"📦" },
  { id:"clientes", label:"Clientes", icon:"👥" },
  { id:"gastos", label:"Gastos", icon:"💸" },
  { id:"proveedores", label:"Proveedores", icon:"🚚" },
  { id:"pedidos", label:"Pedidos", icon:"📋" },
  { id:"metas", label:"Metas", icon:"🎯" },
];

export default function Layout({ user }) {
  const [active, setActive] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);

  useNotificacionesEnVivo(user?.email);

  const PAGES = {
    dashboard:<Dashboard/>, ventas:<Ventas/>, inventario:<Inventario/>,
    clientes:<Clientes/>, gastos:<Gastos/>, proveedores:<Proveedores/>,
    pedidos:<Pedidos/>, metas:<Metas/>
  };

  return (
    <div style={{display:"flex",minHeight:"100vh",background:"#0f0f0f"}}>
      <aside style={{width:220,background:"#141414",borderRight:"1px solid #1f1f1f",display:"flex",flexDirection:"column",position:"fixed",top:0,left:0,height:"100vh",zIndex:100}} className="sidebar">
        <div style={{padding:"24px 20px 16px",borderBottom:"1px solid #1f1f1f"}}>
          <div style={{fontSize:22,fontWeight:800,color:"#C8E05A",letterSpacing:1}}>DUPPLA</div>
          <div style={{fontSize:11,color:"#555",marginTop:3}}>Panel de gestión</div>
        </div>
        <nav style={{flex:1,padding:"12px 10px",overflowY:"auto"}}>
          {MENU.map(m=>(
            <button key={m.id} onClick={()=>{setActive(m.id);setMenuOpen(false);}}
              style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,border:"none",background:active===m.id?"#1e2a0e":"transparent",color:active===m.id?"#C8E05A":"#888",cursor:"pointer",fontSize:13,fontWeight:active===m.id?600:400,marginBottom:2,transition:"all .15s",textAlign:"left"}}>
              <span style={{fontSize:16}}>{m.icon}</span>{m.label}
            </button>
          ))}
        </nav>
        <div style={{padding:"16px 20px",borderTop:"1px solid #1f1f1f"}}>
          <div style={{marginBottom:10}}><NotificationBell user={user} /></div>
          <div style={{fontSize:12,color:"#555",marginBottom:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.email}</div>
          <button onClick={()=>signOut(auth)} style={{width:"100%",padding:"9px",background:"transparent",border:"1px solid #2a2a2a",borderRadius:8,color:"#666",cursor:"pointer",fontSize:12}}>Cerrar sesión</button>
        </div>
      </aside>

      <div style={{display:"none",position:"fixed",top:0,left:0,right:0,height:56,background:"#141414",borderBottom:"1px solid #1f1f1f",alignItems:"center",justifyContent:"space-between",padding:"0 16px",zIndex:200}} className="mobile-header">
        <span style={{fontSize:18,fontWeight:800,color:"#C8E05A"}}>DUPPLA</span>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <NotificationBell user={user} />
          <button onClick={()=>setMenuOpen(!menuOpen)} style={{background:"none",border:"none",color:"#fff",fontSize:22,cursor:"pointer"}}>☰</button>
        </div>
      </div>

      {menuOpen && <div onClick={()=>setMenuOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:99}} />}

      <main style={{marginLeft:220,flex:1,padding:"32px",minHeight:"100vh"}} className="main-content">
        {PAGES[active]}
      </main>

      <style>{`
        @media(max-width:768px){
          .sidebar{transform:translateX(${menuOpen?"0":"-100%"});transition:transform .25s;z-index:150}
          .mobile-header{display:flex!important}
          .main-content{margin-left:0!important;padding:70px 16px 24px!important}
        }
      `}</style>
    </div>
  );
}
