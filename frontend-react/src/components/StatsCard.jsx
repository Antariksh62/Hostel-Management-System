function StatsCard({ title, value, color }) {
return (
<div style={{
background: "white",
padding: "20px",
borderRadius: "10px",
flex: 1,
margin: "10px",
boxShadow: "0 3px 10px rgba(0,0,0,0.1)"
}}>
<h4 style={{ color }}>{title}</h4> <h2>{value}</h2> </div>
);
}

export default StatsCard;
