import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError("Correo o contraseña incorrectos");
      setLoading(false);
    }
  };

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#0a0a0a"}}>
      <div style={{width:"100%",maxWidth:400,padding:"0 24px"}}>
        <div style={{textAlign:"center",marginBottom:40}}>
          <div style={{fontSize:36,fontWeight:800,color:"#C8E05A",letterSpacing:2}}>DUPPLA</div>
          <div style={{color:"#666",fontSize:14,marginTop:6}}>Panel de gestión interno</div>
        </div>
        <form onSubmit={handleLogin} style={{background:"#1a1a1a",borderRadius:16,padding:32,border:"1px solid #2a2a2a"}}>
          <div style={{marginBottom:20}}>
            <label style={{fontSize:13,color:"#888",display:"block",marginBottom:8}}>Correo electrónico</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required
              style={{width:"100%",padding:"12px 14px",background:"#111",border:"1px solid #333",borderRadius:10,color:"#fff",fontSize:14}}
              placeholder="correo@ejemplo.com" />
          </div>
          <div style={{marginBottom:24}}>
            <label style={{fontSize:13,color:"#888",display:"block",marginBottom:8}}>Contraseña</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required
              style={{width:"100%",padding:"12px 14px",background:"#111",border:"1px solid #333",borderRadius:10,color:"#fff",fontSize:14}}
              placeholder="••••••••" />
          </div>
          {error && <div style={{background:"#2a1010",border:"1px solid #4a2020",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#ff6b6b",marginBottom:16}}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{width:"100%",padding:"13px",background:"#C8E05A",border:"none",borderRadius:10,color:"#0a0a0a",fontWeight:700,fontSize:15,cursor:loading?"not-allowed":"pointer",opacity:loading?0.7:1}}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
