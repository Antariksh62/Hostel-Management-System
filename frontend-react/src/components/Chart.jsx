import { Doughnut } from "react-chartjs-2";
import "chart.js/auto"; // ✅ IMPORTANT (auto register everything)

function Chart({ resolved, pending }) {
const data = {
labels: ["Resolved", "Pending"],
datasets: [
{
data: [resolved || 0, pending || 0],
backgroundColor: ["#2ecc71", "#e74c3c"],
},
],
};

return (
<div style={{ width: "250px", margin: "20px auto" }}> <Doughnut data={data} /> </div>
);
}

export default Chart;
