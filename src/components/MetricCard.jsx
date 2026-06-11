export default function MetricCard({ label, value, color="#f0f0f0", sub }) {
  return (
    <div style={{background:"#141414",border:"1px solid #222",borderRadius:12,padding:"16px 18px"}}>
      <div style={{fontSize:12,color:"#555",marginBottom:6,textTransform:"uppercase",letterSpacing:.05}}>{label}</div>
      <div style={{fontSize:26,fontWeight:700,color}}>{value}</div>
      {sub && <div style={{fontSize:12,color:"#555",marginTop:4}}>{sub}</div>}
    </div>
  );
}
