import { useState } from "react";
import { collection, addDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import useCollection from "../hooks/useCollection";
import PageHeader from "../components/PageHeader";
import Card from "../components/Card";
import Btn from "../components/Btn";
import Modal from "../components/Modal";
import Input from "../components/Input";

export default function Proveedores() {
  const { data: proveedores } = useCollection("proveedores","nombre");
  const { data: inventario } = useCollection("inventario","nombre");
  const [modal, setModal] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [form, setForm] = useState({nombre:"",pais:"Estados Unidos",contacto:"",email:"",whatsapp:"",productos:[],notas:""});
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const toggleProd = (id) => {
    setForm(f=>({...f,productos:f.productos.includes(id)?f.productos.filter(p=>p!==id):[...f.productos,id]}));
  };

  const guardar = async () => {
    if(!form.nombre){alert("El nombre es requerido");return;}
    await addDoc(collection(db,"proveedores"),{...form,createdAt:serverTimestamp()});
    setModal(false);
    setForm({nombre:"",pais:"Estados Unidos",contacto:"",email:"",whatsapp:"",productos:[],notas:""});
  };

  const eliminar = async id => { if(!confirm("¿Eliminar proveedor?"))return; await deleteDoc(doc(db,"proveedores",id)); };

  const prodsPorProveedor = (prov) => inventario.filter(p=>prov.productos?.includes(p.id));
  const alertasPorProveedor = (prov) => prodsPorProveedor(prov).filter(p=>p.stock<=p.stockMinimo);

  return (
    <div>
      <PageHeader title="Proveedores" subtitle="Gestión de proveedores y productos asociados"
        action={<Btn variant="primary" onClick={()=>setModal(true)}>+ Agregar proveedor</Btn>} />
      {proveedores.length===0 ? (
        <Card><div style={{color:"#555",textAlign:"center",padding:40}}>Sin proveedores. Agrega el primero.</div></Card>
      ) : (
        <div style={{display:"grid",gap:12}}>
          {proveedores.map(p=>{
            const alertas = alertasPorProveedor(p);
            const prods = prodsPorProveedor(p);
            return (
              <Card key={p.id}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
                  <div style={{flex:1,minWidth:200}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                      <div style={{width:36,height:36,borderRadius:"50%",background:"#1e2a0e",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"#C8E05A",fontWeight:700,flexShrink:0}}>
                        {p.nombre.slice(0,2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{fontWeight:700,color:"#f0f0f0",fontSize:15}}>{p.nombre}</div>
                        <div style={{fontSize:12,color:"#555"}}>{p.pais}</div>
                      </div>
                    </div>
                    {p.contacto && <div style={{fontSize:12,color:"#666",marginBottom:2}}>👤 {p.contacto}</div>}
                    {p.email && <div style={{fontSize:12,color:"#666",marginBottom:2}}>✉️ {p.email}</div>}
                    {p.whatsapp && <div style={{fontSize:12,color:"#666"}}>📱 {p.whatsapp}</div>}
                  </div>
                  <div style={{flex:1,minWidth:200}}>
                    <div style={{fontSize:11,color:"#555",marginBottom:6}}>PRODUCTOS ASOCIADOS ({prods.length})</div>
                    {prods.map(prod=>(
                      <div key={prod.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                        <span style={{fontSize:12,color:prod.stock<=prod.stockMinimo?"#EF9F27":"#ccc"}}>{prod.nombre}</span>
                        <span style={{fontSize:11,color:prod.stock===0?"#ff6b6b":prod.stock<=prod.stockMinimo?"#EF9F27":"#555"}}>{prod.stock} uds</span>
                      </div>
                    ))}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}>
                    {alertas.length>0 && (
                      <div style={{background:"#1f1700",border:"1px solid #3a2e00",borderRadius:8,padding:"6px 10px",fontSize:11,color:"#EF9F27"}}>
                        ⚠️ {alertas.length} producto{alertas.length>1?"s":""} con stock bajo
                      </div>
                    )}
                    <Btn size="sm" variant="danger" onClick={()=>eliminar(p.id)}>Eliminar</Btn>
                  </div>
                </div>
                {p.notas && <div style={{marginTop:12,padding:"8px 12px",background:"#111",borderRadius:8,fontSize:12,color:"#666"}}>📝 {p.notas}</div>}
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={modal} onClose={()=>setModal(false)} title="Agregar proveedor" width={520}>
        <Input label="Nombre del proveedor *" value={form.nombre} onChange={e=>set("nombre",e.target.value)} placeholder="Ej: NutritionFirst USA" />
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Input label="País de origen" value={form.pais} onChange={e=>set("pais",e.target.value)} placeholder="Estados Unidos" />
          <Input label="Contacto" value={form.contacto} onChange={e=>set("contacto",e.target.value)} placeholder="Nombre" />
          <Input label="Email" type="email" value={form.email} onChange={e=>set("email",e.target.value)} placeholder="contacto@proveedor.com" />
          <Input label="WhatsApp" value={form.whatsapp} onChange={e=>set("whatsapp",e.target.value)} placeholder="+1 555 000 0000" />
        </div>
        <div style={{marginBottom:14}}>
          <label style={{fontSize:12,color:"#666",display:"block",marginBottom:8}}>Productos que suministra</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {inventario.map(prod=>(
              <button key={prod.id} onClick={()=>toggleProd(prod.id)}
                style={{padding:"4px 10px",borderRadius:20,border:"1px solid",fontSize:12,cursor:"pointer",
                  background:form.productos.includes(prod.id)?"#1e2a0e":"#111",
                  borderColor:form.productos.includes(prod.id)?"#C8E05A":"#2a2a2a",
                  color:form.productos.includes(prod.id)?"#C8E05A":"#666"}}>
                {prod.nombre}
              </button>
            ))}
            {inventario.length===0 && <span style={{color:"#555",fontSize:12}}>Agrega productos en Inventario primero</span>}
          </div>
        </div>
        <Input label="Notas" value={form.notas} onChange={e=>set("notas",e.target.value)} placeholder="Condiciones, plazos, observaciones..." />
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
          <Btn onClick={()=>setModal(false)}>Cancelar</Btn>
          <Btn variant="primary" onClick={guardar}>Guardar proveedor</Btn>
        </div>
      </Modal>
    </div>
  );
}
