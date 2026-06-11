import { useState } from "react";
import { notifyPedidoEstado } from "../hooks/useNotifications";
import { collection, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import useCollection from "../hooks/useCollection";
import PageHeader from "../components/PageHeader";
import Card from "../components/Card";
import Btn from "../components/Btn";
import Modal from "../components/Modal";
import Input from "../components/Input";

const fmt = n => "$" + Number(n||0).toLocaleString("es-CO");
const ESTADOS = {pendiente:{label:"Pendiente",color:"#EF9F27",bg:"#2a1f00"},transito:{label:"En tránsito",color:"#378ADD",bg:"#0c2a3a"},recibido:{label:"Recibido",color:"#C8E05A",bg:"#1a2a0a"},cancelado:{label:"Cancelado",color:"#ff6b6b",bg:"#2a1010"}};

export default function Pedidos() {
  const { data: pedidos } = useCollection("pedidos");
  const { data: proveedores } = useCollection("proveedores","nombre");
  const { data: inventario } = useCollection("inventario","nombre");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({proveedorId:"",proveedorNombre:"",fecha:new Date().toISOString().slice(0,10),productos:[{prodId:"",nombre:"",cant:"",costoUnit:""}],costoFlete:"",estado:"pendiente",notas:""});
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const addProdLine = () => setForm(f=>({...f,productos:[...f.productos,{prodId:"",nombre:"",cant:"",costoUnit:""}]}));
  const setProdLine = (i,k,v) => setForm(f=>({...f,productos:f.productos.map((p,idx)=>idx===i?{...p,[k]:v}:p)}));

  const totalPedido = form.productos.reduce((s,p)=>s+Number(p.cant||0)*Number(p.costoUnit||0),0)+Number(form.costoFlete||0);

  const guardar = async () => {
    if(!form.proveedorId||!form.fecha){alert("Selecciona proveedor y fecha");return;}
    await addDoc(collection(db,"pedidos"),{...form,total:totalPedido,createdAt:serverTimestamp()});
    setModal(false);
    setForm({proveedorId:"",proveedorNombre:"",fecha:new Date().toISOString().slice(0,10),productos:[{prodId:"",nombre:"",cant:"",costoUnit:""}],costoFlete:"",estado:"pendiente",notas:""});
  };

  const cambiarEstado = async (id, estado) => {
    await updateDoc(doc(db,"pedidos",id),{estado});
    const prov = proveedores.find(p=>p.id===p.proveedorId);
    notifyPedidoEstado(pedidos.find(x=>x.id===id)?.proveedorNombre||"Proveedor", estado);
  };

  const eliminar = async id => { if(!confirm("¿Eliminar pedido?"))return; await deleteDoc(doc(db,"pedidos",id)); };

  return (
    <div>
      <PageHeader title="Pedidos a proveedores" subtitle="Importaciones y órdenes de compra"
        action={<Btn variant="primary" onClick={()=>setModal(true)}>+ Nuevo pedido</Btn>} />
      {pedidos.length===0 ? (
        <Card><div style={{color:"#555",textAlign:"center",padding:40}}>Sin pedidos registrados</div></Card>
      ) : (
        <div style={{display:"grid",gap:12}}>
          {pedidos.map(p=>{
            const est = ESTADOS[p.estado]||ESTADOS.pendiente;
            return (
              <Card key={p.id}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
                  <div>
                    <div style={{fontSize:15,fontWeight:700,color:"#f0f0f0",marginBottom:4}}>{p.proveedorNombre||"Proveedor"}</div>
                    <div style={{fontSize:12,color:"#555",marginBottom:8}}>Pedido del {p.fecha}</div>
                    <span style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,background:est.bg,color:est.color}}>{est.label}</span>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:20,fontWeight:700,color:"#C8E05A"}}>{fmt(p.total)}</div>
                    <div style={{fontSize:11,color:"#555",marginTop:2}}>Total del pedido</div>
                  </div>
                </div>
                {p.productos?.length>0 && (
                  <div style={{marginTop:12,background:"#111",borderRadius:8,padding:"10px 12px"}}>
                    {p.productos.filter(pr=>pr.nombre||pr.prodId).map((pr,i)=>(
                      <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4,color:"#888"}}>
                        <span>{pr.nombre||"Producto"}</span>
                        <span>{pr.cant} uds × {fmt(pr.costoUnit)}</span>
                      </div>
                    ))}
                    {Number(p.costoFlete)>0 && <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#555",marginTop:4,borderTop:"1px solid #1a1a1a",paddingTop:4}}><span>Flete / Importación</span><span>{fmt(p.costoFlete)}</span></div>}
                  </div>
                )}
                {p.notas && <div style={{marginTop:8,fontSize:12,color:"#555"}}>📝 {p.notas}</div>}
                <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
                  {Object.entries(ESTADOS).map(([k,v])=>k!==p.estado&&(
                    <Btn key={k} size="sm" onClick={()=>cambiarEstado(p.id,k)} style={{borderColor:v.color+"44",color:v.color}}>→ {v.label}</Btn>
                  ))}
                  <Btn size="sm" variant="danger" onClick={()=>eliminar(p.id)}>Eliminar</Btn>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={modal} onClose={()=>setModal(false)} title="Nuevo pedido" width={540}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div>
            <label style={{fontSize:12,color:"#666",display:"block",marginBottom:6}}>Proveedor *</label>
            <select value={form.proveedorId} onChange={e=>{const prov=proveedores.find(p=>p.id===e.target.value);set("proveedorId",e.target.value);set("proveedorNombre",prov?.nombre||"");}} style={{width:"100%",padding:"10px 12px",background:"#111",border:"1px solid #2a2a2a",borderRadius:9,color:"#f0f0f0",fontSize:14}}>
              <option value="">— Selecciona —</option>
              {proveedores.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <Input label="Fecha" type="date" value={form.fecha} onChange={e=>set("fecha",e.target.value)} />
        </div>
        <div style={{marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <label style={{fontSize:12,color:"#666"}}>Productos del pedido</label>
            <Btn size="sm" onClick={addProdLine}>+ Línea</Btn>
          </div>
          {form.productos.map((pl,i)=>(
            <div key={i} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:8,marginBottom:8}}>
              <select value={pl.prodId} onChange={e=>{const p=inventario.find(x=>x.id===e.target.value);setProdLine(i,"prodId",e.target.value);setProdLine(i,"nombre",p?.nombre||"");}} style={{padding:"8px 10px",background:"#111",border:"1px solid #2a2a2a",borderRadius:8,color:"#f0f0f0",fontSize:13}}>
                <option value="">Producto</option>
                {inventario.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <input type="number" placeholder="Cant." value={pl.cant} onChange={e=>setProdLine(i,"cant",e.target.value)} style={{padding:"8px 10px",background:"#111",border:"1px solid #2a2a2a",borderRadius:8,color:"#f0f0f0",fontSize:13}} />
              <input type="number" placeholder="Costo u." value={pl.costoUnit} onChange={e=>setProdLine(i,"costoUnit",e.target.value)} style={{padding:"8px 10px",background:"#111",border:"1px solid #2a2a2a",borderRadius:8,color:"#f0f0f0",fontSize:13}} />
            </div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Input label="Costo flete / importación ($)" type="number" value={form.costoFlete} onChange={e=>set("costoFlete",e.target.value)} placeholder="0" />
          <div style={{display:"flex",alignItems:"flex-end",paddingBottom:14}}>
            <div style={{background:"#111",borderRadius:9,padding:"10px 14px",width:"100%",textAlign:"center"}}>
              <div style={{fontSize:11,color:"#555",marginBottom:2}}>Total pedido</div>
              <div style={{fontSize:16,fontWeight:700,color:"#C8E05A"}}>{fmt(totalPedido)}</div>
            </div>
          </div>
        </div>
        <Input label="Notas" value={form.notas} onChange={e=>set("notas",e.target.value)} placeholder="Observaciones, términos de entrega..." />
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
          <Btn onClick={()=>setModal(false)}>Cancelar</Btn>
          <Btn variant="primary" onClick={guardar}>Crear pedido</Btn>
        </div>
      </Modal>
    </div>
  );
}
