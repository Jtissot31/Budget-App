namespace BudgetTracker.Mobile.Models;

public sealed class Category
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Icon { get; init; } = "📦";
    public string ColorHex { get; init; } = "#64748B";
}
