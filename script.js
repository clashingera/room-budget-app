export function main(firebase) {
    const { db, collection, onSnapshot, doc, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } = firebase;

    let totalFund = 0;
    let totalSpent = 0;
    let contributors = [];
    let expenses = [];
    let logs = [];

    let unsubContributors = null;
    let unsubExpenses = null;
    let unsubLogs = null;

    document.addEventListener('DOMContentLoaded', () => {
        setupEventListeners();
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('expDate').value = today;
        subscribeToChanges();
    });

    function setupEventListeners() {
        const themeToggle = document.getElementById('themeToggle');
        let currentTheme = localStorage.getItem('theme') || 'light';
        document.body.setAttribute('data-theme', currentTheme);
        themeToggle.addEventListener('click', () => {
            const newTheme = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            document.body.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        });

        document.getElementById('addFundBtn').addEventListener('click', addFund);
        document.getElementById('showContributorsBtn').addEventListener('click', showContributorsModal);
        document.getElementById('showLogsBtn').addEventListener('click', showLogs);
        document.getElementById('addExpenseBtn').addEventListener('click', addExpense);
        document.getElementById('closeLogsBtn').addEventListener('click', closeLogs);
        document.getElementById('closeEditExpenseModalBtn').addEventListener('click', () => closeModal('editExpenseModal'));
        document.getElementById('saveExpenseBtn').addEventListener('click', saveExpense);
        document.getElementById('requestDeleteExpenseBtn').addEventListener('click', requestDeleteExpense);
        document.getElementById('closeContributorsModalBtn').addEventListener('click', () => closeModal('contributorsModal'));
        document.getElementById('closeEditContributorModalBtn').addEventListener('click', () => closeModal('editContributorModal'));
        document.getElementById('saveContributorBtn').addEventListener('click', saveContributor);
        document.getElementById('cancelActionBtn').addEventListener('click', () => closeModal('confirmationModal'));
    }

    function subscribeToChanges() {
        if (unsubContributors) unsubContributors();
        if (unsubExpenses) unsubExpenses();
        if (unsubLogs) unsubLogs();

        const contributorsQuery = query(collection(db, "contributors"));
        unsubContributors = onSnapshot(contributorsQuery, snapshot => {
            contributors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            processData();
        }, console.error);

        const expensesQuery = query(collection(db, "expenses"), orderBy("date", "desc"));
        unsubExpenses = onSnapshot(expensesQuery, snapshot => {
            expenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            processData();
        }, console.error);

        const logsQuery = query(collection(db, "logs"), orderBy("timestamp", "desc"));
        unsubLogs = onSnapshot(logsQuery, snapshot => {
            logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (document.getElementById('logPanel').classList.contains('open')) {
                renderLogs();
            }
        }, console.error);
    }

    function processData() {
        recalculateTotals();
        renderExpenses();
        updateDisplay();
        if (document.getElementById('contributorsModal').style.display === 'block') {
            renderContributorsModal();
        }
    }

    function recalculateTotals() {
        totalFund = contributors.reduce((sum, c) => sum + c.amount, 0);
        totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
    }

    function renderExpenses() {
        const expenseTable = document.getElementById('expenseTable');
        expenseTable.innerHTML = '';
        expenses.forEach(expense => {
            const row = expenseTable.insertRow();
            row.innerHTML = `
                <td data-label="Date">${expense.date}</td>
                <td data-label="Detail">${expense.desc}</td>
                <td data-label="Spender">${expense.spender}</td>
                <td data-label="Amount">₹${expense.amount}</td>
                <td data-label="Action"><button class="edit-expense-btn" data-id="${expense.id}">Edit</button></td>
            `;
        });
        document.querySelectorAll('.edit-expense-btn').forEach(button => {
            button.addEventListener('click', (e) => openEditExpenseModal(e.target.dataset.id));
        });
    }

    function updateDisplay() {
        const totalFundEl = document.getElementById('totalFund');
        const totalSpentEl = document.getElementById('totalSpent');
        const remainingBalanceEl = document.getElementById('remainingBalance');

        animateValue(totalFundEl, parseFloat(totalFundEl.innerText.replace('₹', '')), totalFund, 1500);
        animateValue(totalSpentEl, parseFloat(totalSpentEl.innerText.replace('₹', '')), totalSpent, 1500);
        animateValue(remainingBalanceEl, parseFloat(remainingBalanceEl.innerText.replace('₹', '')), totalFund - totalSpent, 1500);
    }

    async function addFund() {
        const name = document.getElementById('fundName').value.trim();
        const amount = parseFloat(document.getElementById('fundInput').value);
        if (!name || isNaN(amount) || amount <= 0) return alert("Please enter a valid name and amount.");

        try {
            await addDoc(collection(db, "contributors"), { name, amount });
            await addLog(`${name} added fund: ₹${amount}`);
            document.getElementById('fundName').value = '';
            document.getElementById('fundInput').value = '';
        } catch (error) {
            console.error('Error adding fund:', error);
            alert('Failed to add fund.');
        }
    }

    async function saveContributor() {
        const id = document.getElementById('editContributorId').value;
        const name = document.getElementById('editContributorName').value.trim();
        const amount = parseFloat(document.getElementById('editContributorAmount').value);

        if (!name || isNaN(amount) || amount <= 0) return alert('Please enter valid details.');

        try {
            const contributorDoc = doc(db, "contributors", id);
            await updateDoc(contributorDoc, { name, amount });
            await addLog(`Contribution for ${name} was updated.`);
            closeModal('editContributorModal');
        } catch (error) {
            console.error('Error saving contributor:', error);
        }
    }
    
    async function deleteContributor(id) {
        try {
            await deleteDoc(doc(db, "contributors", id));
            await addLog(`A contributor record was deleted.`);
        } catch (error) {
            console.error('Error deleting contributor:', error);
        }
    }

    async function addExpense() {
        const date = document.getElementById('expDate').value;
        const desc = document.getElementById('expDesc').value.trim();
        const spender = document.getElementById('expSpender').value.trim();
        const amount = parseFloat(document.getElementById('expAmount').value);

        if (!date || !desc || !spender || isNaN(amount) || amount <= 0) {
            return alert('Please fill all expense fields correctly.');
        }
        
        try {
            await addDoc(collection(db, "expenses"), { date, desc, spender, amount });
            await addLog(`${spender} added expense for "${desc}": ₹${amount}`);
            document.getElementById('expDesc').value = '';
            document.getElementById('expSpender').value = '';
            document.getElementById('expAmount').value = '';
        } catch (error) {
            console.error('Error adding expense:', error);
        }
    }

    async function saveExpense() {
        const id = document.getElementById('editExpId').value;
        const date = document.getElementById('editExpDate').value;
        const desc = document.getElementById('editExpDesc').value.trim();
        const amount = parseFloat(document.getElementById('editExpAmount').value);

        if (!date || !desc || isNaN(amount) || amount <= 0) return alert('Please enter valid details.');

        try {
            const expenseDoc = doc(db, "expenses", id);
            await updateDoc(expenseDoc, { date, desc, amount });
            await addLog(`Expense "${desc}" was edited.`);
            closeModal('editExpenseModal');
        } catch (error) {
            console.error('Error saving expense:', error);
        }
    }

    async function deleteExpenseFromModal() {
        const id = document.getElementById('editExpId').value;
        try {
            await deleteDoc(doc(db, "expenses", id));
            await addLog(`An expense record was deleted.`);
            closeModal('editExpenseModal');
        } catch (error) {
            console.error('Error deleting expense:', error);
        }
    }

    async function addLog(message) {
        try {
            await addDoc(collection(db, "logs"), { 
                message, 
                timestamp: serverTimestamp() 
            });
        } catch (error) {
            console.error('Failed to write log:', error);
        }
    }
    
    function renderLogs() {
        const logBody = document.getElementById('logEntries');
        logBody.innerHTML = '';
        logs.forEach(log => {
            const row = logBody.insertRow();
            row.innerHTML = `
                <td>${log.timestamp ? new Date(log.timestamp.toDate()).toLocaleString() : '...'}</td>
                <td>${log.message}</td>
            `;
        });
    }

    function showLogs() {
        renderLogs();
        document.getElementById('logPanel').classList.add('open');
    }

    function showContributorsModal() {
        renderContributorsModal();
        openModal('contributorsModal');
    }
    
    function renderContributorsModal() {
        const contributorsList = document.getElementById('contributorsList');
        contributorsList.innerHTML = '';

        if (contributors.length === 0) {
            contributorsList.innerHTML = '<p>No contributors yet.</p>';
        } else {
            const sortedContributors = [...contributors].sort((a, b) => a.name.localeCompare(b.name));
            sortedContributors.forEach(c => {
                const item = document.createElement('div');
                item.className = 'contributor-item';
                item.innerHTML = `
                    <span><strong>${c.name}</strong>: ₹${c.amount}</span>
                    <div class="actions">
                        <button class="edit-contributor-btn" data-id="${c.id}">Edit</button>
                        <button class="delete-contributor-btn delete-btn" data-id="${c.id}">Delete</button>
                    </div>
                `;
                contributorsList.appendChild(item);
            });

            document.querySelectorAll('.edit-contributor-btn').forEach(button => {
                button.addEventListener('click', e => openEditContributorModal(e.target.dataset.id));
            });
            document.querySelectorAll('.delete-contributor-btn').forEach(button => {
                button.addEventListener('click', e => requestDeleteContributor(e.target.dataset.id));
            });
        }
    }

    function openEditContributorModal(id) {
        const contributor = contributors.find(c => c.id === id);
        if (contributor) {
            document.getElementById('editContributorId').value = contributor.id;
            document.getElementById('editContributorName').value = contributor.name;
            document.getElementById('editContributorAmount').value = contributor.amount;
            openModal('editContributorModal');
        }
    }

    function openEditExpenseModal(id) {
        const expense = expenses.find(e => e.id === id);
        if (expense) {
            document.getElementById('editExpId').value = expense.id;
            document.getElementById('editExpDate').value = expense.date;
            document.getElementById('editExpDesc').value = expense.desc;
            document.getElementById('editExpAmount').value = expense.amount;
            openModal('editExpenseModal');
        }
    }

    function requestDeleteContributor(id) {
        const contributor = contributors.find(c => c.id === id);
        if (!contributor) return;
        openConfirmationModal(
            'Delete Contributor?',
            `Are you sure you want to remove ${contributor.name}'s contribution of ₹${contributor.amount}?`,
            () => deleteContributor(id)
        );
    }

    function requestDeleteExpense() {
        const id = document.getElementById('editExpId').value;
        const expense = expenses.find(e => e.id === id);
        if (!expense) return;
        openConfirmationModal(
            'Delete Expense?',
            `Are you sure you want to delete the expense: "${expense.desc}"?`,
            () => deleteExpenseFromModal()
        );
    }

    function openModal(modalId) { document.getElementById(modalId).style.display = 'block'; }
    function closeModal(modalId) { document.getElementById(modalId).style.display = 'none'; }
    function closeLogs() { document.getElementById('logPanel').classList.remove('open'); }

    function openConfirmationModal(title, message, onConfirm) {
        document.getElementById('confirmationTitle').innerText = title;
        document.getElementById('confirmationMessage').innerText = message;
        
        const confirmBtn = document.getElementById('confirmActionBtn');
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        newConfirmBtn.onclick = () => {
            onConfirm();
            closeModal('confirmationModal');
        };
        
        openModal('confirmationModal');
    }

    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = "none";
        }
    }

    function easeInOutCubic(x) {
        return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    }

    function animateValue(element, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const easedProgress = easeInOutCubic(progress);
            const value = Math.floor(easedProgress * (end - start) + start);
            element.innerText = '₹' + (isNaN(value) ? start.toFixed(0) : value.toLocaleString('en-IN'));
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                element.innerText = '₹' + end.toLocaleString('en-IN');
            }
        };
        window.requestAnimationFrame(step);
    }
}