import { useMemo, useState } from "react";
import useCollection from "../hooks/useCollection";
import PageHeader from "../components/PageHeader";
import Card from "../components/Card";

const fmt = n => "$" + Number(n||0).toLocaleString("es-CO");

export default function Clientes() {
  const { data: ventas } = useCollection("ventas");
  const [busqueda, setBusqueda] = useState("");
  const [detalle, setDetalle] = useState(null);

  const clientes = useMemo(()=>{
    const cm = {};
    ventas.forEach(v=>{
      if(!v.cliente) return;
      if(!cm[v.cliente]) cm[v.cliente]={nombre:v.cliente,compras:0,total:0,ultima:"",productos:{},canal:v.canal};
      cm[v.cliente].compras++;
      cm[v.cliente].total+=Number(v.total||0);
      if(!cm[v.cliente].ultima||v.fecha>cm[v.cliente].ultima) cm[v.cliente].ultima=v.fecha;
      cm[v.cliente].productos[v.producto]=(cm[v.cliente].productos[v.producto]||0)+Number(v.cant||0);
    });
    return Object.values(cm).sort((a,b)=>b.total-a.total);
  },[ventas]);

  const filtrados = clientes.filter(c=>!busqueda||c.nombre.toLowerCase().includes(busqueda.toLowerCase()));
  const comprasDetalle = detalle ? ventas.filter(v=>v.cliente===detalle.nombre) : [];

  return (
    <div>
      <PageHeader title="Clientes" subtitle={`${clientes.length} clientes registrados`} />
      <Card>
        <input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar cliente..."
          style={{width:"100%",maxWidth:300,padding:"9px 12px",background:"#111",border:"1px solid #2a2a2a",borderRadius:9,color:"#f0f0f0",fontSize:13,marginBottom:16}} />
        {filtrados.length===0 ? <div style={{color:"#555",textAlign:"center",padding:40}}>Sin clientes aún. Se crean automáticamente desde las ventas.</div> : (
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr style={{borderBottom:"1px solid #222"}}>
              {["Cliente","Compras","Total","Producto favorito","Última compra",""].map(h=><th key={h} style={{textAlign:"left",padding:"8px 10px",color:"#555",fontWeight:500,fontSize:11}}>{h}</th>)}
            </tr></thead>
            <tbody>
              {filtrados.map((c,i)=>{
                const initials=c.nombre.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
                const fav=Object.entries(c.productos).sort((a,b)=>b[1]-a[1])[0];
                const colors=["#C8E05A","#378ADD","#EF9F27","#7F77DD","#5DCAA5"];
                const col=colors[i%colors.length];
                return (
                  <tr key={c.nombre} style={{borderBottom:"1px solid #1a1a1a",cursor:"pointer"}} onClick={()=>setDetalle(c===detalle?null:c)}>
                    <td style={{padding:"9px 10px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <span style={{width:32,height:32,borderRadius:"50%",background:col+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:col,flexShrink:0}}>{initials}</span>
                        <span style={{color:"#f0f0f0",fontWeight:500}}>{c.nombre}</span>
                      </div>
                    </td>
                    <td style={{padding:"9px 10px",color:"#888"}}>{c.compras}</td>
                    <td style={{padding:"9px 10px",color:"#C8E05A",fontWeight:600}}>{fmt(c.total)}</td>
                    <td style={{padding:"9px 10px",color:"#666",fontSize:12}}>{fav?fav[0].split(" ").slice(0,3).join(" "):"—"}</td>
                    <td style={{padding:"9px 10px",color:"#888",fontSize:12}}>{c.ultima}</td>
                    <td style={{padding:"9px 10px",color:"#555",fontSize:12}}>{detalle?.nombre===c.nombre?"▲":"▼"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {detalle && (
          <div style={{marginTop:16,background:"#111",borderRadius:10,padding:16}}>
            <div style={{fontSize:13,fontWeight:600,color:"#ccc",marginBottom:10}}>Compras de {detalle.nombre}</div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr style={{borderBottom:"1px solid #222"}}>{["Fecha","Producto","Canal","Total"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 8px",color:"#555",fontWeight:500}}>{h}</th>)}</tr></thead>
              <tbody>{comprasDetalle.map(v=>(
                <tr key={v.id} style={{borderBottom:"1px solid #1a1a1a"}}>
                  <td style={{padding:"7px 8px",color:"#888"}}>{v.fecha}</td>
                  <td style={{padding:"7px 8px",color:"#ccc"}}>{v.producto}</td>
                  <td style={{padding:"7px 8px",color:"#666"}}>{v.canal}</td>
                  <td style={{padding:"7px 8px",color:"#C8E05A",fontWeight:600}}>{fmt(v.total)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
