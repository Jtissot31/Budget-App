namespace BudgetTracker.Mobile.Models;

public sealed class DashboardSummary
{
    public decimal Balance { get; init; }
    public decimal MonthlyIncome { get; init; }
    public decimal MonthlyExpenses { get; init; }
    public decimal MonthlyBudgetLimit { get; init; }
    public IReadOnlyList<Transaction> RecentTransactions { get; init; } = [];
    public IReadOnlyList<CategoryBudget> TopBudgets { get; init; } = [];

    public decimal BudgetRemaining => MonthlyBudgetLimit - MonthlyExpenses;
    public double BudgetProgress => MonthlyBudgetLimit <= 0
        ? 0
        : Math.Min(1, (double)(MonthlyExpenses / MonthlyBudgetLimit));
}
