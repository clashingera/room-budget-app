// script.js

import * as ui from "./ui.js";
import {
  getDocs,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export function main(firebase) {
  const {
    db,
    auth,
    provider,
    signInWithPopup,
    onAuthStateChanged,
    signOut,
    doc,
    getDoc,
    setDoc,
    collection,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    serverTimestamp,
  } = firebase;

  let totalFund = 0,
    totalSpent = 0;
  let contributors = [],
    expenses = [],
    logs = [];

  let unsubContributors = null,
    unsubExpenses = null,
    unsubLogs = null;

  // === Authentication and User Profile Handling ===
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      await handleUserProfile(user);
    } else {
      ui.updateUIToLoggedOut();
    }
  });

  async function handleUserProfile(user) {
    const userRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      
      if (userData.status === "pending") {
        ui.showWaitingForApproval(user);
        return;
      }
      
      if (userData.status === "rejected") {
        ui.showRejectedUI(user, resendRequest);
        return;
      }
      
      ui.updateUIToLoggedIn(user, userData.role);
      subscribeToFirestore();

    } else {
      const newUserProfile = {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        role: "member",
        status: "pending",
      };
      try {
        await setDoc(userRef, newUserProfile);
        ui.showWaitingForApproval(user);
      } catch (e) {
        console.error("Error creating user profile:", e);
      }
    }
  }

  async function resendRequest(user) {
      const userRef = doc(db, 'users', user.uid);
      try {
          await updateDoc(userRef, { status: 'pending' });
          ui.showWaitingForApproval(user);
          alert("Your request has been sent for approval again.");
      } catch (error) {
          console.error("Error resending request: ", error);
      }
  }

  function signIn() {
    signInWithPopup(auth, provider).catch((e) => {
      console.error("Login failed:", e);
    });
  }

  function logout() {
    if (unsubContributors) unsubContributors();
    if (unsubExpenses) unsubExpenses();
    if (unsubLogs) unsubLogs();
    unsubContributors = unsubExpenses = unsubLogs = null;

    signOut(auth).catch((e) => {
      console.error("Logout failed:", e);
    });
  }
  
  // === Wire up UI Clicks ===
  ui.onLoginClick(signIn);
  ui.onLogoutClick(logout);
  ui.onRequestsClick(displayRequestsInPanel);
  ui.onMembersClick(displayMembersInPanel);

  ui.onThemeToggleClick(() => {
    const currentTheme = document.body.getAttribute("data-theme") || "light";
    const newTheme = currentTheme === "light" ? "dark" : "light";
    document.body.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    ui.updateUIToLoggedIn(auth.currentUser, ui.getCurrentRole());
  });

  document.addEventListener("DOMContentLoaded", () => {
    const theme = localStorage.getItem("theme") || "light";
    document.body.setAttribute("data-theme", theme);

    if (document.getElementById("expDate")) {
      document.getElementById("expDate").value = new Date()
        .toISOString()
        .split("T")[0];
    }
    setupEvents();
  });

  // === Event Listeners Setup ===
  function setupEvents() {
    document.getElementById("addFundBtn").onclick = addFund;
    document.getElementById("showContributorsBtn").onclick = showContributorsModal;
    document.getElementById("showLogsBtn").onclick = showLogs;
    document.getElementById("addExpenseBtn").onclick = addExpense;
    
    document.getElementById("closeLogsBtn").onclick = closeLogs;
    document.getElementById("closeContributorsModalBtn").onclick = () => closeModal("contributorsModal");
    document.getElementById("closeEditExpenseModalBtn").onclick = () => closeModal("editExpenseModal");
    document.getElementById("closeEditContributorModalBtn").onclick = () => closeModal("editContributorModal");
    
    document.getElementById("saveExpenseBtn").onclick = saveExpense;
    document.getElementById("saveContributorBtn").onclick = saveContributor;
    document.getElementById("requestDeleteExpenseBtn").onclick = requestDeleteExpense;
    document.getElementById("cancelActionBtn").onclick = () => closeModal("confirmationModal");

    // PERFORMANCE: Use one listener for all actions inside the profile panel content.
    document.getElementById('profileContent').addEventListener('click', handleProfileContentClick);
  }

  async function handleProfileContentClick(e) {
    const approveBtn = e.target.closest('.approve-btn');
    if (approveBtn) {
        approveBtn.disabled = true; // Prevent double clicks
        await updateDoc(doc(db, "users", approveBtn.dataset.id), { status: "approved" });
        displayRequestsInPanel();
        return;
    }
    const rejectBtn = e.target.closest('.reject-btn');
    if (rejectBtn) {
        rejectBtn.disabled = true;
        await updateDoc(doc(db, "users", rejectBtn.dataset.id), { status: "rejected" });
        displayRequestsInPanel();
        return;
    }
    const kickBtn = e.target.closest('.kick-btn');
    if (kickBtn) {
        kickBtn.disabled = true;
        await updateDoc(doc(db, "users", kickBtn.dataset.id), { status: "rejected" });
        displayMembersInPanel();
        return;
    }
  }


  // === Profile Panel Display Functions ===
  async function displayRequestsInPanel() {
    ui.showPanelLoading();
    const usersRef = collection(db, "users");
    const pendingQuery = query(usersRef, where("status", "==", "pending"));
    const snapshot = await getDocs(pendingQuery);
    
    let html = '';
    if (snapshot.empty) {
      html = "<p>No pending requests.</p>";
    } else {
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        html += `
          <div class="panel-list-item">
            <div>
              <strong>${data.displayName || 'Unnamed User'}</strong>
              <span class="email">${data.email || 'No Email'}</span>
            </div>
            <div class="actions">
              <button class="approve-btn" data-id="${docSnap.id}" title="Approve">&#10003;</button>
              <button class="reject-btn" data-id="${docSnap.id}" title="Reject">&#10005;</button>
            </div>
          </div>`;
      });
    }
    ui.setPanelContent(html);
  }

  async function displayMembersInPanel() {
    ui.showPanelLoading();
    const usersRef = collection(db, "users");
    const approvedQuery = query(usersRef, where("status", "==", "approved"));
    const snapshot = await getDocs(approvedQuery);

    let html = '';
    if (snapshot.empty) {
        html = "<p>No members found.</p>";
    } else {
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            html += `
            <div class="panel-list-item">
                <div>
                    <strong>${data.displayName || data.email}</strong>
                    <span class="email">${data.role}</span>
                </div>
                <div class="actions">
                    ${ auth.currentUser.uid !== docSnap.id ? `<button class="kick-btn" data-id="${docSnap.id}" title="Kick member">&#9003;</button>` : '' }
                </div>
            </div>`;
        });
    }
    ui.setPanelContent(html);
  }

  // --- Other functions (data fetching, modals, etc.) ---
  function subscribeToFirestore() {
    if (unsubContributors) return;
    unsubContributors = onSnapshot(collection(db, "contributors"), (snapshot) => {
        contributors = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        processData();
    });
    unsubExpenses = onSnapshot(query(collection(db, "expenses"), orderBy("date", "desc")), (snapshot) => {
        expenses = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        processData();
    });
    unsubLogs = onSnapshot(query(collection(db, "logs"), orderBy("timestamp", "desc")), (snapshot) => {
        logs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (document.getElementById("logPanel").classList.contains("open")) {
          renderLogs();
        }
    });
  }

  function processData() {
    recalcTotals();
    renderExpenses();
    updateDisplay();
    if (document.getElementById("contributorsModal")?.style.display === "block") {
      renderContributorsModal();
    }
  }

  function recalcTotals() {
    totalFund = contributors.reduce((a, c) => a + c.amount, 0);
    totalSpent = expenses.reduce((a, e) => a + e.amount, 0);
  }

  function renderExpenses() {
    const table = document.getElementById("expenseTable");
    table.innerHTML = "";
    expenses.forEach(({ date, desc, spender, amount, id }) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td data-label="Date">${formatDate(date)}</td>
        <td data-label="Detail">${desc}</td>
        <td data-label="Spender">${spender}</td>
        <td data-label="Amount">₹${amount}</td>
        <td data-label="Action"><button class="edit-btn" data-id="${id}">Edit</button></td>
      `;
      table.appendChild(tr);
    });
    table.querySelectorAll(".edit-btn").forEach((button) => {
      button.onclick = (e) => openEditExpenseModal(e.target.dataset.id);
    });
  }

  function formatDate(iso) {
    if (!iso) return "";
    const [year, month, day] = iso.split("-");
    return `${day}-${month}-${year}`;
  }

  function updateDisplay() {
    animateValue(document.getElementById("totalFund"), 0, totalFund, 1200);
    animateValue(document.getElementById("totalSpent"), 0, totalSpent, 1200);
    animateValue(document.getElementById("remainingBalance"), 0, totalFund - totalSpent, 1200);
  }

  async function addFund() {
    const name = document.getElementById("fundName").value.trim();
    const amount = parseFloat(document.getElementById("fundInput").value);
    if (!name || isNaN(amount) || amount <= 0)
      return alert("Please enter a valid name and amount.");
    try {
      await addDoc(collection(db, "contributors"), { name, amount });
      await addLog(`${name} added fund: ₹${amount}`);
      document.getElementById("fundName").value = "";
      document.getElementById("fundInput").value = "";
    } catch (error) { console.error("Error adding fund:", error); alert("Failed to add fund."); }
  }

  async function addExpense() {
    const date = document.getElementById("expDate").value;
    const desc = document.getElementById("expDesc").value.trim();
    const spender = document.getElementById("expSpender").value.trim();
    const amount = parseFloat(document.getElementById("expAmount").value);
    if (!date || !desc || !spender || isNaN(amount) || amount <= 0) {
      return alert("Please fill all expense fields correctly.");
    }
    try {
      await addDoc(collection(db, "expenses"), { date, desc, spender, amount });
      await addLog(`${spender} added expense for "${desc}": ₹${amount}`);
      document.getElementById("expDesc").value = "";
      document.getElementById("expSpender").value = "";
      document.getElementById("expAmount").value = "";
    } catch (error) { console.error("Error adding expense:", error); }
  }
  
  async function saveContributor() {
    const id = document.getElementById("editContributorId").value;
    const name = document.getElementById("editContributorName").value.trim();
    const amount = parseFloat(document.getElementById("editContributorAmount").value);
    if (!name || isNaN(amount) || amount <= 0) return alert("Please enter valid details.");
    try {
      await updateDoc(doc(db, "contributors", id), { name, amount });
      await addLog(`Contribution for ${name} was updated.`);
      closeModal("editContributorModal");
    } catch (error) { console.error("Error saving contributor:", error); }
  }

  async function deleteContributor(id) {
    try {
      await deleteDoc(doc(db, "contributors", id));
      await addLog(`A contributor record was deleted.`);
    } catch (error) { console.error("Error deleting contributor:", error); }
  }

  async function saveExpense() {
    const id = document.getElementById("editExpId").value;
    const date = document.getElementById("editExpDate").value;
    const desc = document.getElementById("editExpDesc").value.trim();
    const amount = parseFloat(document.getElementById("editExpAmount").value);
    if (!date || !desc || isNaN(amount) || amount <= 0) return alert("Please enter valid details.");
    try {
      await updateDoc(doc(db, "expenses", id), { date, desc, amount });
      await addLog(`Expense "${desc}" was edited.`);
      closeModal("editExpenseModal");
    } catch (error) { console.error("Error saving expense:", error); }
  }

  async function deleteExpenseFromModal() {
    const id = document.getElementById("editExpId").value;
    try {
      await deleteDoc(doc(db, "expenses", id));
      await addLog(`An expense record was deleted.`);
      closeModal("editExpenseModal");
    } catch (error) { console.error("Error deleting expense:", error); }
  }

  async function addLog(message) {
    try {
      await addDoc(collection(db, "logs"), { message, timestamp: serverTimestamp() });
    } catch (error) { console.error("Failed to write log:", error); }
  }

  function renderLogs() {
    const logBody = document.getElementById("logEntries");
    logBody.innerHTML = "";
    logs.forEach((log) => {
      const row = logBody.insertRow();
      row.innerHTML = `<td>${ log.timestamp ? new Date(log.timestamp.toDate()).toLocaleString() : "..." }</td><td>${log.message}</td>`;
    });
  }

  function showLogs() {
    renderLogs();
    document.body.classList.add('log-panel-open');
    document.getElementById("logPanel").classList.add("open");
  }

  function closeLogs() {
    document.body.classList.remove('log-panel-open');
    document.getElementById("logPanel").classList.remove("open");
  }

  function renderContributorsModal() {
    const list = document.getElementById("contributorsList");
    list.innerHTML = "";
    if (contributors.length === 0) {
      list.innerHTML = "<p>No contributors yet.</p>";
      return;
    }
    [...contributors].sort((a, b) => a.name.localeCompare(b.name)).forEach((c) => {
      const item = document.createElement("div");
      item.className = "contributor-item";
      item.innerHTML = `<span><strong>${c.name}</strong>: ₹${c.amount}</span><div class="actions"><button class="edit-contributor-btn" data-id="${c.id}">Edit</button><button class="delete-contributor-btn delete-btn" data-id="${c.id}">Delete</button></div>`;
      list.appendChild(item);
    });
    document.querySelectorAll(".edit-contributor-btn").forEach(b => { b.onclick = (e) => openEditContributorModal(e.target.dataset.id); });
    document.querySelectorAll(".delete-contributor-btn").forEach(b => { b.onclick = (e) => requestDeleteContributor(e.target.dataset.id); });
  }

  function showContributorsModal() {
    renderContributorsModal();
    openModal("contributorsModal");
  }

  function openEditContributorModal(id) {
    const c = contributors.find((c) => c.id === id);
    if(c){
      document.getElementById("editContributorId").value = c.id;
      document.getElementById("editContributorName").value = c.name;
      document.getElementById("editContributorAmount").value = c.amount;
      openModal("editContributorModal");
    }
  }

  function openEditExpenseModal(id) {
    const e = expenses.find((e) => e.id === id);
    if(e){
      document.getElementById("editExpId").value = e.id;
      document.getElementById("editExpDate").value = e.date;
      document.getElementById("editExpDesc").value = e.desc;
      document.getElementById("editExpAmount").value = e.amount;
      openModal("editExpenseModal");
    }
  }

  function requestDeleteContributor(id) {
    const c = contributors.find((c) => c.id === id);
    if (!c) return;
    openConfirmationModal(`Delete Contributor?`, `Are you sure you want to remove ${c.name}'s contribution of ₹${c.amount}?`, () => deleteContributor(id));
  }

  function requestDeleteExpense() {
    const id = document.getElementById("editExpId").value;
    const e = expenses.find((e) => e.id === id);
    if (!e) return;
    openConfirmationModal(`Delete Expense?`, `Are you sure you want to delete the expense: "${e.desc}"?`, () => deleteExpenseFromModal());
  }

  function openModal(modalId) {
    document.getElementById(modalId).style.display = "block";
  }

  function closeModal(modalId) {
    document.getElementById(modalId).style.display = "none";
  }

  function openConfirmationModal(title, message, onConfirm) {
    document.getElementById("confirmationTitle").innerText = title;
    document.getElementById("confirmationMessage").innerText = message;
    const btn = document.getElementById("confirmActionBtn");
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.onclick = () => {
      onConfirm();
      closeModal("confirmationModal");
    };
    openModal("confirmationModal");
  }

  window.onclick = function (event) {
    if (event.target.classList.contains("modal")) {
      event.target.style.display = "none";
    }
  };

  function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }

  function animateValue(element, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const val = Math.floor(easeInOutCubic(progress) * (end - start) + start);
      element.innerText = "₹" + (isNaN(val) ? start.toFixed(0) : val.toLocaleString("en-IN"));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        element.innerText = "₹" + end.toLocaleString("en-IN");
      }
    };
    window.requestAnimationFrame(step);
  }
}