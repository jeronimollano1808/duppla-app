export default function PageHeader({ title, subtitle, action }) {
  return (
    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:28,flexWrap:"wrap",gap:12}}>
      <div>
        <h1 style={{fontSize:24,fontWeight:700,color:"#f0f0f0",marginBottom:4}}>{title}</h1>
        {subtitle && <p style={{fontSize:13,color:"#666"}}>{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
