export default function Modal({ open, onClose, title, children, width=480 }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:16,padding:28,width:"100%",maxWidth:width,maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
          <h2 style={{fontSize:17,fontWeight:700,color:"#f0f0f0"}}>{title}</h2>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#666",fontSize:20,cursor:"pointer"}}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
