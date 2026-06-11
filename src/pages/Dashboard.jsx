import { useMemo, useEffect } from "react";
import useCollection from "../hooks/useCollection";
import { useResumenDiario, notifyProveedorAlerta } from "../hooks/useNotifications";
import MetricCard from "../components/MetricCard";
import Card from "../components/Card";
import PageHeader from "../components/PageHeader";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const fmt = n => "$" + Number(n||0).toLocaleString("es-CO");

function getWeek(offset=0) {
  const now = new Date(), day = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - (day===0?6:day-1) + offset*7);
  mon.setHours(0,0,0,0);
  const sun = new Date(mon); sun.setDate(mon.getDate()+6); sun.setHours(23,59,59,999);
  return { start:mon, end:sun };
}

export default function Dashboard() {
  const { data: ventas } = useCollection("ventas");
  const { data: gastos } = useCollection("gastos");
  const { data: inventario } = useCollection("inventario","nombre");
  const { data: metas } = useCollection("metas","mes");
  const { data: proveedores } = useCollection("proveedores","nombre");

  useResumenDiario(ventas, gastos);

  // Notificar alertas de proveedor cuando hay stock bajo
  useEffect(() => {
    if (!proveedores.length || !inventario.length) return;
    proveedores.forEach(prov => {
      if (!prov.productos?.length) return;
      const bajos = inventario.filter(p => prov.productos.includes(p.id) && p.stock <= p.stockMinimo);
      if (bajos.length > 0) {
        const key = `duppla_prov_alert_${prov.id}_${new Date().toISOString().slice(0,10)}`;
        if (!localStorage.getItem(key)) {
          notifyProveedorAlerta(prov.nombre, bajos);
          localStorage.setItem(key, "1");
        }
      }
    });
  }, [proveedores, inventario]);

  const { start, end } = getWeek(0);
  const semanaVentas = ventas.filter(v => { const d = new Date(v.fecha); return d>=start&&d<=end; });
  const semanaGastos = gastos.filter(g => { const d = new Date(g.fecha); return d>=start&&d<=end; });
  const totalVentas = semanaVentas.reduce((s,v)=>s+Number(v.total||0),0);
  const totalGastos = semanaGastos.reduce((s,g)=>s+Number(g.valor||0),0);
  const utilidad = totalVentas - totalGastos;

  const canalData = useMemo(()=>{
    const c = {web:0, directo:0, distribuidor:0};
    semanaVentas.forEach(v=>{ if(c[v.canal]!==undefined) c[v.canal]+=Number(v.total||0); });
    return [
      {name:"Web", valor:c.web, fill:"#378ADD"},
      {name:"Directo", valor:c.directo, fill:"#C8E05A"},
      {name:"Distribuidor", valor:c.distribuidor, fill:"#EF9F27"},
    ];
  },[semanaVentas]);

  const topProductos = useMemo(()=>{
    const pm = {};
    ventas.forEach(v=>{ if(!pm[v.producto]) pm[v.producto]={cant:0,total:0}; pm[v.producto].cant+=Number(v.cant||0); pm[v.producto].total+=Number(v.total||0); });
    return Object.entries(pm).sort((a,b)=>b[1].cant-a[1].cant).slice(0,5);
  },[ventas]);

  const stockAlertas = inventario.filter(p => p.stock <= p.stockMinimo);
  const metaMes = metas[0];
  const pctMeta = metaMes ? Math.min(100, Math.round((totalVentas/metaMes.ventasMeta)*100)) : null;

  const hoy = new Date().toISOString().slice(0,10);
  const ventasHoy = ventas.filter(v=>v.fecha===hoy);
  const totalHoy = ventasHoy.reduce((s,v)=>s+Number(v.total||0),0);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`Semana del ${start.toLocaleDateString("es-CO",{day:"numeric",month:"short"})} al ${end.toLocaleDateString("es-CO",{day:"numeric",month:"short"})}`} />

      {stockAlertas.length > 0 && (
        <div style={{background:"#1f1700",border:"1px solid #3a2e00",borderRadius:12,padding:"12px 16px",marginBottom:20,fontSize:13,color:"#EF9F27"}}>
          ⚠️ <strong>Stock bajo:</strong> {stockAlertas.map(p=>`${p.nombre} (${p.stock} uds.)`).join(" · ")}
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:24}}>
        <MetricCard label="Ingresos semana" value={fmt(totalVentas)} color="#C8E05A" />
        <MetricCard label="Gastos semana" value={fmt(totalGastos)} color="#ff6b6b" />
        <MetricCard label="Utilidad" value={fmt(utilidad)} color={utilidad>=0?"#C8E05A":"#ff6b6b"} />
        <MetricCard label="Ventas hoy" value={ventasHoy.length} color="#378ADD" sub={fmt(totalHoy)} />
      </div>

      {metaMes && (
        <Card style={{marginBottom:20}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <span style={{fontSize:13,fontWeight:600,color:"#ccc"}}>Meta del mes</span>
            <span style={{fontSize:13,color:"#C8E05A",fontWeight:700}}>{pctMeta}%</span>
          </div>
          <div style={{background:"#111",borderRadius:6,height:8}}>
            <div style={{width:`${pctMeta}%`,height:"100%",background:"#C8E05A",borderRadius:6,transition:"width .5s"}} />
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:11,color:"#555"}}>
            <span>{fmt(totalVentas)} acumulado</span><span>Meta: {fmt(metaMes.ventasMeta)}</span>
          </div>
        </Card>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
        <Card>
          <div style={{fontSize:13,fontWeight:600,color:"#ccc",marginBottom:16}}>Ventas por canal — semana</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={canalData} margin={{top:0,right:0,left:-20,bottom:0}}>
              <XAxis dataKey="name" tick={{fill:"#666",fontSize:11}} axisLine={false} tickLine={false} />
              <YAxis tick={{fill:"#666",fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>"$"+Math.round(v/1000)+"k"} />
              <Tooltip formatter={v=>fmt(v)} contentStyle={{background:"#1a1a1a",border:"1px solid #333",borderRadius:8,color:"#f0f0f0"}} />
              <Bar dataKey="valor" radius={[6,6,0,0]}>
                {canalData.map((e,i)=><Cell key={i} fill={e.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <div style={{fontSize:13,fontWeight:600,color:"#ccc",marginBottom:14}}>Productos más vendidos</div>
          {topProductos.length ? topProductos.map(([nombre,d],i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <span style={{width:22,height:22,borderRadius:"50%",background:["#C8E05A22","#37a22222","#378ADD22","#EF9F2722","#ff6b6b22"][i],display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:["#C8E05A","#3a9922","#378ADD","#EF9F27","#ff6b6b"][i],flexShrink:0}}>{i+1}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:500,color:"#ccc",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{nombre}</div>
                <div style={{background:"#111",borderRadius:3,height:4,marginTop:3}}>
                  <div style={{width:`${Math.round((d.cant/topProductos[0][1].cant)*100)}%`,height:"100%",background:"#C8E05A",borderRadius:3}} />
                </div>
              </div>
              <span style={{fontSize:11,color:"#555",flexShrink:0}}>{d.cant} uds</span>
            </div>
          )) : <div style={{color:"#555",fontSize:13,textAlign:"center",padding:"20px 0"}}>Sin ventas registradas</div>}
        </Card>
      </div>

      <Card>
        <div style={{fontSize:13,fontWeight:600,color:"#ccc",marginBottom:14}}>Últimas 8 ventas</div>
        {ventas.slice(0,8).length ? (
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr style={{borderBottom:"1px solid #222"}}>{["Fecha","Cliente","Producto","Canal","Total"].map(h=><th key={h} style={{textAlign:"left",padding:"8px 10px",color:"#555",fontWeight:500,fontSize:11}}>{h}</th>)}</tr></thead>
            <tbody>
              {ventas.slice(0,8).map(v=>(
                <tr key={v.id} style={{borderBottom:"1px solid #1a1a1a"}}>
                  <td style={{padding:"9px 10px",color:"#888",fontSize:12}}>{v.fecha}</td>
                  <td style={{padding:"9px 10px",color:"#ccc"}}>{v.cliente||"—"}</td>
                  <td style={{padding:"9px 10px",color:"#ccc",maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.producto}</td>
                  <td style={{padding:"9px 10px"}}><span style={{padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:500,background:{web:"#0c2a3a",directo:"#1a2a0a",distribuidor:"#2a1f00"}[v.canal],color:{web:"#378ADD",directo:"#C8E05A",distribuidor:"#EF9F27"}[v.canal]||"#888"}}>{v.canal}</span></td>
                  <td style={{padding:"9px 10px",color:"#C8E05A",fontWeight:600}}>{fmt(v.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div style={{color:"#555",fontSize:13,textAlign:"center",padding:"20px 0"}}>Sin ventas aún</div>}
      </Card>
    </div>
  );
}
