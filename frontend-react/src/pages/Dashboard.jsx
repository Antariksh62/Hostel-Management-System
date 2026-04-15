import { useEffect, useState } from "react";
import API from "../services/api";
import Sidebar from "../components/Sidebar";

function Dashboard() {
const role = localStorage.getItem("role");

const [complaints, setComplaints] = useState([]);
const [form, setForm] = useState({
issue: "",
room: "",
category: "Electricity",
image: null
});

const fetchComplaints = async () => {
try {
const res = await API.get("/complaints");
setComplaints(res.data);
} catch (err) {
console.log(err);
}
};

const resolveComplaint = async (id) => {
await API.put(`/complaints/${id}`);
fetchComplaints();
};

const submitComplaint = async () => {
try {
const data = new FormData();
data.append("issue", form.issue);
data.append("room", form.room);
data.append("category", form.category);
if (form.image) data.append("image", form.image);


  await API.post("/complaints", data);

  alert("Complaint submitted!");
  setForm({ issue: "", room: "", category: "Electricity", image: null });
  fetchComplaints();
} catch (err) {
  console.log(err);
}


};

useEffect(() => {
fetchComplaints();
}, []);

return (
<div style={{ display: "flex" }}> <Sidebar />


  <div style={container}>
    <h1 style={{ marginBottom: "20px" }}>
      Dashboard <span style={{ color: "#3b82f6" }}>({role})</span>
    </h1>

    {/* STATS */}
    <div style={stats}>
      <StatCard title="Total" value={complaints.length} />
      <StatCard title="Resolved" value={complaints.filter(c => c.status === "Resolved").length} />
      <StatCard title="Pending" value={complaints.filter(c => c.status !== "Resolved").length} />
    </div>

    {/* STUDENT FORM */}
    {role === "student" && (
      <div style={formBox}>
        <h2>Raise Complaint</h2>

        <input
          placeholder="Issue"
          value={form.issue}
          onChange={(e) => setForm({ ...form, issue: e.target.value })}
        />

        <input
          placeholder="Room Number"
          value={form.room}
          onChange={(e) => setForm({ ...form, room: e.target.value })}
        />

        <select
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        >
          <option>Electricity</option>
          <option>Plumbing</option>
          <option>Cleaning</option>
          <option>Other</option>
        </select>

        <input
          type="file"
          onChange={(e) => setForm({ ...form, image: e.target.files[0] })}
        />

        <button onClick={submitComplaint} style={primaryBtn}>
          Submit Complaint
        </button>
      </div>
    )}

    {/* COMPLAINTS */}
    <h2 style={{ marginTop: "30px" }}>Complaints</h2>

    {complaints.map((c) => (
      <div key={c._id} style={card}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <h3>{c.issue}</h3>
          <span style={{
            color: c.status === "Resolved" ? "green" : "orange",
            fontWeight: "bold"
          }}>
            {c.status}
          </span>
        </div>

        <p>Room: {c.room}</p>
        <p>Category: {c.category}</p>

        {c.image && (
          <img
            src={`http://localhost:5000/uploads/${c.image}`}
            width="120"
            style={{ cursor: "pointer", borderRadius: "8px" }}
            onClick={() => window.open(`http://localhost:5000/uploads/${c.image}`)}
          />
        )}

        <br /><br />

        {role === "warden" && c.status !== "Resolved" && (
          <button onClick={() => resolveComplaint(c._id)} style={successBtn}>
            Resolve
          </button>
        )}
      </div>
    ))}
  </div>
</div>


);
}

/* STYLES */

const container = {
flex: 1,
padding: "30px",
background: "#f8fafc",
minHeight: "100vh"
};

const stats = {
display: "flex",
gap: "20px",
marginBottom: "20px"
};

const formBox = {
background: "rgba(255,255,255,0.7)",
backdropFilter: "blur(10px)",
padding: "20px",
borderRadius: "12px",
display: "flex",
flexDirection: "column",
gap: "10px"
};

const card = {
background: "white",
padding: "20px",
borderRadius: "12px",
marginTop: "15px",
boxShadow: "0 5px 15px rgba(0,0,0,0.1)"
};

const primaryBtn = {
background: "#3b82f6",
color: "white",
padding: "10px",
border: "none",
borderRadius: "8px",
cursor: "pointer"
};

const successBtn = {
background: "#10b981",
color: "white",
padding: "8px 12px",
border: "none",
borderRadius: "6px",
cursor: "pointer"
};

function StatCard({ title, value }) {
return (
<div style={{
flex: 1,
background: "white",
padding: "20px",
borderRadius: "12px",
boxShadow: "0 5px 15px rgba(0,0,0,0.1)"
}}> <h4>{title}</h4> <h2>{value}</h2> </div>
);
}

export default Dashboard;
