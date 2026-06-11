export default function Card({ children, style={} }) {
  return (
    <div style={{background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:14,padding:"20px 22px",...style}}>
      {children}
    </div>
  );
}
