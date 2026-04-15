import { useNavigate } from "react-router-dom";

function Sidebar() {
const navigate = useNavigate();

const logout = () => {
localStorage.clear();
navigate("/");
};

return ( <div style={sidebar}>
<h2 style={{ marginBottom: "30px" }}>Hostel Panel</h2>


  <div style={menu}>
    <p onClick={() => navigate("/dashboard")}>🏠 Dashboard</p>
    <p onClick={() => navigate("/dashboard")}>📋 Complaints</p>
    <p onClick={() => navigate("/rooms")}>🛏 Room Allocation</p>
  </div>

  <p onClick={logout} style={logoutBtn}>🚪 Logout</p>
</div>


);
}

const sidebar = {
width: "240px",
height: "100vh",
padding: "20px",
color: "white",
background: "linear-gradient(180deg, #1e3a8a, #3b82f6)",
display: "flex",
flexDirection: "column",
justifyContent: "space-between",
position: "sticky",
top: 0
};

const menu = {
display: "flex",
flexDirection: "column",
gap: "15px",
cursor: "pointer"
};

const logoutBtn = {
color: "#ff6b6b",
cursor: "pointer",
fontWeight: "bold"
};

export default Sidebar;
