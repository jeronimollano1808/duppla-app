import { useState, useMemo } from "react";
import { collection, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import useCollection from "../hooks/useCollection";
import { notifyVenta, notifyStockBajo } from "../hooks/useNotifications";
import PageHeader from "../components/PageHeader";
import Card from "../components/Card";
import Btn from "../components/Btn";
import Modal from "../components/Modal";
import Input from "../components/Input";

const fmt = n => "$" + Number(n||0).toLocaleString("es-CO");

export default function Ventas() {
  const { data: ventas } = useCollection("ventas");
  const { data: inventario } = useCollection("inventario","nombre");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({fecha:new Date().toISOString().slice(0,10),canal:"web",prodId:"",cant:"1",precio:"",total:"",cliente:"",nota:""});
  const [busqueda, setBusqueda] = useState("");
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const prod = inventario.find(p=>p.id===form.prodId);

  useMemo(()=>{
    if(prod) set("precio", prod.pventa.toString());
  },[form.prodId]);

  const calcTotal = (cant,precio) => set("total",(Number(cant||0)*Number(precio||0)).toString());

  const registrar = async () => {
    if(!form.fecha||!form.prodId||!form.cant||!form.precio){alert("Completa todos los campos requeridos");return;}
    if(!prod){alert("Producto no encontrado");return;}
    if(prod.stock < Number(form.cant)){alert(`Stock insuficiente. Disponible: ${prod.stock} uds.`);return;}
    const nuevoStock = prod.stock - Number(form.cant);
    await updateDoc(doc(db,"inventario",prod.id),{stock: nuevoStock});
    await addDoc(collection(db,"ventas"),{
      fecha:form.fecha, canal:form.canal, producto:prod.nombre, prodId:prod.id,
      cant:Number(form.cant), precio:Number(form.precio), total:Number(form.total),
      cliente:form.cliente, nota:form.nota, createdAt:serverTimestamp()
    });
    // Notificaciones
    notifyVenta(prod.nombre, form.cliente, form.total);
    if(nuevoStock <= prod.stockMinimo) {
      notifyStockBajo([{...prod, stock: nuevoStock}]);
    }
    setModal(false);
    setForm({fecha:new Date().toISOString().slice(0,10),canal:"web",prodId:"",cant:"1",precio:"",total:"",cliente:"",nota:""});
  };

  const eliminar = async (id) => {
    if(!confirm("¿Eliminar esta venta?")) return;
    await deleteDoc(doc(db,"ventas",id));
  };

  const exportarCSV = () => {
    const header = ["Fecha","Canal","Producto","Cliente","Cantidad","Precio","Total","Nota"];
    const rows = filtradas.map(v=>[v.fecha,v.canal,v.producto,v.cliente||"",v.cant,v.precio,v.total,v.nota||""]);
    const csv = [header,...rows].map(r=>r.map(c=>`"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv],{type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=`DUPPLA_Ventas_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  const filtradas = ventas.filter(v =>
    !busqueda || v.cliente?.toLowerCase().includes(busqueda.toLowerCase()) || v.producto?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const CANAL_STYLE = {web:{bg:"#0c2a3a",color:"#378ADD"},directo:{bg:"#1a2a0a",color:"#C8E05A"},distribuidor:{bg:"#2a1f00",color:"#EF9F27"}};

  return (
    <div>
      <PageHeader title="Ventas" subtitle="Registro y seguimiento de ventas"
        action={<div style={{display:"flex",gap:8}}><Btn onClick={exportarCSV}>↓ CSV</Btn><Btn variant="primary" onClick={()=>setModal(true)}>+ Nueva venta</Btn></div>} />
      <Card>
        <input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar por cliente o producto..."
          style={{width:"100%",maxWidth:320,padding:"9px 12px",background:"#111",border:"1px solid #2a2a2a",borderRadius:9,color:"#f0f0f0",fontSize:13,marginBottom:16}} />
        {filtradas.length===0 ? <div style={{color:"#555",textAlign:"center",padding:40}}>Sin ventas registradas</div> : (
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr style={{borderBottom:"1px solid #222"}}>
                {["Fecha","Cliente","Producto","Canal","Cant.","Total",""].map(h=><th key={h} style={{textAlign:"left",padding:"8px 10px",color:"#555",fontWeight:500,fontSize:11}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {filtradas.map(v=>(
                  <tr key={v.id} style={{borderBottom:"1px solid #1a1a1a"}}>
                    <td style={{padding:"9px 10px",color:"#888",fontSize:12}}>{v.fecha}</td>
                    <td style={{padding:"9px 10px",color:"#ccc"}}>{v.cliente||"—"}</td>
                    <td style={{padding:"9px 10px",color:"#ccc",maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.producto}</td>
                    <td style={{padding:"9px 10px"}}><span style={{padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:600,...(CANAL_STYLE[v.canal]||{bg:"#222",color:"#888"})}}>{v.canal}</span></td>
                    <td style={{padding:"9px 10px",color:"#888"}}>{v.cant}</td>
                    <td style={{padding:"9px 10px",color:"#C8E05A",fontWeight:600}}>{fmt(v.total)}</td>
                    <td style={{padding:"9px 10px"}}><Btn size="sm" variant="danger" onClick={()=>eliminar(v.id)}>✕</Btn></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Modal open={modal} onClose={()=>setModal(false)} title="Registrar venta">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Input label="Fecha" type="date" value={form.fecha} onChange={e=>set("fecha",e.target.value)} />
          <Input label="Canal" type="select" value={form.canal} onChange={e=>set("canal",e.target.value)}>
            <option value="web">Página web</option>
            <option value="directo">Venta directa</option>
            <option value="distribuidor">Distribuidor</option>
          </Input>
        </div>
        <Input label="Producto *" type="select" value={form.prodId} onChange={e=>set("prodId",e.target.value)}>
          <option value="">— Selecciona un producto —</option>
          {inventario.map(p=><option key={p.id} value={p.id}>{p.nombre} (stock: {p.stock})</option>)}
        </Input>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Input label="Cantidad" type="number" value={form.cant} onChange={e=>{set("cant",e.target.value);calcTotal(e.target.value,form.precio);}} min="1" />
          <Input label="Precio unitario ($)" type="number" value={form.precio} onChange={e=>{set("precio",e.target.value);calcTotal(form.cant,e.target.value);}} />
        </div>
        <Input label="Total ($)" type="number" value={form.total} style={{opacity:.7}} readOnly />
        <Input label="Cliente" value={form.cliente} onChange={e=>set("cliente",e.target.value)} placeholder="Nombre del cliente" />
        <Input label="Nota (opcional)" value={form.nota} onChange={e=>set("nota",e.target.value)} placeholder="Referencia adicional" />
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
          <Btn onClick={()=>setModal(false)}>Cancelar</Btn>
          <Btn variant="primary" onClick={registrar}>Registrar venta</Btn>
        </div>
      </Modal>
    </div>
  );
}
