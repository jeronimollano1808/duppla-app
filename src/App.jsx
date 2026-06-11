import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import Login from "./pages/Login";
import Layout from "./components/Layout";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#0a0a0a"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:32,fontWeight:700,color:"#C8E05A",marginBottom:8}}>DUPPLA</div>
        <div style={{color:"#666",fontSize:14}}>Cargando...</div>
      </div>
    </div>
  );

  return user ? <Layout user={user} /> : <Login />;
}
