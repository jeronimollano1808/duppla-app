import { useState } from "react";
import { collection, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import useCollection from "../hooks/useCollection";
import PageHeader from "../components/PageHeader";
import Card from "../components/Card";
import Btn from "../components/Btn";
import Modal from "../components/Modal";
import Input from "../components/Input";

const MARCAS = ["Integral Médica","MuscleTech","BSN","Nutrex","Nutricost","Vitanas","Smart Nutrition","Insane Labz","Youtheory","Otra"];
const fmt = n => "$" + Number(n||0).toLocaleString("es-CO");

export default function Inventario() {
  const { data: productos, loading } = useCollection("inventario","nombre");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({nombre:"",marca:"Integral Médica",stock:"",costo:"",pventa:"",stockMinimo:"5"});
  const [histModal, setHistModal] = useState(null);
  const [ajusteModal, setAjusteModal] = useState(null);
  const [ajusteDelta, setAjusteDelta] = useState("");

  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const guardar = async () => {
    if(!form.nombre||!form.pventa){alert("Nombre y precio de venta son requeridos");return;}
    await addDoc(collection(db,"inventario"),{
      nombre:form.nombre, marca:form.marca,
      stock:Number(form.stock)||0, costo:Number(form.costo)||0,
      pventa:Number(form.pventa), stockMinimo:Number(form.stockMinimo)||5,
      historialPrecios:[{precio:Number(form.pventa),fecha:new Date().toISOString().slice(0,10)}],
      createdAt:serverTimestamp()
    });
    setModal(false);
    setForm({nombre:"",marca:"Integral Médica",stock:"",costo:"",pventa:"",stockMinimo:"5"});
  };

  const ajustarStock = async () => {
    const delta = Number(ajusteDelta);
    if(isNaN(delta)||delta===0){alert("Ingresa un número distinto de 0");return;}
    const nuevo = Math.max(0, (ajusteModal.stock||0) + delta);
    await updateDoc(doc(db,"inventario",ajusteModal.id),{stock:nuevo});
    setAjusteModal(null); setAjusteDelta("");
  };

  const eliminar = async (id) => {
    if(!confirm("¿Eliminar producto?")) return;
    await deleteDoc(doc(db,"inventario",id));
  };

  return (
    <div>
      <PageHeader title="Inventario" subtitle="Productos y stock en tiempo real"
        action={<Btn variant="primary" onClick={()=>setModal(true)}>+ Agregar producto</Btn>} />

      {productos.filter(p=>p.stock<=p.stockMinimo).length>0 && (
        <div style={{background:"#1f1700",border:"1px solid #3a2e00",borderRadius:12,padding:"12px 16px",marginBottom:20,fontSize:13,color:"#EF9F27"}}>
          ⚠️ Productos con stock bajo: {productos.filter(p=>p.stock<=p.stockMinimo).map(p=>`${p.nombre} (${p.stock})`).join(", ")}
        </div>
      )}

      <Card>
        {loading ? <div style={{color:"#555",textAlign:"center",padding:40}}>Cargando...</div> :
        productos.length===0 ? <div style={{color:"#555",textAlign:"center",padding:40}}>Sin productos. Agrega el primero.</div> : (
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr style={{borderBottom:"1px solid #222"}}>
              {["Producto","Marca","Stock","P.Costo","P.Venta","Margen","Acciones"].map(h=>
                <th key={h} style={{textAlign:"left",padding:"8px 10px",color:"#555",fontWeight:500,fontSize:11}}>{h}</th>)}
            </tr></thead>
            <tbody>
              {productos.map(p=>{
                const margen = p.costo>0?Math.round(((p.pventa-p.costo)/p.costo)*100):null;
                const stockColor = p.stock===0?"#ff6b6b":p.stock<=p.stockMinimo?"#EF9F27":"#C8E05A";
                return (
                  <tr key={p.id} style={{borderBottom:"1px solid #1a1a1a"}}>
                    <td style={{padding:"10px 10px",color:"#f0f0f0",fontWeight:500}}>{p.nombre}</td>
                    <td style={{padding:"10px 10px",color:"#666",fontSize:12}}>{p.marca}</td>
                    <td style={{padding:"10px 10px"}}>
                      <span style={{color:stockColor,fontWeight:600}}>{p.stock}</span>
                      <span style={{color:"#444",fontSize:11}}> / mín {p.stockMinimo}</span>
                    </td>
                    <td style={{padding:"10px 10px",color:"#888"}}>{fmt(p.costo)}</td>
                    <td style={{padding:"10px 10px",color:"#C8E05A",fontWeight:600}}>{fmt(p.pventa)}</td>
                    <td style={{padding:"10px 10px",color:margen>=30?"#C8E05A":margen>=15?"#EF9F27":"#ff6b6b"}}>{margen!==null?margen+"%":"—"}</td>
                    <td style={{padding:"10px 10px"}}>
                      <div style={{display:"flex",gap:6}}>
                        <Btn size="sm" onClick={()=>{setAjusteModal(p);setAjusteDelta("");}}>Ajustar</Btn>
                        <Btn size="sm" onClick={()=>setHistModal(p)}>Historial</Btn>
                        <Btn size="sm" variant="danger" onClick={()=>eliminar(p.id)}>✕</Btn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={modal} onClose={()=>setModal(false)} title="Nuevo producto">
        <Input label="Nombre del producto" value={form.nombre} onChange={e=>set("nombre",e.target.value)} placeholder="Ej: Omega 3 Integral Médica" />
        <Input label="Marca" type="select" value={form.marca} onChange={e=>set("marca",e.target.value)}>
          {MARCAS.map(m=><option key={m}>{m}</option>)}
        </Input>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Input label="Stock inicial" type="number" value={form.stock} onChange={e=>set("stock",e.target.value)} placeholder="0" />
          <Input label="Stock mínimo (alerta)" type="number" value={form.stockMinimo} onChange={e=>set("stockMinimo",e.target.value)} placeholder="5" />
          <Input label="Precio de costo ($)" type="number" value={form.costo} onChange={e=>set("costo",e.target.value)} placeholder="0" />
          <Input label="Precio de venta ($)" type="number" value={form.pventa} onChange={e=>set("pventa",e.target.value)} placeholder="0" />
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
          <Btn onClick={()=>setModal(false)}>Cancelar</Btn>
          <Btn variant="primary" onClick={guardar}>Guardar producto</Btn>
        </div>
      </Modal>

      <Modal open={!!ajusteModal} onClose={()=>setAjusteModal(null)} title={`Ajustar stock — ${ajusteModal?.nombre}`}>
        <p style={{color:"#666",fontSize:13,marginBottom:16}}>Stock actual: <strong style={{color:"#C8E05A"}}>{ajusteModal?.stock}</strong></p>
        <Input label="Cantidad a sumar (+) o restar (-)" type="number" value={ajusteDelta} onChange={e=>setAjusteDelta(e.target.value)} placeholder="Ej: 10 o -5" />
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
          <Btn onClick={()=>setAjusteModal(null)}>Cancelar</Btn>
          <Btn variant="primary" onClick={ajustarStock}>Aplicar ajuste</Btn>
        </div>
      </Modal>

      <Modal open={!!histModal} onClose={()=>setHistModal(null)} title={`Historial de precios — ${histModal?.nombre}`}>
        {histModal?.historialPrecios?.length ? (
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr style={{borderBottom:"1px solid #222"}}><th style={{textAlign:"left",padding:"6px 8px",color:"#555"}}>Fecha</th><th style={{textAlign:"left",padding:"6px 8px",color:"#555"}}>Precio</th></tr></thead>
            <tbody>{[...histModal.historialPrecios].reverse().map((h,i)=>(
              <tr key={i} style={{borderBottom:"1px solid #1a1a1a"}}><td style={{padding:"8px 8px",color:"#888"}}>{h.fecha}</td><td style={{padding:"8px 8px",color:"#C8E05A",fontWeight:600}}>{fmt(h.precio)}</td></tr>
            ))}</tbody>
          </table>
        ) : <div style={{color:"#555",textAlign:"center",padding:20}}>Sin historial</div>}
      </Modal>
    </div>
  );
}
