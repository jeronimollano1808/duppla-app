import { useState } from "react";
import { collection, addDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import useCollection from "../hooks/useCollection";
import PageHeader from "../components/PageHeader";
import Card from "../components/Card";
import Btn from "../components/Btn";
import Modal from "../components/Modal";
import Input from "../components/Input";

const fmt = n => "$" + Number(n||0).toLocaleString("es-CO");
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

export default function Metas() {
  const { data: metas } = useCollection("metas","mes");
  const { data: ventas } = useCollection("ventas");
  const { data: gastos } = useCollection("gastos");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({mes:"",ventasMeta:"",gastoMax:"",notas:""});
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const guardar = async () => {
    if(!form.mes||!form.ventasMeta){alert("Mes y meta de ventas son requeridos");return;}
    await addDoc(collection(db,"metas"),{...form,ventasMeta:Number(form.ventasMeta),gastoMax:Number(form.gastoMax)||0,createdAt:serverTimestamp()});
    setModal(false);
    setForm({mes:"",ventasMeta:"",gastoMax:"",notas:""});
  };

  const eliminar = async id => { if(!confirm("¿Eliminar meta?"))return; await deleteDoc(doc(db,"metas",id)); };

  const ventasMes = (mes) => ventas.filter(v=>v.fecha?.slice(0,7)===mes).reduce((s,v)=>s+Number(v.total||0),0);
  const gastosMes = (mes) => gastos.filter(g=>g.fecha?.slice(0,7)===mes).reduce((s,g)=>s+Number(g.valor||0),0);

  return (
    <div>
      <PageHeader title="Metas y presupuesto" subtitle="Objetivos mensuales de ventas y gastos"
        action={<Btn variant="primary" onClick={()=>setModal(true)}>+ Nueva meta</Btn>} />
      {metas.length===0 ? (
        <Card><div style={{color:"#555",textAlign:"center",padding:40}}>Sin metas configuradas. Crea la primera.</div></Card>
      ) : (
        <div style={{display:"grid",gap:14}}>
          {metas.map(m=>{
            const tv = ventasMes(m.mes);
            const tg = gastosMes(m.mes);
            const pctV = m.ventasMeta>0?Math.min(100,Math.round((tv/m.ventasMeta)*100)):0;
            const pctG = m.gastoMax>0?Math.min(100,Math.round((tg/m.gastoMax)*100)):0;
            const [anio,mesNum] = m.mes.split("-");
            const mesLabel = MESES[parseInt(mesNum)-1]+" "+anio;
            return (
              <Card key={m.id}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,flexWrap:"wrap",gap:8}}>
                  <div>
                    <div style={{fontSize:16,fontWeight:700,color:"#f0f0f0"}}>{mesLabel}</div>
                    {m.notas&&<div style={{fontSize:12,color:"#555",marginTop:2}}>{m.notas}</div>}
                  </div>
                  <Btn size="sm" variant="danger" onClick={()=>eliminar(m.id)}>Eliminar</Btn>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                  <div>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                      <span style={{fontSize:12,color:"#666"}}>Ventas</span>
                      <span style={{fontSize:12,fontWeight:600,color:pctV>=100?"#C8E05A":pctV>=70?"#EF9F27":"#ccc"}}>{pctV}%</span>
                    </div>
                    <div style={{background:"#111",borderRadius:6,height:8}}>
                      <div style={{width:`${pctV}%`,height:"100%",background:pctV>=100?"#C8E05A":pctV>=70?"#EF9F27":"#378ADD",borderRadius:6,transition:"width .5s"}} />
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",marginTop:5,fontSize:11,color:"#555"}}>
                      <span>{fmt(tv)} logrado</span><span>Meta: {fmt(m.ventasMeta)}</span>
                    </div>
                  </div>
                  {m.gastoMax>0 && (
                    <div>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                        <span style={{fontSize:12,color:"#666"}}>Gastos</span>
                        <span style={{fontSize:12,fontWeight:600,color:pctG>=90?"#ff6b6b":pctG>=70?"#EF9F27":"#ccc"}}>{pctG}%</span>
                      </div>
                      <div style={{background:"#111",borderRadius:6,height:8}}>
                        <div style={{width:`${pctG}%`,height:"100%",background:pctG>=90?"#ff6b6b":pctG>=70?"#EF9F27":"#5DCAA5",borderRadius:6,transition:"width .5s"}} />
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",marginTop:5,fontSize:11,color:"#555"}}>
                        <span>{fmt(tg)} gastado</span><span>Máx: {fmt(m.gastoMax)}</span>
                      </div>
                    </div>
                  )}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginTop:14}}>
                  {[{l:"Ingresos",v:fmt(tv),c:"#C8E05A"},{l:"Gastos",v:fmt(tg),c:"#ff6b6b"},{l:"Utilidad",v:fmt(tv-tg),c:tv-tg>=0?"#C8E05A":"#ff6b6b"}].map(x=>(
                    <div key={x.l} style={{background:"#111",borderRadius:8,padding:"10px 12px",textAlign:"center"}}>
                      <div style={{fontSize:10,color:"#555",marginBottom:3}}>{x.l}</div>
                      <div style={{fontSize:14,fontWeight:700,color:x.c}}>{x.v}</div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <Modal open={modal} onClose={()=>setModal(false)} title="Nueva meta mensual">
        <Input label="Mes *" type="month" value={form.mes} onChange={e=>set("mes",e.target.value)} />
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Input label="Meta de ventas ($) *" type="number" value={form.ventasMeta} onChange={e=>set("ventasMeta",e.target.value)} placeholder="0" />
          <Input label="Presupuesto máx. gastos ($)" type="number" value={form.gastoMax} onChange={e=>set("gastoMax",e.target.value)} placeholder="0" />
        </div>
        <Input label="Notas" value={form.notas} onChange={e=>set("notas",e.target.value)} placeholder="Objetivos, compromisos..." />
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
          <Btn onClick={()=>setModal(false)}>Cancelar</Btn>
          <Btn variant="primary" onClick={guardar}>Guardar meta</Btn>
        </div>
      </Modal>
    </div>
  );
}
