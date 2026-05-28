namespace BudgetTracker.Mobile.Models;

public sealed class CategoryBudget
{
    public Category Category { get; init; } = new();
    public decimal Limit { get; init; }
    public decimal Spent { get; init; }

    public double Progress => Limit <= 0 ? 0 : Math.Min(1, (double)(Spent / Limit));
    public decimal Remaining => Math.Max(0, Limit - Spent);
    public bool IsOverBudget => Spent > Limit;
}
