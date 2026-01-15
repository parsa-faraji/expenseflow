/**
 * ExpenseFlow - Expense Tracker & Bill Splitter
 */

(function() {
    'use strict';

    // State
    let members = [];
    let expenses = [];

    // Elements
    const elements = {
        memberName: document.getElementById('memberName'),
        addMember: document.getElementById('addMember'),
        membersList: document.getElementById('membersList'),
        expenseForm: document.getElementById('expenseForm'),
        expenseDesc: document.getElementById('expenseDesc'),
        expenseAmount: document.getElementById('expenseAmount'),
        paidBy: document.getElementById('paidBy'),
        splitOptions: document.getElementById('splitOptions'),
        expensesList: document.getElementById('expensesList'),
        totalSection: document.getElementById('totalSection'),
        totalAmount: document.getElementById('totalAmount'),
        balances: document.getElementById('balances'),
        settlements: document.getElementById('settlements'),
        clearAll: document.getElementById('clearAll'),
        exportData: document.getElementById('exportData')
    };

    function init() {
        loadFromStorage();
        setupEventListeners();
        render();
    }

    function setupEventListeners() {
        elements.addMember.addEventListener('click', addMember);
        elements.memberName.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addMember();
        });
        elements.expenseForm.addEventListener('submit', addExpense);
        elements.clearAll.addEventListener('click', clearAll);
        elements.exportData.addEventListener('click', exportData);
    }

    function addMember() {
        const name = elements.memberName.value.trim();
        if (!name || members.includes(name)) return;

        members.push(name);
        elements.memberName.value = '';
        saveToStorage();
        render();
    }

    function removeMember(name) {
        members = members.filter(m => m !== name);
        expenses = expenses.filter(e => e.paidBy !== name);
        expenses.forEach(e => {
            e.splitBetween = e.splitBetween.filter(m => m !== name);
        });
        saveToStorage();
        render();
    }

    function addExpense(e) {
        e.preventDefault();

        const description = elements.expenseDesc.value.trim();
        const amount = parseFloat(elements.expenseAmount.value);
        const paidBy = elements.paidBy.value;
        const splitBetween = getSelectedSplit();

        if (!description || !amount || !paidBy || splitBetween.length === 0) {
            alert('Please fill all fields and select who to split with');
            return;
        }

        expenses.push({
            id: Date.now(),
            description,
            amount,
            paidBy,
            splitBetween,
            date: new Date().toISOString()
        });

        elements.expenseForm.reset();
        saveToStorage();
        render();
    }

    function removeExpense(id) {
        expenses = expenses.filter(e => e.id !== id);
        saveToStorage();
        render();
    }

    function getSelectedSplit() {
        const checkboxes = elements.splitOptions.querySelectorAll('input:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    function calculateBalances() {
        const balances = {};
        members.forEach(m => balances[m] = 0);

        expenses.forEach(expense => {
            const share = expense.amount / expense.splitBetween.length;

            // Person who paid gets credit
            balances[expense.paidBy] += expense.amount;

            // Each person who participated owes their share
            expense.splitBetween.forEach(person => {
                balances[person] -= share;
            });
        });

        return balances;
    }

    function calculateSettlements() {
        const balances = calculateBalances();
        const settlements = [];

        const debtors = [];
        const creditors = [];

        Object.entries(balances).forEach(([name, balance]) => {
            if (balance < -0.01) {
                debtors.push({ name, amount: -balance });
            } else if (balance > 0.01) {
                creditors.push({ name, amount: balance });
            }
        });

        // Sort by amount
        debtors.sort((a, b) => b.amount - a.amount);
        creditors.sort((a, b) => b.amount - a.amount);

        // Calculate settlements
        let i = 0, j = 0;
        while (i < debtors.length && j < creditors.length) {
            const debtor = debtors[i];
            const creditor = creditors[j];
            const amount = Math.min(debtor.amount, creditor.amount);

            if (amount > 0.01) {
                settlements.push({
                    from: debtor.name,
                    to: creditor.name,
                    amount: amount
                });
            }

            debtor.amount -= amount;
            creditor.amount -= amount;

            if (debtor.amount < 0.01) i++;
            if (creditor.amount < 0.01) j++;
        }

        return settlements;
    }

    function render() {
        renderMembers();
        renderPaidByOptions();
        renderSplitOptions();
        renderExpenses();
        renderBalances();
        renderSettlements();
    }

    function renderMembers() {
        if (members.length === 0) {
            elements.membersList.innerHTML = '<p class="empty-state">Add members to get started</p>';
            return;
        }

        elements.membersList.innerHTML = members.map(name => `
            <span class="member-tag">
                ${name}
                <button onclick="window.removeMember('${name}')">&times;</button>
            </span>
        `).join('');
    }

    function renderPaidByOptions() {
        elements.paidBy.innerHTML = '<option value="">Select person</option>' +
            members.map(name => `<option value="${name}">${name}</option>`).join('');
    }

    function renderSplitOptions() {
        if (members.length === 0) {
            elements.splitOptions.innerHTML = '<p class="empty-state">Add members first</p>';
            return;
        }

        elements.splitOptions.innerHTML = members.map(name => `
            <label class="split-option">
                <input type="checkbox" value="${name}" checked>
                ${name}
            </label>
        `).join('');
    }

    function renderExpenses() {
        if (expenses.length === 0) {
            elements.expensesList.innerHTML = '<p class="empty-state">No expenses yet. Add one above!</p>';
            elements.totalSection.style.display = 'none';
            return;
        }

        const total = expenses.reduce((sum, e) => sum + e.amount, 0);

        elements.expensesList.innerHTML = expenses.map(expense => `
            <div class="expense-item">
                <div class="expense-info">
                    <h4>${expense.description}</h4>
                    <p>Paid by ${expense.paidBy} • Split: ${expense.splitBetween.join(', ')}</p>
                </div>
                <span class="expense-amount">$${expense.amount.toFixed(2)}</span>
                <button class="expense-delete" onclick="window.removeExpense(${expense.id})">&times;</button>
            </div>
        `).join('');

        elements.totalSection.style.display = 'flex';
        elements.totalAmount.textContent = `$${total.toFixed(2)}`;
    }

    function renderBalances() {
        if (members.length === 0 || expenses.length === 0) {
            elements.balances.innerHTML = '<p class="empty-state">Add members and expenses to see balances</p>';
            return;
        }

        const balances = calculateBalances();

        elements.balances.innerHTML = Object.entries(balances).map(([name, balance]) => {
            let className = 'zero';
            let prefix = '';
            if (balance > 0.01) {
                className = 'positive';
                prefix = '+';
            } else if (balance < -0.01) {
                className = 'negative';
            }

            return `
                <div class="balance-item">
                    <span class="balance-name">${name}</span>
                    <span class="balance-amount ${className}">${prefix}$${Math.abs(balance).toFixed(2)}</span>
                </div>
            `;
        }).join('');
    }

    function renderSettlements() {
        if (members.length === 0 || expenses.length === 0) {
            elements.settlements.innerHTML = '<p class="empty-state">Add expenses to see settlements</p>';
            return;
        }

        const settlements = calculateSettlements();

        if (settlements.length === 0) {
            elements.settlements.innerHTML = '<p class="empty-state">All settled up!</p>';
            return;
        }

        elements.settlements.innerHTML = settlements.map(s => `
            <div class="settlement-item">
                <span class="settlement-from">${s.from}</span>
                <span class="settlement-arrow">→</span>
                <span class="settlement-to">${s.to}</span>
                <span class="settlement-amount">$${s.amount.toFixed(2)}</span>
            </div>
        `).join('');
    }

    function clearAll() {
        if (!confirm('Clear all members and expenses?')) return;
        members = [];
        expenses = [];
        saveToStorage();
        render();
    }

    function exportData() {
        const data = {
            members,
            expenses,
            balances: calculateBalances(),
            settlements: calculateSettlements(),
            total: expenses.reduce((sum, e) => sum + e.amount, 0),
            exportedAt: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `expenseflow-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function saveToStorage() {
        localStorage.setItem('expenseflow_members', JSON.stringify(members));
        localStorage.setItem('expenseflow_expenses', JSON.stringify(expenses));
    }

    function loadFromStorage() {
        try {
            members = JSON.parse(localStorage.getItem('expenseflow_members')) || [];
            expenses = JSON.parse(localStorage.getItem('expenseflow_expenses')) || [];
        } catch {
            members = [];
            expenses = [];
        }
    }

    // Expose functions for onclick handlers
    window.removeMember = removeMember;
    window.removeExpense = removeExpense;

    init();
})();
