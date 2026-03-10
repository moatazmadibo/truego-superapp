import { BrowserRouter, Routes, Route } from "react-router-dom";

function Landing() {
  return (
    <div style={{padding:40,textAlign:"center"}}>
      <h1>TrueGo</h1>
      <p>Pi Powered Global Mobility Platform</p>

      <div style={{marginTop:30}}>
        <a href="/rider">Rider App</a>
        <br/><br/>
        <a href="/driver">Driver App</a>
        <br/><br/>
        <a href="/admin">Admin Portal</a>
      </div>
    </div>
  )
}

function Rider() {
  return (
    <div style={{padding:40}}>
      <h2>TrueGo Rider</h2>
      <p>Book rides, services and deliveries</p>
    </div>
  )
}

function Driver() {
  return (
    <div style={{padding:40}}>
      <h2>TrueGo Driver</h2>
      <p>Manage trips and earnings</p>
    </div>
  )
}

function Admin() {
  return (
    <div style={{padding:40}}>
      <h2>TrueGo Admin Dashboard</h2>
      <p>Platform management portal</p>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/rider" element={<Rider />} />
        <Route path="/driver" element={<Driver />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  )
}