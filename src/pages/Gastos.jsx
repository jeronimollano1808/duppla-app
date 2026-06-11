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
const CATS = {importacion:"Importación",marketing:"Marketing",logistica:"Logística",plataformas:"Plataformas",operativo:"Operativo",otro:"Otro"};
const CAT_COLORS = {importacion:"#378ADD",marketing:"#C8E05A",logistica:"#EF9F27",plataformas:"#7F77DD",operativo:"#5DCAA5",otro:"#888"};

export default function Gastos() {
  const { data: gastos } = useCollection("gastos");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({fecha:new Date().toISOString().slice(0,10),cat:"importacion",desc:"",valor:""});
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const guardar = async () => {
    if(!form.fecha||!form.desc||!form.valor){alert("Completa todos los campos");return;}
    await addDoc(collection(db,"gastos"),{...form,valor:Number(form.valor),createdAt:serverTimestamp()});
    setModal(false);
    setForm({fecha:new Date().toISOString().slice(0,10),cat:"importacion",desc:"",valor:""});
  };

  const eliminar = async id => { if(!confirm("¿Eliminar?"))return; await deleteDoc(doc(db,"gastos",id)); };

  const totalPorCat = Object.keys(CATS).map(k=>({key:k,label:CATS[k],total:gastos.filter(g=>g.cat===k).reduce((s,g)=>s+Number(g.valor||0),0)})).filter(c=>c.total>0);
  const totalGastos = gastos.reduce((s,g)=>s+Number(g.valor||0),0);

  return (
    <div>
      <PageHeader title="Gastos" subtitle="Control de egresos por categoría"
        action={<Btn variant="primary" onClick={()=>setModal(true)}>+ Registrar gasto</Btn>} />
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:20}}>
        {totalPorCat.map(c=>(
          <div key={c.key} style={{background:"#141414",border:"1px solid #222",borderRadius:12,padding:"14px 16px"}}>
            <div style={{fontSize:11,color:"#555",marginBottom:4}}>{c.label}</div>
            <div style={{fontSize:18,fontWeight:700,color:CAT_COLORS[c.key]}}>{fmt(c.total)}</div>
          </div>
        ))}
        <div style={{background:"#141414",border:"1px solid #333",borderRadius:12,padding:"14px 16px"}}>
          <div style={{fontSize:11,color:"#555",marginBottom:4}}>Total gastos</div>
          <div style={{fontSize:18,fontWeight:700,color:"#ff6b6b"}}>{fmt(totalGastos)}</div>
        </div>
      </div>
      <Card>
        {gastos.length===0 ? <div style={{color:"#555",textAlign:"center",padding:40}}>Sin gastos registrados</div> : (
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr style={{borderBottom:"1px solid #222"}}>
              {["Fecha","Categoría","Descripción","Valor",""].map(h=><th key={h} style={{textAlign:"left",padding:"8px 10px",color:"#555",fontWeight:500,fontSize:11}}>{h}</th>)}
            </tr></thead>
            <tbody>
              {gastos.map(g=>(
                <tr key={g.id} style={{borderBottom:"1px solid #1a1a1a"}}>
                  <td style={{padding:"9px 10px",color:"#888",fontSize:12}}>{g.fecha}</td>
                  <td style={{padding:"9px 10px"}}><span style={{padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:600,background:"#1a1a2a",color:CAT_COLORS[g.cat]||"#888"}}>{CATS[g.cat]||g.cat}</span></td>
                  <td style={{padding:"9px 10px",color:"#ccc"}}>{g.desc}</td>
                  <td style={{padding:"9px 10px",color:"#ff6b6b",fontWeight:600}}>{fmt(g.valor)}</td>
                  <td style={{padding:"9px 10px"}}><Btn size="sm" variant="danger" onClick={()=>eliminar(g.id)}>✕</Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <Modal open={modal} onClose={()=>setModal(false)} title="Registrar gasto">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Input label="Fecha" type="date" value={form.fecha} onChange={e=>set("fecha",e.target.value)} />
          <Input label="Categoría" type="select" value={form.cat} onChange={e=>set("cat",e.target.value)}>
            {Object.entries(CATS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </Input>
        </div>
        <Input label="Descripción" value={form.desc} onChange={e=>set("desc",e.target.value)} placeholder="Ej: Pago proveedor MuscleTech" />
        <Input label="Valor ($)" type="number" value={form.valor} onChange={e=>set("valor",e.target.value)} placeholder="0" />
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
          <Btn onClick={()=>setModal(false)}>Cancelar</Btn>
          <Btn variant="primary" onClick={guardar}>Guardar gasto</Btn>
        </div>
      </Modal>
    </div>
  );
}
