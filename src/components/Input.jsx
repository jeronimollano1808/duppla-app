export default function Input({ label, ...props }) {
  return (
    <div style={{marginBottom:14}}>
      {label && <label style={{fontSize:12,color:"#666",display:"block",marginBottom:6}}>{label}</label>}
      {props.type === "select"
        ? <select {...props} style={{width:"100%",padding:"10px 12px",background:"#111",border:"1px solid #2a2a2a",borderRadius:9,color:"#f0f0f0",fontSize:14,...props.style}}>{props.children}</select>
        : <input {...props} style={{width:"100%",padding:"10px 12px",background:"#111",border:"1px solid #2a2a2a",borderRadius:9,color:"#f0f0f0",fontSize:14,...props.style}} />
      }
    </div>
  );
}
