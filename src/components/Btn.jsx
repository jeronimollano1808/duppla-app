export default function Btn({ children, onClick, variant="default", size="md", disabled, style={} }) {
  const base = {border:"none",borderRadius:10,cursor:disabled?"not-allowed":"pointer",fontWeight:600,display:"inline-flex",alignItems:"center",gap:6,transition:"opacity .15s",...style};
  const variants = {
    default:{background:"#2a2a2a",color:"#ccc",padding:size==="sm"?"7px 12px":"11px 18px",fontSize:size==="sm"?12:14},
    primary:{background:"#C8E05A",color:"#0a0a0a",padding:size==="sm"?"7px 12px":"11px 18px",fontSize:size==="sm"?12:14},
    danger:{background:"#2a1010",color:"#ff6b6b",padding:size==="sm"?"7px 12px":"11px 18px",fontSize:size==="sm"?12:14},
    ghost:{background:"transparent",color:"#888",padding:size==="sm"?"7px 12px":"11px 18px",fontSize:size==="sm"?12:14,border:"1px solid #2a2a2a"},
  };
  return <button onClick={onClick} disabled={disabled} style={{...base,...variants[variant],opacity:disabled?.5:1}}>{children}</button>;
}
