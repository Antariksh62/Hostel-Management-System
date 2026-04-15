import { useEffect, useState } from "react";
import API from "../services/api";
import Sidebar from "../components/Sidebar";

function Room() {
const [name, setName] = useState("");
const [room, setRoom] = useState("");
const [rooms, setRooms] = useState([]);

const fetchRooms = async () => {
try {
const res = await API.get("/rooms");
setRooms(res.data);
} catch (err) {
console.log(err);
}
};

const allocateRoom = async () => {
try {
await API.post("/rooms", { name, room });
fetchRooms();
setName("");
setRoom("");
} catch (err) {
console.log(err);
}
};

useEffect(() => {
fetchRooms();
}, []);

return (
<div style={{ display: "flex" }}>


  <Sidebar />

  <div style={{ padding: "20px", flex: 1 }}>
    <h2>Room Allocation</h2>

    <input
      placeholder="Student Name"
      value={name}
      onChange={(e) => setName(e.target.value)}
    />
    <br /><br />

    <input
      placeholder="Room Number"
      value={room}
      onChange={(e) => setRoom(e.target.value)}
    />
    <br /><br />

    <button onClick={allocateRoom}>
      Allocate
    </button>

    <h3 style={{ marginTop: "30px" }}>Allocated Rooms</h3>

    {rooms.map((r) => (
      <div key={r._id} style={{ marginBottom: "10px" }}>
        {r.occupants.map((o, index) => (
          <div key={index}>
            {o.name} → Room {r.roomNumber}
          </div>
        ))}
      </div>
    ))}
  </div>
</div>


);
}

export default Room;
