namespace BudgetTracker.Mobile.Models;

public sealed class Transaction
{
    public Guid Id { get; init; }
    public string Label { get; init; } = string.Empty;
    public decimal Amount { get; init; }
    public TransactionType Type { get; init; }
    public DateTime Date { get; init; }
    public Category Category { get; init; } = new();
    public string? Note { get; init; }
}
