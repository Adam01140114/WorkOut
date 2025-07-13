// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBF12OeURhzojL7KjCniRbZ9ku9JppKCIU",
  authDomain: "workout-f5678.firebaseapp.com",
  projectId: "workout-f5678",
  storageBucket: "workout-f5678.firebasestorage.app",
  messagingSenderId: "619674583683",
  appId: "1:619674583683:web:45f2c9806a6f6375a851b6",
  measurementId: "G-JXM4HRZTBH"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const customWorkoutForm = document.getElementById('custom-workout-form');
const customWorkoutContainer = document.getElementById('custom-workout-container');
const workoutChartCanvas = document.getElementById('workoutChart').getContext('2d');
const prevChartBtn = document.getElementById('prev-chart-btn');
const nextChartBtn = document.getElementById('next-chart-btn');
const chartModeLabel = document.getElementById('chart-mode-label');

let chartInstance = null;
let workoutData = {};
let currentChartMode = 0;

// Chart Modes
const chartModes = [
  "Total Weight Lifted",
  "Weight Lifted by Day",
  "Total Calories Burned",
  "Reps by Day"
];

// Function to create a workout module dynamically
const createWorkoutModule = async (workoutName, storedWeight = "", storedReps = "") => {
  if (document.querySelector(`[data-workout-name="${workoutName}"]`)) return;

  const moduleContainer = document.createElement('div');
  moduleContainer.className = 'workout-module';
  moduleContainer.innerHTML = `
    <div class="workout-info">
      <input type="text" class="workout-title" value="${workoutName}" data-workout-name="${workoutName}" readonly>
      <div class="input-container">
        <input type="number" class="workout-input" placeholder="Weight" value="${storedWeight}" data-weight="${workoutName}">
        <input type="number" class="workout-input" placeholder="Reps" value="${storedReps}" data-reps="${workoutName}">
      </div>
    </div>
    <div class="workout-buttons">
      <button class="log-btn">Log</button>
      <button class="delete-btn">Delete</button>
    </div>
  `;

  customWorkoutContainer.appendChild(moduleContainer);

  // Get inputs and buttons
  const weightInput = moduleContainer.querySelector(`[data-weight="${workoutName}"]`);
  const repsInput = moduleContainer.querySelector(`[data-reps="${workoutName}"]`);
  const logButton = moduleContainer.querySelector('.log-btn');
  const deleteButton = moduleContainer.querySelector('.delete-btn');

  // Save weight & reps values in Firebase when changed
  weightInput.addEventListener('change', async () => {
    await db.collection('workouts').doc(workoutName).set({ weight: weightInput.value, reps: repsInput.value }, { merge: true });
  });

  repsInput.addEventListener('change', async () => {
    await db.collection('workouts').doc(workoutName).set({ reps: repsInput.value, weight: weightInput.value }, { merge: true });
  });

  // Log workout data
  logButton.addEventListener('click', async () => {
    const weight = parseFloat(weightInput.value) || 0;
    const reps = parseInt(repsInput.value) || 0;
    if (weight && reps) {
      const totalWeight = weight * reps;

      // Save workout log in Firebase
      const workoutLog = {
        workoutName,
        totalWeight,
        reps,
        date: new Date().toLocaleDateString(),
        timestamp: Date.now()
      };

      await db.collection("workoutLogs").add(workoutLog);
      loadGraphData(); // Reload graph after logging
    }
  });

  // Delete workout from Firebase
  deleteButton.addEventListener('click', async () => {
    if (confirm(`Are you sure you want to delete ${workoutName}? This action cannot be undone.`)) {
      await db.collection("workouts").doc(workoutName).delete();
      
      // Delete workout logs
      const logsSnapshot = await db.collection("workoutLogs").where("workoutName", "==", workoutName).get();
      logsSnapshot.forEach(async (doc) => {
        await db.collection("workoutLogs").doc(doc.id).delete();
      });

      moduleContainer.remove();
      loadGraphData(); // Reload graph after deleting
    }
  });
};

// Handle Workout Creation
customWorkoutForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const workoutName = document.getElementById('custom-workout-name').value.trim();
  if (workoutName) {
    await db.collection('workouts').doc(workoutName).set({ workoutName, weight: "", reps: "" });
    createWorkoutModule(workoutName);
    document.getElementById('custom-workout-name').value = '';
  }
});

// Load Existing Workouts on Page Load
window.addEventListener('load', async () => {
  const workoutsSnapshot = await db.collection('workouts').get();
  workoutsSnapshot.forEach(doc => {
    const data = doc.data();
    createWorkoutModule(data.workoutName, data.weight || "0", data.reps || "0");
  });

  loadGraphData(); // Load graph data when page loads
});

// Load Graph Data from Firebase
const loadGraphData = async () => {
  workoutData = {}; // Reset workout data

  const logsSnapshot = await db.collection("workoutLogs").get();
  logsSnapshot.forEach(doc => {
    const { workoutName, totalWeight, reps, date } = doc.data();

    if (!workoutData[workoutName]) workoutData[workoutName] = {};
    if (!workoutData[workoutName][date]) workoutData[workoutName][date] = { weight: 0, reps: 0 };

    workoutData[workoutName][date].weight += totalWeight;
    workoutData[workoutName][date].reps += reps;
  });

  renderChart();
};

// Chart Functionality
const renderChart = () => {
  if (chartInstance) chartInstance.destroy();

  let labels = [];
  let datasets = [];

  if (currentChartMode === 0) {
    labels = Object.keys(workoutData);
    datasets = [{
      label: "Total Weight Lifted",
      data: Object.values(workoutData).map(ex => Object.values(ex).reduce((acc, val) => acc + val.weight, 0)),
      backgroundColor: "#0071e3",
      type: "bar"
    }];
  } else {
    Object.keys(workoutData).forEach(workout => {
      const dates = Object.keys(workoutData[workout]);
      const values = dates.map(date => workoutData[workout][date][currentChartMode === 1 ? 'weight' : 'reps']);

      datasets.push({
        label: workout,
        data: values,
        borderColor: "#" + Math.floor(Math.random() * 16777215).toString(16),
        fill: false,
        tension: 0.3
      });

      if (labels.length < dates.length) labels = dates;
    });
  }

  chartInstance = new Chart(workoutChartCanvas, {
    type: currentChartMode === 0 ? 'bar' : 'line',
    data: { labels, datasets }
  });
};

// Chart Mode Switching
nextChartBtn.addEventListener('click', () => {
  currentChartMode = (currentChartMode + 1) % chartModes.length;
  renderChart();
});

prevChartBtn.addEventListener('click', () => {
  currentChartMode = (currentChartMode - 1 + chartModes.length) % chartModes.length;
  renderChart();
});
